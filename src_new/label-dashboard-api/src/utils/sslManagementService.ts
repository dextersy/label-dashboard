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
}

/**
 * Add a domain to the SSL certificate by executing the add-ssl-domain.sh script on the frontend server
 * @param domainName - The domain name to add to the SSL certificate
 * @returns Promise<SSLResult> - Result of the SSL operation
 */
export const addDomainToSSL = async (domainName: string): Promise<SSLResult> => {
  return new Promise((resolve) => {
    const frontendIP = process.env.FRONTEND_IP;
    const sshKeyPath = process.env.SSH_KEY_PATH;
    const sshUser = process.env.SSH_USER;
    
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
    const sshCommand = [
      '-i', expandedKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=30',
      `${sshUser}@${frontendIP}`,
      `./add-ssl-domain.sh ${domainName}`
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
      
      if (code === 0) {
        resolve({
          success: true,
          message: `SSL certificate updated successfully for domain ${domainName}`,
          output: stdout
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
 * Only melt-records.com subdomains are automatically added
 * @param domainName - The domain name to check
 * @returns boolean - True if domain should be added to SSL
 */
export const shouldAutoAddToSSL = (domainName: string): boolean => {
  const baseDomain = process.env.LIGHTSAIL_DOMAIN || 'melt-records.com';
  return domainName.endsWith(`.${baseDomain}`) && domainName !== baseDomain;
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
  
  if (result.error) {
    console.error(`[SSL] Error details: ${result.error}`);
  }
  
  if (result.output) {
    console.log(`[SSL] Output: ${result.output}`);
  }
};