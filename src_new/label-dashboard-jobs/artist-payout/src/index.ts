import { Handler, ScheduledEvent } from 'aws-lambda';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface ArtistPaid {
  artist_id: number;
  artist_name: string;
  amount: number;
  transfer_amount: number;
  processing_fee: number;
  payment_id: number;
  transfer_id: string;
  reference_number: string;
}

interface ArtistSkipped {
  artist_id: number;
  artist_name: string;
  amount: number;
  reason: string;
}

interface BrandPayoutResult {
  brand_id: number;
  brand_name: string;
  logo_url: string | null;
  send_artist_balance_reminders: boolean;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  total_paid: number;
  paid_count: number;
  artists_paid: ArtistPaid[];
  artists_skipped: ArtistSkipped[];
}

interface PayoutResponse {
  dry_run: boolean;
  brands: BrandPayoutResult[];
  summary: {
    total_paid: number;
    total_brands_processed: number;
    total_brands_skipped: number;
    total_brands_errored: number;
    paid_count: number;
  };
}

interface ArtistsDuePaymentResponse {
  brands: {
    brand_id: number;
    admin_emails: string[];
  }[];
}

class ArtistPayoutService {
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
    try {
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
    } catch (error: any) {
      console.error('System authentication failed:', error.response?.data ?? error.message);
      throw error;
    }
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.authToken}` };
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

  private async apiPost<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    if (!this.authToken) await this.authenticate();

    const doRequest = async (): Promise<T> => {
      const response = await axios.post<T>(`${this.apiBaseUrl}${endpoint}`, {}, {
        headers: this.authHeaders(),
        params,
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

  async processPayouts(dryRun: boolean): Promise<PayoutResponse> {
    console.log(`Triggering artist payout via System API${dryRun ? ' (DRY RUN)' : ''}...`);
    const params = dryRun ? { dry_run: 'true' } : undefined;
    const result = await this.apiPost<PayoutResponse>('/api/system/process-artist-payouts', params);
    console.log(
      `Payouts ${dryRun ? '(DRY RUN) ' : ''}complete. Brands processed: ${result.summary.total_brands_processed}, ` +
      `errored: ${result.summary.total_brands_errored}, ` +
      `total paid: ₱${result.summary.total_paid.toFixed(2)}`
    );
    return result;
  }

  private async fetchAdminEmailsByBrand(): Promise<Map<number, string[]>> {
    const response = await this.apiGet<ArtistsDuePaymentResponse>('/api/system/artists-due-payment');
    return new Map(response.brands.map(b => [b.brand_id, b.admin_emails]));
  }

  // ---------------------------------------------------------------------------
  // Email generation
  // ---------------------------------------------------------------------------

  private generateSuperadminEmailHTML(result: PayoutResponse): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const errorBrands = result.brands.filter(b => b.status === 'error');
    const hasErrors = errorBrands.length > 0;
    const headerGradient = hasErrors
      ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      : 'linear-gradient(135deg, #059669 0%, #065f46 100%)';

    const renderArtistRows = (artists: ArtistPaid[]) =>
      artists.map(a => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${a.artist_name}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-weight: 600;">
            ₱${a.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; font-size: 12px;">${a.reference_number || '—'}</td>
        </tr>`).join('');

    const renderSkippedRows = (artists: ArtistSkipped[]) =>
      artists.map(a => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${a.artist_name}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
            ₱${a.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-size: 12px;">${a.reason}</td>
        </tr>`).join('');

    const brandSections = result.brands.map(brand => {
      if (brand.status === 'skipped' && brand.artists_paid.length === 0 && brand.artists_skipped.length === 0) return '';

      const statusColor = brand.status === 'error' ? '#dc2626' : brand.status === 'success' ? '#059669' : '#6b7280';
      const statusLabel = brand.status === 'error' ? 'Error' : brand.status === 'success' ? 'Paid' : 'Skipped';

      return `
        <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="padding: 12px 16px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
            <span style="font-weight: 700; color: #111827; font-size: 15px;">${brand.brand_name}</span>
            <span style="background-color: ${statusColor}; color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 10px;">${statusLabel}</span>
          </div>
          ${brand.status === 'error' ? `
          <div style="padding: 10px 16px; background-color: #fef2f2; border-bottom: 1px solid #fee2e2;">
            <p style="margin: 0; color: #dc2626; font-size: 13px;">⚠️ ${brand.reason}</p>
          </div>` : ''}
          ${brand.artists_paid.length > 0 ? `
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f0fdf4;">
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #065f46; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Artist</th>
                <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #065f46; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Amount</th>
                <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #065f46; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Reference</th>
              </tr>
            </thead>
            <tbody>${renderArtistRows(brand.artists_paid)}</tbody>
          </table>
          <div style="padding: 10px 16px; background-color: #f0fdf4; text-align: right;">
            <strong style="color: #059669;">
              Total paid: ₱${brand.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>` : ''}
          ${brand.artists_skipped.length > 0 ? `
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fafafa;">
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Skipped Artist</th>
                <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Balance</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Reason</th>
              </tr>
            </thead>
            <tbody>${renderSkippedRows(brand.artists_skipped)}</tbody>
          </table>` : ''}
        </div>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artist Payout Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px; background: ${headerGradient}; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">Artist Payout Report</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${currentDate}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <!-- Summary cards -->
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
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em;">Artists Paid</p>
                    <p style="margin: 0; font-size: 26px; font-weight: 700; color: #059669;">${result.summary.paid_count}</p>
                  </td>
                  <td style="width: 12px;"></td>
                  <td style="padding: 16px; background-color: ${result.summary.total_brands_errored > 0 ? '#fef2f2' : '#f0fdf4'}; border-radius: 6px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: ${result.summary.total_brands_errored > 0 ? '#991b1b' : '#065f46'}; text-transform: uppercase; letter-spacing: 0.05em;">Brands Errored</p>
                    <p style="margin: 0; font-size: 26px; font-weight: 700; color: ${result.summary.total_brands_errored > 0 ? '#dc2626' : '#059669'};">${result.summary.total_brands_errored}</p>
                  </td>
                </tr>
              </table>

              ${hasErrors ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">
                  ⚠️ ${errorBrands.length} brand${errorBrands.length === 1 ? '' : 's'} could not be paid out due to insufficient wallet funds.
                  Please top up the affected Paymongo wallet${errorBrands.length === 1 ? '' : 's'} and re-run the payout job.
                </p>
              </div>` : ''}

              ${brandSections}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Artist Payout job.
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

  private generateBrandPayoutEmailHTML(brand: BrandPayoutResult): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const logoHtml = brand.logo_url
      ? `<img src="${brand.logo_url}" alt="${brand.brand_name}" style="max-width: 150px; max-height: 60px; height: auto;" />`
      : `<div style="font-size: 22px; font-weight: bold; color: #ffffff;">${brand.brand_name}</div>`;

    const isError = brand.status === 'error';

    const paidRows = brand.artists_paid.map(a => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${a.artist_name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #059669;">
          ₱${a.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>`).join('');

    const skippedRows = brand.artists_skipped.map(a => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${a.artist_name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          ₱${a.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-size: 13px;">${a.reason}</td>
      </tr>`).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artist Payout ${isError ? 'Error' : 'Complete'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 24px; background-color: #222222; border-radius: 8px 8px 0 0; text-align: center;">
              ${logoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 700;">
                Artist Payout ${isError ? 'Error' : 'Complete'}
              </h2>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">${currentDate}</p>

              ${isError ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Payout Failed</p>
                <p style="margin: 0; color: #dc2626; font-size: 14px;">${brand.reason}</p>
                <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 13px;">Please top up your Paymongo wallet and re-run the payout job.</p>
              </div>` : `
              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px 0; color: #065f46; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Paid Out</p>
                <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">
                  ₱${brand.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>`}

              ${brand.artists_paid.length > 0 ? `
              <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">Artists Paid</h3>
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Artist</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>${paidRows}</tbody>
              </table>` : ''}

              ${brand.artists_skipped.length > 0 ? `
              <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px; font-weight: 600;">Skipped Artists</h3>
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #fafafa;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Artist</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Balance</th>
                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Reason</th>
                  </tr>
                </thead>
                <tbody>${skippedRows}</tbody>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Artist Payout job.
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

  // ---------------------------------------------------------------------------
  // Email sending
  // ---------------------------------------------------------------------------

  async sendSuperadminEmail(result: PayoutResponse, dryRun: boolean): Promise<void> {
    const hasErrors = result.summary.total_brands_errored > 0;
    const dryRunPrefix = dryRun ? '[DRY RUN] ' : '';
    const subject = hasErrors
      ? `${dryRunPrefix}⚠️ Artist Payout Report — ${result.summary.total_brands_errored} brand(s) failed, ₱${result.summary.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid`
      : `${dryRunPrefix}Artist Payout Complete — ₱${result.summary.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid to ${result.summary.paid_count} artist(s)`;

    const info = await this.transporter.sendMail({
      from: `System Notifications <${this.fromEmail}>`,
      to: this.superadminEmail,
      subject: `[artist-payout] ${subject}`,
      html: this.generateSuperadminEmailHTML(result),
    });
    console.log('Superadmin payout report sent. Message ID:', info.messageId);
  }

  async sendBrandPayoutEmails(result: PayoutResponse, dryRun: boolean): Promise<void> {
    const relevantBrands = result.brands.filter(
      b => b.send_artist_balance_reminders &&
        (b.artists_paid.length > 0 || b.artists_skipped.length > 0 || b.status === 'error')
    );

    if (relevantBrands.length === 0) {
      console.log('No brands opted in to payout emails — skipping per-brand emails.');
      return;
    }

    // Fetch admin emails for opted-in brands via the existing cross-brand endpoint
    let adminEmailsByBrandId: Map<number, string[]>;
    try {
      adminEmailsByBrandId = await this.fetchAdminEmailsByBrand();
    } catch (err: any) {
      console.warn('Could not fetch admin emails for per-brand notifications:', err.message);
      return;
    }

    console.log(`Sending payout emails to ${relevantBrands.length} opted-in brand(s)${dryRun ? ' (DRY RUN)' : ''}...`);

    const dryRunPrefix = dryRun ? '[DRY RUN] ' : '';

    for (const brand of relevantBrands) {
      const adminEmails = adminEmailsByBrandId.get(brand.brand_id) ?? [];
      if (adminEmails.length === 0) {
        console.log(`No admin emails for brand "${brand.brand_name}" — skipping.`);
        continue;
      }

      const isError = brand.status === 'error';
      const subject = isError
        ? `${dryRunPrefix}Artist Payout Error — ${brand.brand_name}`
        : `${dryRunPrefix}Artist Payout Complete — ${brand.brand_name}`;

      try {
        const info = await this.transporter.sendMail({
          from: `${brand.brand_name} <${this.fromEmail}>`,
          to: adminEmails.join(', '),
          subject,
          html: this.generateBrandPayoutEmailHTML(brand),
        });
        console.log(`Payout email sent for "${brand.brand_name}". Message ID:`, info.messageId);
      } catch (err: any) {
        console.error(`Failed to send payout email for "${brand.brand_name}":`, err.message);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  async run(): Promise<{ paid_count: number; total_paid: number; errored_brands: number; dry_run: boolean }> {
    const dryRun = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

    console.log(`Starting artist payout process${dryRun ? ' (DRY RUN — no real transfers will be made)' : ''}...`);

    await this.authenticate();

    const result = await this.processPayouts(dryRun);
    await this.sendSuperadminEmail(result, dryRun);
    await this.sendBrandPayoutEmails(result, dryRun);

    console.log(`Artist payout process completed${dryRun ? ' (DRY RUN)' : ''}.`);

    return {
      paid_count: result.summary.paid_count,
      total_paid: result.summary.total_paid,
      errored_brands: result.summary.total_brands_errored,
      dry_run: dryRun,
    };
  }
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('Artist Payout Lambda triggered', { event, context });

  try {
    const service = new ArtistPayoutService();
    const result = await service.run();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: result.dry_run ? 'Artist payout dry run completed' : 'Artist payout completed',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Artist payout failed',
        error: error.message,
      }),
    };
  }
};
