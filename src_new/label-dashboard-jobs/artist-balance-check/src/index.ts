import { Handler, ScheduledEvent } from 'aws-lambda';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface ArtistBalance {
  artist_id: number;
  artist_name: string;
  sublabel_name: string | null;
  balance: number;
  total_royalties: number;
  total_payments: number;
  payout_point: number;
  hold_payouts: boolean;
  has_payment_method: boolean;
  is_ready_for_payment: boolean;
}

interface BrandBalance {
  brand_id: number;
  brand_name: string;
  logo_url: string | null;
  send_artist_balance_reminders: boolean;
  admin_emails: string[];
  artists: ArtistBalance[];
  total_payable: number;
}

interface ArtistsDuePaymentResponse {
  brands: BrandBalance[];
}

interface WalletBalance {
  brand_id: number;
  brand_name: string;
  wallet_id: string;
  available_balance: number;
  currency: string;
}

interface WalletBalancesResponse {
  total_brands: number;
  wallets: WalletBalance[];
  currency: string;
}

interface ArtistBalanceSummary {
  artists: (ArtistBalance & { brand_name: string })[];
  total_amount: number;
}

class ArtistBalanceCheckService {
  private transporter: nodemailer.Transporter;
  private apiBaseUrl: string;
  private superadminEmail: string;
  private fromEmail: string;
  private authToken: string | null = null;

