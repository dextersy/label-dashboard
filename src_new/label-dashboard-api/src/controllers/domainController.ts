import { Request, Response } from 'express';
import { Domain } from '../models';
import { auditLogger } from '../utils/auditLogger';
import { promises as dns } from 'dns';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Domain Controller
 *
 * Handles domain-related operations for system users.
 * All endpoints return domain data across all brands.
 *
 * Security: All methods assume authentication has been verified by middleware
 */

/**
 * Resolve domain to IP addresses
 */
async function resolveDomainToIPs(domain: string): Promise<string[]> {
  try {
    // Try to resolve A records (IPv4)
    const addresses = await dns.resolve4(domain);
    return addresses;
  } catch (error: any) {
    // If domain doesn't resolve, return empty array
    console.log(`[DNS] Failed to resolve ${domain}: ${error.message}`);
    return [];
  }
}

/**
 * Check if domain points to frontend server
 */
async function domainPointsToFrontend(domain: string, frontendIP: string): Promise<boolean> {
  const resolvedIPs = await resolveDomainToIPs(domain);

  if (resolvedIPs.length === 0) {
    return false;
  }

  // Check if any of the resolved IPs match the frontend IP
  return resolvedIPs.includes(frontendIP);
}

/**
 * Get domains that should have SSL certificates (cross-brand)
 *
 * This endpoint:
 * 1. Fetches ALL domains with status 'Connected' or 'No SSL' across ALL brands
 * 2. Verifies each domain's DNS points to the frontend server
 * 3. Updates domains that don't point to frontend to 'Unverified' status
 * 4. Returns only domains that point to the frontend server
 * 5. Returns frontend server IP for SSL script operations
 *
 * Status meanings:
 * - 'Connected': Domain has SSL and is fully connected
 * - 'No SSL': Domain is verified but doesn't have SSL yet (should be added)
 * - 'Unverified': Domain DNS doesn't point to frontend (automatically set)
 */
export const getSSLDomains = async (req: Request, res: Response) => {
  try {
    console.log('[API] Fetching all domains that should have SSL...');

    // Get frontend IP from environment
    const frontendIP = process.env.FRONTEND_IP;
    if (!frontendIP) {
      throw new Error('FRONTEND_IP environment variable not configured');
    }

    console.log(`[API] Frontend IP: ${frontendIP}`);

    // Query domains with status 'Connected' or 'No SSL'
    const domains = await Domain.findAll({
      where: {
        status: ['Connected', 'No SSL']
      },
      attributes: ['domain_name', 'status', 'brand_id'],
      order: [['domain_name', 'ASC']]
    });

    console.log(`[API] Found ${domains.length} domains in database with SSL-eligible status`);

    // Verify DNS for each domain
    const verifiedDomains: string[] = [];
    const unverifiedDomains: string[] = [];

    for (const domain of domains) {
      console.log(`[DNS] Checking ${domain.domain_name}...`);

      const pointsToFrontend = await domainPointsToFrontend(domain.domain_name, frontendIP);

      if (pointsToFrontend) {
        console.log(`[DNS] ✓ ${domain.domain_name} points to frontend`);
        verifiedDomains.push(domain.domain_name);
      } else {
        console.log(`[DNS] ✗ ${domain.domain_name} does NOT point to frontend`);
        unverifiedDomains.push(domain.domain_name);

        // Update domain status to 'Unverified'
        try {
          await Domain.update(
            { status: 'Unverified' },
            {
              where: {
                domain_name: domain.domain_name,
                brand_id: domain.brand_id
              }
            }
          );
          console.log(`[DB] Updated ${domain.domain_name} status to 'Unverified'`);
        } catch (updateError: any) {
          console.error(`[DB] Failed to update ${domain.domain_name}:`, updateError.message);
        }
      }
    }

    console.log(`[API] Verified: ${verifiedDomains.length}, Unverified: ${unverifiedDomains.length}`);

    // Log data access
    auditLogger.logDataAccess(req, 'ssl-domains', 'READ', verifiedDomains.length, {
      totalQueried: domains.length,
      verified: verifiedDomains.length,
      unverified: unverifiedDomains.length,
      frontendIP
    });

    res.json({
      frontend_ip: frontendIP,
      total: verifiedDomains.length,
      domains: verifiedDomains,
      unverified_domains: unverifiedDomains,
      summary: {
        total_in_database: domains.length,
        verified: verifiedDomains.length,
        unverified: unverifiedDomains.length
      }
    });

  } catch (error: any) {
    console.error('[API] Error fetching SSL domains:', error);
    auditLogger.logSystemAccess(req, 'ERROR_SSL_DOMAINS', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Execute SSH command on frontend server
 */
interface SSHCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

async function executeSSHCommand(command: string, timeout: number = 120000): Promise<SSHCommandResult> {
  return new Promise((resolve) => {
    const frontendIP = process.env.FRONTEND_IP;
    const sshUser = process.env.SSH_USER || 'bitnami';
    const sshKeyPath = process.env.SSH_KEY_PATH;

    if (!frontendIP || !sshKeyPath) {
      resolve({
        success: false,
        output: '',
        error: 'FRONTEND_IP or SSH_KEY_PATH not configured'
      });
      return;
    }

    // Expand tilde in SSH key path
    const expandedKeyPath = sshKeyPath.startsWith('~/')
      ? path.join(process.env.HOME || '', sshKeyPath.slice(2))
      : sshKeyPath;

    const sshCommand = [
      '-i', expandedKeyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=30',
      `${sshUser}@${frontendIP}`,
      command
    ];

    console.log(`[SSH] Executing: ssh ${sshCommand.slice(0, -1).join(' ')} [command]`);

    const sshProcess = spawn('ssh', sshCommand, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout
    });

    let stdout = '';
    let stderr = '';

    sshProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    sshProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    sshProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, output: stdout, error: stderr });
      }
    });

    sshProcess.on('error', (error) => {
      resolve({ success: false, output: '', error: error.message });
    });

    sshProcess.on('timeout', () => {
      sshProcess.kill('SIGKILL');
      resolve({ success: false, output: '', error: 'SSH command timed out' });
    });
  });
}

