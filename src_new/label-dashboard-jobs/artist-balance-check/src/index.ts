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
  brand_id: number;
  brand_name: string;
  balance: number;
  total_royalties: number;
  total_payments: number;
  payout_point: number;
  hold_payouts: boolean;
  has_payment_method: boolean;
  is_ready_for_payment: boolean;
  last_updated: string;
}

interface SystemApiResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  results: ArtistBalance[];
  filters: {
    min_balance: number;
    brand_id?: number;
  };
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
  total_balance: number;
  wallets: WalletBalance[];
  currency: string;
}

interface ArtistBalanceSummary {
  artists: ArtistBalance[];
  total_amount: number;
  wallet_info?: {
    total_balance: number;
    is_sufficient: boolean;
    shortage: number;
  };
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
      console.log(`Total available balance: ₱${response.total_balance.toFixed(2)}`);

      return response;
    } catch (error: any) {
      console.error('Error fetching wallet balances:', error.message);
      return null;
    }
  }

  /**
   * Fetch artists ready for payment from the System API
   *
   * The System API automatically filters for artists that are ready for payment:
   * - balance > payout_point (not >=, must exceed)
   * - has at least one payment method
   * - hold_payouts = false
   */
  async fetchArtistsReadyForPayment(): Promise<ArtistBalanceSummary> {
    console.log('Fetching artists ready for payment from System API (cross-brand)...');

    try {
      // Fetch all artists ready for payment across all brands using System API
      // The API automatically filters by payment readiness
      let allArtists: ArtistBalance[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        // System API filters artists who are truly ready for payment
        // min_balance=0 means we get all artists that meet the payment readiness criteria
        const endpoint = `/api/system/artists-due-payment?page=${currentPage}&limit=100&min_balance=0`;
        const response = await this.apiRequest<SystemApiResponse>(endpoint);

        allArtists = allArtists.concat(response.results);

        console.log(`Fetched page ${currentPage} of ${response.totalPages} (${response.results.length} artists ready for payment)`);

        hasMorePages = currentPage < response.totalPages;
        currentPage++;
      }

      console.log(`Retrieved ${allArtists.length} total artists ready for payment from all brands`);

      // Group by brand for logging
      const brandCounts = allArtists.reduce((acc, artist) => {
        const brandName = artist.brand_name || 'Unknown';
        acc[brandName] = (acc[brandName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Artists ready for payment by brand:');
      Object.entries(brandCounts).forEach(([brandName, count]) => {
        console.log(`  - ${brandName}: ${count} artist${count === 1 ? '' : 's'}`);
      });

      // Calculate total amount
      const totalAmount = allArtists.reduce((sum, artist) => sum + artist.balance, 0);

      console.log(`\nTotal: ${allArtists.length} artists ready for payment across ${Object.keys(brandCounts).length} brands`);
      console.log(`Total amount due: ₱${totalAmount.toFixed(2)}`);

      // Fetch wallet balances
      const walletBalances = await this.fetchWalletBalances();

      let walletInfo = undefined;
      if (walletBalances) {
        const isSufficient = walletBalances.total_balance >= totalAmount;
        const shortage = isSufficient ? 0 : totalAmount - walletBalances.total_balance;

        walletInfo = {
          total_balance: walletBalances.total_balance,
          is_sufficient: isSufficient,
          shortage
        };

        console.log(`\nWallet Balance: ₱${walletBalances.total_balance.toFixed(2)}`);
        console.log(`Sufficient for payments: ${isSufficient ? 'YES ✓' : 'NO ✗'}`);
        if (!isSufficient) {
          console.log(`Shortage: ₱${shortage.toFixed(2)}`);
        }
      }

      return {
        artists: allArtists,
        total_amount: totalAmount,
        wallet_info: walletInfo
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
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${artist.brand_name}</div>
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
                summary.wallet_info
                  ? `
              <!-- Wallet Balance Card -->
              <div style="background-color: ${summary.wallet_info.is_sufficient ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${summary.wallet_info.is_sufficient ? '#059669' : '#dc2626'}; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <p style="margin: 0 0 4px 0; color: ${summary.wallet_info.is_sufficient ? '#065f46' : '#991b1b'}; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                      Paymongo Wallet Balance
                    </p>
                    <p style="margin: 0; color: ${summary.wallet_info.is_sufficient ? '#059669' : '#dc2626'}; font-size: 28px; font-weight: 700;">
                      ₱${summary.wallet_info.total_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    ${
                      !summary.wallet_info.is_sufficient
                        ? `<p style="margin: 8px 0 0 0; color: #dc2626; font-size: 14px; font-weight: 600;">
                             ⚠️ Shortage: ₱${summary.wallet_info.shortage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           </p>`
                        : ''
                    }
                  </div>
                  <div style="background-color: ${summary.wallet_info.is_sufficient ? '#059669' : '#dc2626'}; color: #ffffff; padding: 12px 20px; border-radius: 50%; font-size: 24px; line-height: 1;">
                    ${summary.wallet_info.is_sufficient ? '✓' : '✗'}
                  </div>
                </div>
              </div>
              `
                  : ''
              }

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

    if (summary.wallet_info) {
      text += `PAYMONGO WALLET BALANCE: ₱${summary.wallet_info.total_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      if (summary.wallet_info.is_sufficient) {
        text += `STATUS: SUFFICIENT ✓\n\n`;
      } else {
        text += `STATUS: INSUFFICIENT ✗\n`;
        text += `SHORTAGE: ₱${summary.wallet_info.shortage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
      }
    }

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
   * Send email summary using SMTP
   */
  async sendEmailSummary(summary: ArtistBalanceSummary): Promise<void> {
    console.log(`Sending email summary to ${this.superadminEmail}...`);

    let subject = `Artist Balance Summary - ${summary.artists.length} Artists Ready for Payment (₱${summary.total_amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })})`;

    // Add wallet status to subject if available
    if (summary.wallet_info) {
      if (summary.wallet_info.is_sufficient) {
        subject += ' ✓';
      } else {
        subject = `⚠️ ${subject} - INSUFFICIENT WALLET BALANCE`;
      }
    }

    const htmlBody = this.generateEmailHTML(summary);
    const textBody = this.generateEmailText(summary);

    const mailOptions = {
      from: `Melt Records Dashboard - System Notifications <${this.fromEmail}>`,
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
   * Main process to check balances and send email
   */
  async checkAndNotify(): Promise<{ artistCount: number; totalAmount: number }> {
    console.log('Starting artist balance check process...');

    try {
      // Authenticate with API
      await this.authenticate();

      // Fetch artist balances
      const summary = await this.fetchArtistsReadyForPayment();

      // Send email summary
      await this.sendEmailSummary(summary);

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