  constructor() {
    // Validate required environment variables
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

    // Initialize nodemailer transporter with SMTP
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

  /**
   * Authenticate with the System API and get JWT token
   */
  private async authenticate(): Promise<void> {
    try {
      console.log('Authenticating with System API...');

      const loginData = {
        email: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
      };

      // Use System API authentication endpoint
      const response = await axios.post(`${this.apiBaseUrl}/api/system/auth/login`, loginData);

      if (response.data && response.data.token) {
        this.authToken = response.data.token;
        console.log('Successfully authenticated with System API');
        console.log('Token expires in:', response.data.expiresIn);
      } else {
        throw new Error('No token received from System API');
      }
    } catch (error: any) {
      if (error.response) {
        console.error('System authentication failed with status:', error.response.status);
        console.error('Error response:', error.response.data);
      } else {
        console.error('System authentication failed:', error.message);
      }
      throw error;
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(endpoint: string): Promise<T> {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      const response = await axios.get<T>(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });
      return response.data;
    } catch (error: any) {
      // If unauthorized, try to re-authenticate once
      if (error.response?.status === 401) {
        console.log('Token expired, re-authenticating...');
        await this.authenticate();
        const response = await axios.get<T>(`${this.apiBaseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  /**
   * Fetch wallet balances from the System API
   */
  private async fetchWalletBalances(): Promise<WalletBalancesResponse | null> {
    try {
      console.log('Fetching wallet balances from System API...');

      const response = await this.apiRequest<WalletBalancesResponse>('/api/system/wallet-balances');

      console.log(`Retrieved wallet balances for ${response.total_brands} brands`);


      return response;
    } catch (error: any) {
      console.error('Error fetching wallet balances:', error.message);
      return null;
    }
  }

  /**
   * Fetch all brands with their artist payable balances from the System API.
   * Returns a summary scoped to artists ready for payment for the superadmin email,
   * and the full brand list for per-brand reminder emails.
   */
  async fetchArtistsReadyForPayment(): Promise<{ summary: ArtistBalanceSummary; brands: BrandBalance[]; walletsByBrandId: Map<number, number> }> {
    console.log('Fetching artist balances from System API (cross-brand)...');

    try {
      const { brands } = await this.apiRequest<ArtistsDuePaymentResponse>('/api/system/artists-due-payment');

      // Flatten artists ready for payment across all brands for the superadmin summary
      const readyArtists = brands.flatMap(brand =>
        brand.artists
          .filter(a => a.is_ready_for_payment)
          .map(a => ({ ...a, brand_name: brand.brand_name }))
      );

      // Group by brand for logging
      const brandCounts = readyArtists.reduce((acc, artist) => {
        const brandName = artist.brand_name || 'Unknown';
        acc[brandName] = (acc[brandName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Artists ready for payment by brand:');
      Object.entries(brandCounts).forEach(([brandName, count]) => {
        console.log(`  - ${brandName}: ${count} artist${count === 1 ? '' : 's'}`);
      });

      const totalAmount = readyArtists.reduce((sum, artist) => sum + artist.balance, 0);

      console.log(`\nTotal: ${readyArtists.length} artists ready for payment across ${Object.keys(brandCounts).length} brands`);
      console.log(`Total amount due: ₱${totalAmount.toFixed(2)}`);

      // Fetch per-brand wallet balances for use in per-brand reminder emails
      const walletsByBrandId = new Map<number, number>();
      const walletBalances = await this.fetchWalletBalances();
      if (walletBalances) {
        for (const wallet of walletBalances.wallets) {
          walletsByBrandId.set(wallet.brand_id, wallet.available_balance);
        }
      }

      return {
        summary: {
          artists: readyArtists,
          total_amount: totalAmount,
        },
        brands,
        walletsByBrandId,
      };
    } catch (error: any) {
      console.error('Error fetching artist balances:', error.message);
      throw error;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(summary: ArtistBalanceSummary): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const artistRows = summary.artists
      .map(
        (artist) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">
            ${artist.artist_name}
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${artist.brand_name}${artist.sublabel_name ? ` / ${artist.sublabel_name}` : ''}</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #059669;">
            ₱${artist.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artist Balance Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; text-align: center;">
                Artist Balance Summary
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; text-align: center; font-size: 14px;">
                ${currentDate}
              </p>
            </td>
          </tr>

          <!-- Summary Card -->
          <tr>
            <td style="padding: 32px;">
              <!-- Total Amount Due -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; border-radius: 6px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0 0 4px 0; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                      Total Amount Due
                    </p>
                    <p style="margin: 0; color: #059669; font-size: 32px; font-weight: 700;">
                      ₱${summary.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div style="background-color: #059669; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                    ${summary.artists.length} ${summary.artists.length === 1 ? 'Artist' : 'Artists'}
                  </div>
                </div>
              </div>

              ${
                summary.artists.length > 0
                  ? `
              <!-- Artists Table -->
              <div style="margin-top: 24px;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">
                  Artists Ready for Payment
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
                        Artist Name
                      </th>
                      <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
                        Balance Due
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${artistRows}
                  </tbody>
                </table>
              </div>
              `
                  : `
              <!-- No Artists Message -->
              <div style="text-align: center; padding: 32px; background-color: #f9fafb; border-radius: 6px;">
                <p style="margin: 0; color: #6b7280; font-size: 16px;">
                  No artists are currently ready for payment.
                </p>
              </div>
              `
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Artist Balance Check system.
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
</html>
    `;
  }

  /**
   * Generate plain text email content (fallback)
   */
  private generateEmailText(summary: ArtistBalanceSummary): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let text = `ARTIST BALANCE SUMMARY\n`;
    text += `${currentDate}\n\n`;
    text += `===========================================\n\n`;
    text += `TOTAL AMOUNT DUE: ₱${summary.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    text += `ARTISTS READY FOR PAYMENT: ${summary.artists.length}\n\n`;

    if (summary.artists.length > 0) {
      text += `BREAKDOWN BY ARTIST:\n`;
      text += `-------------------------------------------\n\n`;

      summary.artists.forEach((artist) => {
        text += `${artist.artist_name} (${artist.brand_name})\n`;
        text += `  Balance Due: ₱${artist.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
      });
    } else {
      text += `No artists are currently ready for payment.\n\n`;
    }

    text += `===========================================\n\n`;
    text += `This is an automated report generated by the Artist Balance Check system.\n`;
    text += `Report generated on ${new Date().toLocaleString('en-US')}\n`;

    return text;
  }

  /**
   * Generate HTML for a per-brand balance reminder email sent to brand admins
   */
  private generateBrandReminderHTML(brand: BrandBalance, walletBalance: number | null): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const logoHtml = brand.logo_url
      ? `<img src="${brand.logo_url}" alt="${brand.brand_name}" style="max-width: 150px; max-height: 60px; height: auto;" />`
      : `<div style="font-size: 22px; font-weight: bold; color: #ffffff;">${brand.brand_name}</div>`;

    const renderArtistRow = (artist: ArtistBalance) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">
            ${artist.artist_name}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #059669;">
            ₱${artist.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>`;

    const renderSectionHeader = (label: string) => `
        <tr>
          <td colspan="2" style="padding: 10px 12px 6px 12px; background-color: #f9fafb; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.07em; border-bottom: 1px solid #e5e7eb;">
            ${label}
          </td>
        </tr>`;

    const ownArtists = brand.artists.filter(a => !a.sublabel_name);
    const sublabelGroups = new Map<string, ArtistBalance[]>();
    for (const artist of brand.artists) {
      if (artist.sublabel_name) {
        if (!sublabelGroups.has(artist.sublabel_name)) sublabelGroups.set(artist.sublabel_name, []);
        sublabelGroups.get(artist.sublabel_name)!.push(artist);
      }
    }

    const hasSections = ownArtists.length > 0 && sublabelGroups.size > 0 || sublabelGroups.size > 1;

    const artistRows = [
      ...(ownArtists.length > 0 && hasSections ? [renderSectionHeader(brand.brand_name)] : []),
      ...ownArtists.map(renderArtistRow),
      ...[...sublabelGroups.entries()].flatMap(([sublabelName, artists]) => [
        renderSectionHeader(sublabelName),
        ...artists.map(renderArtistRow),
      ]),
    ].join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artist Balance Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px; background-color: #222222; border-radius: 8px 8px 0 0; text-align: center;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 700;">Artist Balance Reminder</h2>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">${currentDate}</p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px 20px; border-radius: 6px; margin-bottom: 16px;">
                <p style="margin: 0 0 4px 0; color: #065f46; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Payable</p>
                <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">
                  ₱${brand.total_payable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              ${walletBalance !== null ? (() => {
                const isSufficient = walletBalance >= brand.total_payable;
                const shortage = isSufficient ? 0 : brand.total_payable - walletBalance;
                return `
              <div style="background-color: ${isSufficient ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${isSufficient ? '#059669' : '#dc2626'}; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px 0; color: ${isSufficient ? '#065f46' : '#991b1b'}; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Paymongo Wallet Balance</p>
                <p style="margin: 0; color: ${isSufficient ? '#059669' : '#dc2626'}; font-size: 24px; font-weight: 700;">
                  ₱${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style="font-size: 14px; font-weight: 600; margin-left: 8px;">${isSufficient ? '✓ Sufficient' : '✗ Insufficient'}</span>
                </p>
                ${!isSufficient ? `<p style="margin: 6px 0 0 0; color: #dc2626; font-size: 13px; font-weight: 600;">⚠️ Shortage: ₱${shortage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
              </div>`;
              })() : `
              <div style="background-color: #fafafa; border-left: 4px solid #d1d5db; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px;">No Paymongo wallet configured. You will have to pay this manually.</p>
              </div>`}

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
                      Artist
                    </th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${artistRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Artist Balance Check system.
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
</html>
    `;
  }

  /**
   * Send email summary using SMTP
   */
  async sendEmailSummary(summary: ArtistBalanceSummary): Promise<void> {
    console.log(`Sending email summary to ${this.superadminEmail}...`);

    const subject = `Artist Balance Summary - ${summary.artists.length} Artists Ready for Payment (₱${summary.total_amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })})`;

    const htmlBody = this.generateEmailHTML(summary);
    const textBody = this.generateEmailText(summary);

    const mailOptions = {
      from: `System Notifications <${this.fromEmail}>`,
      to: this.superadminEmail,
      subject: `[artist-balance-check] ${subject}`,
      html: htmlBody,
      text: textBody,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully. Message ID:', info.messageId);
    } catch (error: any) {
      console.error('Error sending email:', error.message);
      throw error;
    }
  }

  /**
   * Send per-brand balance reminder emails to opted-in brand admins
   */
  async sendBrandBalanceReminders(brands: BrandBalance[], walletsByBrandId: Map<number, number>): Promise<void> {
    const reminderBrands = brands.filter(b => b.send_artist_balance_reminders && b.admin_emails.length > 0);

    if (reminderBrands.length === 0) {
      console.log('No brands opted in to balance reminders — skipping per-brand emails.');
      return;
    }

    console.log(`Sending balance reminders for ${reminderBrands.length} opted-in brand(s)...`);

    for (const brand of reminderBrands) {
      console.log(`Sending reminder for "${brand.brand_name}" to: ${brand.admin_emails.join(', ')} (${brand.artists.length} artist(s), ₱${brand.total_payable.toFixed(2)})`);

      const mailOptions = {
        from: `${brand.brand_name} <${this.fromEmail}>`,
        to: brand.admin_emails.join(', '),
        subject: `Artist Balance Reminder — ${brand.brand_name}`,
        html: this.generateBrandReminderHTML(brand, walletsByBrandId.get(brand.brand_id) ?? null),
      };

      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('Reminder sent successfully. Message ID:', info.messageId);
      } catch (error: any) {
        console.error(`Error sending reminder for "${brand.brand_name}":`, error.message);
        // Continue with other brands rather than failing the whole job
      }
    }
  }

  /**
   * Main process to check balances and send email
   */
  async checkAndNotify(): Promise<{ artistCount: number; totalAmount: number }> {
    console.log('Starting artist balance check process...');

    try {
      // Authenticate with API
      await this.authenticate();

      // Fetch artist balances
      const { summary, brands, walletsByBrandId } = await this.fetchArtistsReadyForPayment();

      // Send superadmin summary email
      await this.sendEmailSummary(summary);

      // Send per-brand reminder emails to opted-in brands
      await this.sendBrandBalanceReminders(brands, walletsByBrandId);

      console.log('Artist balance check completed successfully');

      return {
        artistCount: summary.artists.length,
        totalAmount: summary.total_amount,
      };
    } catch (error: any) {
      console.error('Artist balance check process failed:', error.message);
      throw error;
    }
  }
}

/**
 * Lambda handler function
 */
export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('Artist Balance Check Lambda triggered', { event, context });

  try {
    const service = new ArtistBalanceCheckService();
    const result = await service.checkAndNotify();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Artist balance check completed successfully',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Artist balance check failed',
        error: error.message,
      }),
    };
  }
};