/**
 * Get domains from SSL certificate
 *
 * Reads the SSL wrapper script and extracts domains
 */
export const getSSLCertDomains = async (req: Request, res: Response) => {
  try {
    console.log('[API] Reading SSL certificate domains from frontend server...');

    const sslWrapperPath = process.env.SSL_WRAPPER_PATH || '/tmp/ssl-renew-wrapper.sh';

    const result = await executeSSHCommand(
      `cat ${sslWrapperPath} | grep -oP '(?<=--domains=)[^\\s]+' || echo ""`
    );

    if (!result.success) {
      console.error('[API] Failed to read SSL wrapper script:', result.error);
      return res.status(500).json({
        error: 'Failed to read SSL certificate domains',
        details: result.error
      });
    }

    const domains = result.output
      .trim()
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0)
      .sort();

    console.log(`[API] Found ${domains.length} domains in SSL certificate`);

    // Log data access
    auditLogger.logDataAccess(req, 'ssl-cert-domains', 'READ', domains.length);

    res.json({
      total: domains.length,
      domains: domains
    });

  } catch (error: any) {
    console.error('[API] Error reading SSL certificate domains:', error);
    auditLogger.logSystemAccess(req, 'ERROR_SSL_CERT_DOMAINS', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Remove domain from SSL certificate
 *
 * Removes a domain from the SSL renewal script without triggering renewal
 */
export const removeSSLDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    console.log(`[API] Removing domain from SSL: ${domain}`);

    const removeScriptPath = process.env.REMOVE_SSL_SCRIPT_PATH || '/home/bitnami/remove-ssl-domain.sh';

    const result = await executeSSHCommand(
      `${removeScriptPath} --no-renew ${domain}`,
      300000 // 5 minute timeout for SSL operations
    );

    if (result.success) {
      console.log(`[API] ✓ Successfully removed ${domain} from SSL`);

      // Log data access
      auditLogger.logDataAccess(req, 'ssl-domain-remove', 'WRITE', 1, { domain });

      res.json({
        success: true,
        message: `Domain ${domain} removed from SSL certificate`,
        domain: domain
      });
    } else {
      console.error(`[API] ✗ Failed to remove ${domain}:`, result.error);

      auditLogger.logSystemAccess(req, 'ERROR_SSL_DOMAIN_REMOVE', {
        requestBody: { domain },
        error: result.error
      });

      res.status(500).json({
        success: false,
        error: 'Failed to remove domain from SSL certificate',
        details: result.error
      });
    }

  } catch (error: any) {
    console.error('[API] Error removing SSL domain:', error);
    auditLogger.logSystemAccess(req, 'ERROR_SSL_DOMAIN_REMOVE', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};
