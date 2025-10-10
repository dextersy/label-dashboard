import { spawn } from 'child_process';
import path from 'path';

/**
 * SSL Management Service
 * 
 * This service handles automatic SSL certificate management by connecting to the frontend server
 * and executing the add-ssl-domain.sh script when new domains are created for sublabels.
 */

interface SSLResult {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
  note?: string; // Additional information about the operation
}

/**
 * Add a domain to the SSL certificate by executing the add-ssl-domain.sh script on the frontend server
 * Includes pre-check to avoid unnecessary operations on existing domains
 * @param domainName - The domain name to add to the SSL certificate
 * @returns Promise<SSLResult> - Result of the SSL operation
 */
export const addDomainToSSL = async (domainName: string): Promise<SSLResult> => {
  // Optional pre-check to see if domain might already exist
  try {
    const alreadyExists = await checkDomainInSSLCertificate(domainName);
    if (alreadyExists) {
      console.log(`[SSL] Domain ${domainName} appears to already exist in certificate, proceeding anyway to ensure it's current`);
    }
  } catch (checkError) {
    console.log(`[SSL] Pre-check failed for ${domainName}, proceeding with add operation`);
  }
  return new Promise((resolve) => {
    const frontendIP = process.env.FRONTEND_IP;
    const sshKeyPath = process.env.SSH_KEY_PATH;
    const sshUser = process.env.SSH_USER;
    const sslScriptPath = process.env.SSL_SCRIPT_PATH || '~/add-ssl-domain.sh';

    // Validate required environment variables
    if (!frontendIP) {
      resolve({
        success: false,
        message: 'FRONTEND_IP environment variable is not configured',
        error: 'Missing environment configuration'
      });
      return;
    }

    if (!sshKeyPath) {
      resolve({
        success: false,
        message: 'SSH_KEY_PATH environment variable is not configured',
        error: 'Missing SSH key configuration'
      });
      return;
    }

    if (!sshUser) {
      resolve({
        success: false,
        message: 'SSH_USER environment variable is not configured',
        error: 'Missing SSH user configuration'
      });
      return;
    }

    console.log(`[SSL] Attempting to add domain ${domainName} to SSL certificate on ${frontendIP}`);

    // Expand tilde in SSH key path
    const expandedKeyPath = sshKeyPath.startsWith('~/')
      ? path.join(process.env.HOME || '', sshKeyPath.slice(2))
      : sshKeyPath;

    // SSH command to execute the add-ssl-domain.sh script
    // The script path uses tilde (~) which SSH will expand to the remote user's home directory
    const sshCommand = [
      '-i', expandedKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=30',
      `${sshUser}@${frontendIP}`,
      `${sslScriptPath} ${domainName}`
    ];

    console.log(`[SSL] Executing SSH command: ssh ${sshCommand.join(' ')}`);

    const sshProcess = spawn('ssh', sshCommand, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000 // 5 minute timeout
    });

    let stdout = '';
    let stderr = '';

    // Capture stdout
    sshProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[SSL] stdout: ${output.trim()}`);
    });

    // Capture stderr
    sshProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log(`[SSL] stderr: ${output.trim()}`);
    });

    // Handle process completion
    sshProcess.on('close', (code) => {
      console.log(`[SSL] SSH process completed with exit code: ${code}`);
      
      // Check for specific success patterns or duplicate domain scenarios
      const outputLower = stdout.toLowerCase();
      const stderrLower = stderr.toLowerCase();
      
      // Common patterns that indicate the domain is already in the certificate
      const duplicatePatterns = [
        'domain already exists',
        'already present in certificate',
        'certificate already contains',
        'domain is already included',
        'no change needed',
        'certificate already up to date'
      ];
      
      const isDuplicateDomain = duplicatePatterns.some(pattern => 
        outputLower.includes(pattern) || stderrLower.includes(pattern)
      );
      
      if (code === 0) {
        resolve({
          success: true,
          message: `SSL certificate updated successfully for domain ${domainName}`,
          output: stdout
        });
      } else if (isDuplicateDomain) {
        // Treat duplicate domain as success since the desired outcome is achieved
        console.log(`[SSL] Domain ${domainName} already exists in SSL certificate - treating as success`);
        resolve({
          success: true,
          message: `SSL certificate already includes domain ${domainName}`,
          output: stdout,
          note: 'Domain was already present in certificate'
        });
      } else {
        resolve({
          success: false,
          message: `SSL certificate update failed for domain ${domainName}`,
          error: stderr || `Process exited with code ${code}`,
          output: stdout
        });
      }
    });

    // Handle process errors
    sshProcess.on('error', (error) => {
      console.error(`[SSL] SSH process error:`, error);
      resolve({
        success: false,
        message: `SSH connection failed for domain ${domainName}`,
        error: error.message
      });
    });

    // Handle timeout
    sshProcess.on('timeout', () => {
      console.error(`[SSL] SSH process timed out for domain ${domainName}`);
      sshProcess.kill('SIGKILL');
      resolve({
        success: false,
        message: `SSL certificate update timed out for domain ${domainName}`,
        error: 'Operation timed out after 5 minutes'
      });
    });
  });
};

/**
 * Validate domain name format before SSL operations
 * @param domainName - The domain name to validate
 * @returns boolean - True if domain is valid
 */
export const validateDomainForSSL = (domainName: string): boolean => {
  // Basic domain validation regex
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Check format and length
  if (!domainRegex.test(domainName) || domainName.length > 253) {
    return false;
  }

  // Additional validation: must not start or end with hyphen
  const parts = domainName.split('.');
  for (const part of parts) {
    if (part.startsWith('-') || part.endsWith('-')) {
      return false;
    }
  }

  return true;
};

/**
 * Check if domain should be automatically added to SSL certificate
 * All valid domains that point to the correct IP should have SSL certificates
 * @param domainName - The domain name to check
 * @returns boolean - True if domain should be added to SSL
 */
export const shouldAutoAddToSSL = (domainName: string): boolean => {
  // Validate domain format first
  return validateDomainForSSL(domainName);
};

/**
 * Check if domain is a melt-records.com subdomain (for backwards compatibility)
 * @param domainName - The domain name to check
 * @returns boolean - True if domain is a melt-records.com subdomain
 */
export const isMeltRecordsSubdomain = (domainName: string): boolean => {
  const baseDomain = process.env.LIGHTSAIL_DOMAIN || 'melt-records.com';
  return domainName.endsWith(`.${baseDomain}`) && domainName !== baseDomain;
};

/**
 * Check if a domain might already exist in the SSL certificate
 * This is a pre-check that can help avoid unnecessary SSL operations
 * @param domainName - The domain name to check
 * @returns Promise<boolean> - True if domain might already exist
 */
export const checkDomainInSSLCertificate = async (domainName: string): Promise<boolean> => {
  try {
    const frontendIP = process.env.FRONTEND_IP;
    const sshKeyPath = process.env.SSH_KEY_PATH;
    const sshUser = process.env.SSH_USER;
    
    if (!frontendIP || !sshKeyPath || !sshUser) {
      console.log(`[SSL Check] Missing environment configuration, skipping certificate check for ${domainName}`);
      return false;
    }
    
    // Expand tilde in SSH key path
    const expandedKeyPath = sshKeyPath.startsWith('~/') 
      ? path.join(process.env.HOME || '', sshKeyPath.slice(2))
      : sshKeyPath;
    
    return new Promise((resolve) => {
      const sshCommand = [
        '-i', expandedKeyPath,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ConnectTimeout=10',
        `${sshUser}@${frontendIP}`,
        `openssl x509 -in /etc/letsencrypt/live/*/cert.pem -text -noout | grep -i "${domainName}" || echo "not found"`
      ];
      
      const sshProcess = spawn('ssh', sshCommand, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout for check
      });
      
      let stdout = '';
      
      sshProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      sshProcess.on('close', (code) => {
        const found = !stdout.toLowerCase().includes('not found') && stdout.trim().length > 0;
        console.log(`[SSL Check] Domain ${domainName} certificate check: ${found ? 'FOUND' : 'NOT FOUND'}`);
        resolve(found);
      });
      
      sshProcess.on('error', () => {
        console.log(`[SSL Check] Error checking certificate for ${domainName}, assuming not found`);
        resolve(false);
      });
      
      sshProcess.on('timeout', () => {
        console.log(`[SSL Check] Timeout checking certificate for ${domainName}, assuming not found`);
        sshProcess.kill('SIGKILL');
        resolve(false);
      });
    });
  } catch (error) {
    console.log(`[SSL Check] Exception checking certificate for ${domainName}:`, error);
    return false;
  }
};

/**
 * Log SSL operation result for debugging and monitoring
 * @param domainName - The domain name
 * @param result - The SSL operation result
 */
export const logSSLOperation = (domainName: string, result: SSLResult): void => {
  const timestamp = new Date().toISOString();
  const status = result.success ? 'SUCCESS' : 'FAILED';
  
  console.log(`[SSL] ${timestamp} - ${status} - Domain: ${domainName} - ${result.message}`);
  
  if (result.note) {
    console.log(`[SSL] Note: ${result.note}`);
  }
  
  if (result.error) {
    console.error(`[SSL] Error details: ${result.error}`);
  }
  
  if (result.output) {
    console.log(`[SSL] Output: ${result.output}`);
  }
};