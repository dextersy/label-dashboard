import { Handler, ScheduledEvent } from 'aws-lambda';
import axios, { AxiosInstance } from 'axios';
import nodemailer from 'nodemailer';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface DomainRecord {
  domain_name: string;
  status: string;
  brand_id: number;
}

interface APIDomainsResponse {
  frontend_ip: string;
  total: number;
  domains: string[];
  unverified_domains: string[];
  summary: {
    total_in_database: number;
    verified: number;
    unverified: number;
  };
}

interface SyncResult {
  domains_removed: string[];
  domains_added: string[];
  errors: string[];
  ssl_domains_before: number;
  ssl_domains_after: number;
  api_domains_count: number;
  unverified_domains_count: number;
}

class SSLDomainSyncService {
  private apiBaseUrl: string;
  private apiUsername: string;
  private apiPassword: string;
  private apiClient: AxiosInstance;
  private accessToken: string | null = null;
  private sendSuccessNotif: boolean;
  private sendErrorNotif: boolean;
  private adminEmail: string;
  private fromEmail: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Validate required environment variables
    const requiredEnvVars = [
      'API_BASE_URL',
      'API_USERNAME',
      'API_PASSWORD',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.apiBaseUrl = process.env.API_BASE_URL!;
    this.apiUsername = process.env.API_USERNAME!;
    this.apiPassword = process.env.API_PASSWORD!;

    // Initialize API client
    this.apiClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Email notification settings
    this.sendSuccessNotif = process.env.SEND_SUCCESS_NOTIF === 'true';
    this.sendErrorNotif = process.env.SEND_ERROR_NOTIF === 'true';
    this.adminEmail = process.env.ADMIN_EMAIL || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@melt-records.com';

    // Initialize SMTP transporter if notifications are enabled
    if (this.sendSuccessNotif || this.sendErrorNotif) {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !this.adminEmail) {
        console.warn('[EMAIL] Notifications enabled but SMTP configuration incomplete');
        console.warn('[EMAIL] Required: SMTP_HOST, SMTP_USER, SMTP_PASS, ADMIN_EMAIL');
      } else {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        console.log('[EMAIL] Email notifications configured');
      }
    }
  }

  /**
   * Authenticate with the system API
   */
  private async authenticateWithAPI(): Promise<void> {
    console.log('[API] Authenticating with system API...');

    try {
      const response = await this.apiClient.post('/api/system/auth/login', {
        email: this.apiUsername,
        password: this.apiPassword,
      });

      this.accessToken = response.data.token;
      console.log('[API] Successfully authenticated');
    } catch (error: any) {
      console.error('[API] Authentication failed:', error.response?.data || error.message);
      throw new Error(`API authentication failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get domains from API that should have SSL certificates
   * Also performs DNS verification and returns frontend IP
   */
  private async getDomainsFromAPI(): Promise<APIDomainsResponse> {
    console.log('[API] Fetching domains with status Connected or No SSL...');
    console.log('[API] API will verify DNS and update unverified domains...');

    if (!this.accessToken) {
      await this.authenticateWithAPI();
    }

    try {
      const response = await this.apiClient.get('/api/system/ssl-domains', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const data: APIDomainsResponse = response.data;

      console.log(`[API] Frontend IP: ${data.frontend_ip}`);
      console.log(`[API] Found ${data.total} verified domains that should have SSL:`);
      data.domains.forEach((domain: string) => console.log(`  - ${domain}`));

      if (data.unverified_domains.length > 0) {
        console.log(`[API] Found ${data.unverified_domains.length} unverified domains (set to Unverified status):`);
        data.unverified_domains.forEach((domain: string) => console.log(`  ✗ ${domain}`));
      }

      return data;
    } catch (error: any) {
      // If authentication expired, retry once
      if (error.response?.status === 401) {
        console.log('[API] Token expired, re-authenticating...');
        await this.authenticateWithAPI();

        const response = await this.apiClient.get('/api/system/ssl-domains', {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        return response.data;
      }

      console.error('[API] Failed to fetch domains:', error.response?.data || error.message);
      throw new Error(`Failed to fetch domains from API: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get domains from SSL certificate via API
   */
  private async getDomainsFromSSLCertificate(): Promise<string[]> {
    console.log('[API] Fetching SSL certificate domains...');

    if (!this.accessToken) {
      await this.authenticateWithAPI();
    }

    try {
      const response = await this.apiClient.get('/api/system/ssl-cert-domains', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const domains = response.data.domains;

      console.log(`[API] Found ${domains.length} domains in SSL certificate:`);
      domains.forEach((domain: string) => console.log(`  - ${domain}`));

      return domains;
    } catch (error: any) {
      // If authentication expired, retry once
      if (error.response?.status === 401) {
        console.log('[API] Token expired, re-authenticating...');
        await this.authenticateWithAPI();

        const response = await this.apiClient.get('/api/system/ssl-cert-domains', {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        return response.data.domains;
      }

      console.error('[API] Failed to fetch SSL certificate domains:', error.response?.data || error.message);
      throw new Error(`Failed to fetch SSL certificate domains from API: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Remove domain from SSL certificate via API (without triggering renewal)
   */
  private async removeDomainFromSSL(domain: string): Promise<boolean> {
    console.log(`[API] Removing domain: ${domain}`);

    if (!this.accessToken) {
      await this.authenticateWithAPI();
    }

    try {
      const response = await this.apiClient.post('/api/system/ssl-domain/remove', {
        domain: domain
      }, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (response.data.success) {
        console.log(`[API] ✓ Successfully removed: ${domain}`);
        return true;
      } else {
        console.error(`[API] ✗ Failed to remove ${domain}:`, response.data.error);
        return false;
      }
    } catch (error: any) {
      // If authentication expired, retry once
      if (error.response?.status === 401) {
        console.log('[API] Token expired, re-authenticating...');
        await this.authenticateWithAPI();

        const response = await this.apiClient.post('/api/system/ssl-domain/remove', {
          domain: domain
        }, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        return response.data.success === true;
      }

      console.error(`[API] ✗ Failed to remove ${domain}:`, error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Generate HTML email for notification
   */
  private generateEmailHTML(result: SyncResult, isError: boolean): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const statusColor = isError ? '#dc2626' : '#059669';
    const statusBg = isError ? '#fef2f2' : '#f0fdf4';
    const statusIcon = isError ? '⚠️' : '✓';
    const statusTitle = isError ? 'SSL Domain Sync - Action Required' : 'SSL Domain Sync - Success';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; text-align: center;">
                ${statusIcon} ${statusTitle}
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; text-align: center; font-size: 14px;">
                ${currentDate}
              </p>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 32px;">
              <div style="background-color: ${statusBg}; border-left: 4px solid ${statusColor}; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; color: ${statusColor}; font-size: 18px; font-weight: 600;">
                  Synchronization Summary
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Orphaned domains removed:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${statusColor};">${result.domains_removed.length}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">SSL domains before:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${result.ssl_domains_before}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">SSL domains after:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${result.ssl_domains_after}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">API verified domains:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600;">${result.api_domains_count}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">API unverified domains:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${result.unverified_domains_count > 0 ? '#f59e0b' : '#059669'};">${result.unverified_domains_count}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #374151; font-size: 14px;">Errors:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${result.errors.length > 0 ? '#dc2626' : '#059669'};">${result.errors.length}</td>
                  </tr>
                </table>
              </div>

              ${result.domains_removed.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">Removed Domains</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151;">
                  ${result.domains_removed.map(d => `<li style="margin: 4px 0;">${d}</li>`).join('')}
                </ul>
                <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 14px; font-style: italic;">
                  These domains were removed from the SSL renewal script and will not be included in the next renewal.
                </p>
              </div>
              ` : ''}

              ${result.unverified_domains_count > 0 ? `
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #f59e0b; font-size: 16px; font-weight: 600;">⚠️ Unverified Domains</h3>
                <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
                  ${result.unverified_domains_count} domain(s) were automatically set to 'Unverified' status because their DNS does not point to the frontend server.
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 14px; font-style: italic;">
                  These domains were also removed from the SSL renewal script. To re-enable them, update their DNS records to point to the frontend server.
                </p>
              </div>
              ` : ''}

              ${result.errors.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #dc2626; font-size: 16px; font-weight: 600;">⚠️ Errors</h3>
                <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
                  ${result.errors.map(e => `<li style="margin: 4px 0;">${e}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  <strong>Note:</strong> Removed domains will be excluded from the next SSL renewal. The current SSL certificate remains valid and unchanged.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report from SSL Domain Sync Lambda
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                ${new Date().toLocaleString('en-US')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email for notification
   */
  private generateEmailText(result: SyncResult, isError: boolean): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let text = `SSL DOMAIN SYNCHRONIZATION ${isError ? '- ACTION REQUIRED' : '- SUCCESS'}\n`;
    text += `${currentDate}\n\n`;
    text += `===========================================\n\n`;
    text += `SUMMARY:\n`;
    text += `  Orphaned domains removed: ${result.domains_removed.length}\n`;
    text += `  SSL domains before: ${result.ssl_domains_before}\n`;
    text += `  SSL domains after: ${result.ssl_domains_after}\n`;
    text += `  API verified domains: ${result.api_domains_count}\n`;
    text += `  API unverified domains: ${result.unverified_domains_count}\n`;
    text += `  Errors: ${result.errors.length}\n\n`;

    if (result.domains_removed.length > 0) {
      text += `REMOVED DOMAINS:\n`;
      result.domains_removed.forEach(d => {
        text += `  - ${d}\n`;
      });
      text += `\nThese domains were removed from the SSL renewal script.\n\n`;
    }

    if (result.unverified_domains_count > 0) {
      text += `UNVERIFIED DOMAINS:\n`;
      text += `  ${result.unverified_domains_count} domain(s) were set to 'Unverified' status\n`;
      text += `  because their DNS does not point to the frontend server.\n`;
      text += `  These domains were also removed from the SSL renewal script.\n\n`;
    }

    if (result.errors.length > 0) {
      text += `ERRORS:\n`;
      result.errors.forEach(e => {
        text += `  - ${e}\n`;
      });
      text += `\n`;
    }

    text += `===========================================\n\n`;
    text += `Note: Removed domains will be excluded from the next SSL renewal.\n`;
    text += `The current SSL certificate remains valid and unchanged.\n\n`;
    text += `Report generated: ${new Date().toLocaleString('en-US')}\n`;

    return text;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(result: SyncResult, isError: boolean): Promise<void> {
    if (!this.transporter || !this.adminEmail) {
      console.log('[EMAIL] Email not configured, skipping notification');
      return;
    }

    const subject = isError
      ? `⚠️ SSL Domain Sync - ${result.domains_removed.length} Domains Removed${result.errors.length > 0 ? ' (Errors)' : ''}`
      : `✓ SSL Domain Sync - Success (No Changes)`;

    const htmlBody = this.generateEmailHTML(result, isError);
    const textBody = this.generateEmailText(result, isError);

    const mailOptions = {
      from: `SSL Domain Sync <${this.fromEmail}>`,
      to: this.adminEmail,
      subject: `[sync-ssl-domains] ${subject}`,
      html: htmlBody,
      text: textBody,
    };

    try {
      console.log(`[EMAIL] Sending notification to ${this.adminEmail}...`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Email sent successfully. Message ID:', info.messageId);
    } catch (error: any) {
      console.error('[EMAIL] Error sending email:', error.message);
    }
  }

  /**
   * Main synchronization logic
   */
  async synchronizeDomains(): Promise<SyncResult> {
    console.log('='.repeat(80));
    console.log('Starting SSL domain synchronization...');
    console.log('='.repeat(80));

    const result: SyncResult = {
      domains_removed: [],
      domains_added: [],
      errors: [],
      ssl_domains_before: 0,
      ssl_domains_after: 0,
      api_domains_count: 0,
      unverified_domains_count: 0,
    };

    try {
      // Step 1: Get domains from API (includes DNS verification)
      const apiResponse = await this.getDomainsFromAPI();
      const dbDomains = apiResponse.domains;
      result.api_domains_count = dbDomains.length;
      result.unverified_domains_count = apiResponse.unverified_domains.length;

      console.log(`\n[INFO] Frontend IP: ${apiResponse.frontend_ip} (DNS-verified domains only)`);

      // Step 2: Get domains from SSL certificate (via API)
      const sslDomainsBefore = await this.getDomainsFromSSLCertificate();
      result.ssl_domains_before = sslDomainsBefore.length;

      // Step 3: Find orphaned domains (in SSL but not in DB)
      // NOTE: We only remove orphaned domains, we don't add missing domains
      // Missing domains should be added manually by users via the admin interface

      // IMPORTANT: Never remove dashboard.melt-records.com (primary domain for certificate naming)
      const primaryDomain = 'dashboard.melt-records.com';
      const domainsToRemove = sslDomainsBefore
        .filter(d => !dbDomains.includes(d))
        .filter(d => d !== primaryDomain);  // Never remove primary domain

      const domainsMissingFromSSL = dbDomains.filter(d => !sslDomainsBefore.includes(d));

      console.log('\n' + '='.repeat(80));
      console.log('SYNCHRONIZATION PLAN');
      console.log('='.repeat(80));
      console.log(`Primary domain (always first, never removed): ${primaryDomain}`);
      console.log(`Domains in API: ${dbDomains.length}`);
      console.log(`Domains in SSL certificate: ${sslDomainsBefore.length}`);
      console.log(`Orphaned domains (to remove): ${domainsToRemove.length}`);
      if (domainsMissingFromSSL.length > 0) {
        console.log(`Domains missing from SSL (manual add required): ${domainsMissingFromSSL.length}`);
        domainsMissingFromSSL.forEach(domain => console.log(`  ⚠️  ${domain} - Not in SSL certificate`));
      }

      // Check if primary domain would have been removed (but is protected)
      const wouldRemovePrimary = sslDomainsBefore.includes(primaryDomain) && !dbDomains.includes(primaryDomain);
      if (wouldRemovePrimary) {
        console.log(`\n✓ ${primaryDomain} is protected from removal (primary domain)`);
      }

      if (domainsToRemove.length === 0) {
        console.log('\n✓ No orphaned domains found - SSL renewal script is clean!');
        if (domainsMissingFromSSL.length > 0) {
          console.log(`⚠️  Note: ${domainsMissingFromSSL.length} domain(s) in API are missing from SSL`);
          console.log('   These should be added manually via the admin interface');
        }
        result.ssl_domains_after = sslDomainsBefore.length;
        return result;
      }

      console.log('\n' + '='.repeat(80));
      console.log('EXECUTING SYNCHRONIZATION (REMOVAL ONLY)');
      console.log('='.repeat(80));

      // Step 4: Remove orphaned domains from SSL renewal script
      console.log(`\nRemoving ${domainsToRemove.length} orphaned domain(s) from SSL renewal script...`);
      console.log('NOTE: This will NOT trigger an immediate SSL renewal');
      console.log('      The current SSL certificate remains valid');
      console.log('      Domains will be excluded from the next scheduled renewal\n');

      for (const domain of domainsToRemove) {
        const success = await this.removeDomainFromSSL(domain);
        if (success) {
          result.domains_removed.push(domain);
        } else {
          result.errors.push(`Failed to remove domain: ${domain}`);
        }
      }

      // Step 6: Verify final state
      console.log('\n' + '='.repeat(80));
      console.log('VERIFICATION');
      console.log('='.repeat(80));

      const sslDomainsAfter = await this.getDomainsFromSSLCertificate();
      result.ssl_domains_after = sslDomainsAfter.length;

      console.log('\n' + '='.repeat(80));
      console.log('SYNCHRONIZATION COMPLETE');
      console.log('='.repeat(80));
      console.log(`✓ Orphaned domains removed: ${result.domains_removed.length}`);
      console.log(`✗ Errors: ${result.errors.length}`);
      console.log(`\nSSL domains before: ${result.ssl_domains_before}`);
      console.log(`SSL domains after: ${result.ssl_domains_after}`);
      console.log(`API verified domains: ${result.api_domains_count}`);
      console.log(`API unverified domains: ${result.unverified_domains_count}`);

      if (result.unverified_domains_count > 0) {
        console.log(`\n⚠️  ${result.unverified_domains_count} domain(s) were set to 'Unverified' (DNS doesn't point to frontend)`);
      }

      if (domainsMissingFromSSL.length > 0) {
        console.log(`\n⚠️  Domains in API but not in SSL: ${domainsMissingFromSSL.length}`);
        console.log('   These must be added manually via the admin interface');
      }

      if (result.errors.length > 0) {
        console.log('\nErrors encountered:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }

      console.log('\nℹ️  Note: Removed domains will be excluded from the next SSL renewal');
      console.log('   The current SSL certificate remains valid until next renewal');

      // Send email notification if configured
      const hasErrors = result.errors.length > 0 || result.domains_removed.length > 0;
      if (hasErrors && this.sendErrorNotif) {
        console.log('\n[EMAIL] Sending error/removal notification...');
        await this.sendEmailNotification(result, true);
      } else if (!hasErrors && this.sendSuccessNotif) {
        console.log('\n[EMAIL] Sending success notification...');
        await this.sendEmailNotification(result, false);
      } else {
        console.log('\n[EMAIL] Email notifications disabled or not applicable');
      }

      return result;

    } catch (error: any) {
      console.error('Synchronization failed:', error.message);
      result.errors.push(`Critical error: ${error.message}`);

      // Send error notification on critical failure
      if (this.sendErrorNotif) {
        console.log('\n[EMAIL] Sending critical error notification...');
        try {
          await this.sendEmailNotification(result, true);
        } catch (emailError: any) {
          console.error('[EMAIL] Failed to send error notification:', emailError.message);
        }
      }

      throw error;
    }
  }
}

/**
 * Lambda handler function
 */
export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('SSL Domain Sync Lambda triggered', { event, context });

  try {
    const service = new SSLDomainSyncService();
    const result = await service.synchronizeDomains();

    const success = result.errors.length === 0;

    return {
      statusCode: success ? 200 : 207, // 207 = Multi-Status (partial success)
      body: JSON.stringify({
        message: success ? 'SSL domain synchronization completed successfully' : 'SSL domain synchronization completed with errors',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'SSL domain synchronization failed',
        error: error.message,
      }),
    };
  }
};
