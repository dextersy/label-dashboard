import { Handler, ScheduledEvent } from 'aws-lambda';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface SublabelPayoutResult {
  brand_id: number;
  sublabel_id: number;
  sublabel_name: string;
  parent_brand_name: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  amount: number;
  transfer_amount: number;
  processing_fee: number;
  payment_id: number | null;
  transfer_id: string | null;
  reference_number: string | null;
}

interface AutoPayoutResponse {
  brands: SublabelPayoutResult[];
  summary: {
    total_paid: number;
    brands_processed: number;
    brands_skipped: number;
    brands_errored: number;
  };
}

interface SublabelsDuePaymentResponse {
  total: number;
  results: Array<{
    sublabel_id: number;
    parent_brand_id: number;
    admin_emails: string[];
  }>;
}

class LabelAutopayoutService {
  private transporter: nodemailer.Transporter;
  private apiBaseUrl: string;
  private superadminEmail: string;
  private fromEmail: string;
  private authToken: string | null = null;

  constructor() {
    const requiredEnvVars = [
      'API_BASE_URL',
      'API_USERNAME',
      'API_PASSWORD',
      'SUPERADMIN_EMAIL',
      'FROM_EMAIL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
    ];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.apiBaseUrl = process.env.API_BASE_URL!;
    this.superadminEmail = process.env.SUPERADMIN_EMAIL!;
    this.fromEmail = process.env.FROM_EMAIL!;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT!),
      secure: process.env.SMTP_SECURE === 'ssl',
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }

  private async authenticate(): Promise<void> {
    console.log('Authenticating with System API...');
    const response = await axios.post(`${this.apiBaseUrl}/api/system/auth/login`, {
      email: process.env.API_USERNAME,
      password: process.env.API_PASSWORD,
    });
    if (response.data && response.data.token) {
      this.authToken = response.data.token;
      console.log('Successfully authenticated with System API');
    } else {
      throw new Error('No token received from System API');
    }
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.authToken}` };
  }

  private async apiPost<T>(endpoint: string): Promise<T> {
    if (!this.authToken) await this.authenticate();

    const doRequest = async (): Promise<T> => {
      const response = await axios.post<T>(`${this.apiBaseUrl}${endpoint}`, {}, {
        headers: this.authHeaders(),
      });
      return response.data;
    };

    try {
      return await doRequest();
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Token expired, re-authenticating...');
        await this.authenticate();
        return doRequest();
      }
      throw error;
    }
  }

  private async apiGet<T>(endpoint: string): Promise<T> {
    if (!this.authToken) await this.authenticate();

    const doRequest = async (): Promise<T> => {
      const response = await axios.get<T>(`${this.apiBaseUrl}${endpoint}`, {
        headers: this.authHeaders(),
      });
      return response.data;
    };

    try {
      return await doRequest();
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Token expired, re-authenticating...');
        await this.authenticate();
        return doRequest();
      }
      throw error;
    }
  }

  async processPayouts(dryRun = false): Promise<AutoPayoutResponse> {
    const endpoint = dryRun
      ? '/api/system/process-label-autopayouts?dry_run=true'
      : '/api/system/process-label-autopayouts';
    console.log(`Triggering label auto-payout via System API${dryRun ? ' (DRY RUN)' : ''}...`);
    const result = await this.apiPost<AutoPayoutResponse>(endpoint);
    console.log(
      `Label auto-payout complete. Processed: ${result.summary.brands_processed}, ` +
      `skipped: ${result.summary.brands_skipped}, ` +
      `errored: ${result.summary.brands_errored}, ` +
      `total paid: ₱${result.summary.total_paid.toFixed(2)}`
    );
    return result;
  }

  private async fetchAdminEmailsByParentBrand(): Promise<Map<number, string[]>> {
    // parent_brand_id → admin emails of sublabel admins
    const response = await this.apiGet<SublabelsDuePaymentResponse>(
      '/api/system/sublabels-due-payment?include_admin_emails=true'
    );
    const map = new Map<number, string[]>();
    for (const sublabel of response.results) {
      const existing = map.get(sublabel.parent_brand_id) || [];
      map.set(sublabel.parent_brand_id, [...existing, ...(sublabel.admin_emails || [])]);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Email generation
  // ---------------------------------------------------------------------------

  private generateSuperadminEmailHTML(result: AutoPayoutResponse): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const hasErrors = result.summary.brands_errored > 0;
    const headerGradient = hasErrors
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #059669 0%, #065f46 100%)';

    const rows = result.brands.map(b => {
      const statusColor = b.status === 'error' ? '#dc2626' : b.status === 'success' ? '#059669' : '#6b7280';
      const statusLabel = b.status === 'error' ? 'Error' : b.status === 'success' ? 'Paid' : 'Skipped';
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">
            ${b.sublabel_name}
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${b.parent_brand_name}</div>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${b.status === 'success' ? '#059669' : '#6b7280'};">
            ₱${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="background-color: ${statusColor}; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">${statusLabel}</span>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">${b.reason || b.reference_number || '—'}</td>
        </tr>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Label Auto-Payout Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px; background: ${headerGradient}; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">Label Auto-Payout Report</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${currentDate}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 16px; background-color: #f0fdf4; border-radius: 6px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em;">Total Paid Out</p>
                    <p style="margin: 0; font-size: 26px; font-weight: 700; color: #059669;">
                      ₱${result.summary.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td style="width: 12px;"></td>
                  <td style="padding: 16px; background-color: #f0fdf4; border-radius: 6px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em;">Sublabels Paid</p>
                    <p style="margin: 0; font-size: 26px; font-weight: 700; color: #059669;">${result.summary.brands_processed}</p>
                  </td>
                  <td style="width: 12px;"></td>
                  <td style="padding: 16px; background-color: ${hasErrors ? '#fef2f2' : '#f0fdf4'}; border-radius: 6px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: ${hasErrors ? '#991b1b' : '#065f46'}; text-transform: uppercase; letter-spacing: 0.05em;">Errors</p>
                    <p style="margin: 0; font-size: 26px; font-weight: 700; color: ${hasErrors ? '#dc2626' : '#059669'};">${result.summary.brands_errored}</p>
                  </td>
                </tr>
              </table>

              ${result.brands.length > 0 ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Sublabel</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Status</th>
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Reference / Reason</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>` : `
              <div style="text-align: center; padding: 32px; background-color: #f9fafb; border-radius: 6px;">
                <p style="margin: 0; color: #6b7280;">No sublabels qualified for payout today.</p>
              </div>`}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Label Auto-Payout job.
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Report generated on ${new Date().toLocaleString('en-US')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendSuperadminEmail(result: AutoPayoutResponse): Promise<void> {
    const hasErrors = result.summary.brands_errored > 0;
    const subject = hasErrors
      ? `⚠️ Label Auto-Payout Report — ${result.summary.brands_errored} error(s), ₱${result.summary.total_paid.toFixed(2)} paid`
      : `Label Auto-Payout Complete — ₱${result.summary.total_paid.toFixed(2)} paid to ${result.summary.brands_processed} sublabel(s)`;

    const info = await this.transporter.sendMail({
      from: `System Notifications <${this.fromEmail}>`,
      to: this.superadminEmail,
      subject: `[label-autopayout] ${subject}`,
      html: this.generateSuperadminEmailHTML(result),
    });
    console.log('Superadmin payout report sent. Message ID:', info.messageId);
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  async run(dryRun = false): Promise<{ brands_processed: number; total_paid: number; brands_errored: number }> {
    if (dryRun) console.log('[DRY RUN] No real payouts will be triggered.');
    console.log('Starting label auto-payout process...');

    await this.authenticate();

    const result = await this.processPayouts(dryRun);
    await this.sendSuperadminEmail(result);

    console.log('Label auto-payout process completed.');

    return {
      brands_processed: result.summary.brands_processed,
      total_paid: result.summary.total_paid,
      brands_errored: result.summary.brands_errored,
    };
  }
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  const dryRun = process.env.DRY_RUN === 'true';
  console.log('Label Auto-Payout Lambda triggered', { event, context, dryRun });

  try {
    const service = new LabelAutopayoutService();
    const result = await service.run(dryRun);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Label auto-payout completed',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Label auto-payout failed',
        error: error.message,
      }),
    };
  }
};
