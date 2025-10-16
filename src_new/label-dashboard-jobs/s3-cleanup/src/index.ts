import { Handler, ScheduledEvent } from 'aws-lambda';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface UsedUrlsResponse {
  total_urls: number;
  urls: string[];
  breakdown: {
    brands: number;
    events: number;
    artists: number;
    artist_images: number;
    artist_documents: number;
    releases: number;
  };
}

interface CleanupSummary {
  totalFilesScanned: number;
  totalFilesInUse: number;
  totalFilesUnused: number;
  filesDeleted: number;
  filesDryRun: number;
  totalSizeDeleted: number;
  errors: string[];
  unusedFiles: Array<{
    key: string;
    size: number;
    lastModified: Date;
    age: number;
  }>;
}

class S3CleanupService {
  private transporter: nodemailer.Transporter;
  private apiBaseUrl: string;
  private superadminEmail: string;
  private fromEmail: string;
  private authToken: string | null = null;
  private s3Client: S3Client;
  private bucketName: string;
  private dryRun: boolean;
  private minFileAgeDays: number;
  private logs: string[] = [];

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
      'AWS_S3_BUCKET',
      'AWS_S3_ACCESS_KEY',
      'AWS_S3_SECRET_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.apiBaseUrl = process.env.API_BASE_URL!;
    this.superadminEmail = process.env.SUPERADMIN_EMAIL!;
    this.fromEmail = process.env.FROM_EMAIL!;
    this.bucketName = process.env.AWS_S3_BUCKET!;
    this.dryRun = process.env.DRY_RUN !== 'false'; // Default to true for safety
    this.minFileAgeDays = parseInt(process.env.MIN_FILE_AGE_DAYS || '7');

    // Initialize S3 Client
    this.s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_S3_SECRET_KEY!
      }
    });

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

    // Capture console logs
    this.captureConsoleLogs();
  }

  /**
   * Capture console.log, console.error, and console.warn to store in logs array
   */
  private captureConsoleLogs(): void {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      this.logs.push(`[${timestamp}] [LOG] ${message}`);
      originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      this.logs.push(`[${timestamp}] [ERROR] ${message}`);
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      this.logs.push(`[${timestamp}] [WARN] ${message}`);
      originalWarn.apply(console, args);
    };
  }

  /**
   * Generate logs attachment file
   */
  private generateLogsAttachment(): string {
    const header = `S3 CLEANUP - EXECUTION LOGS\n`;
    const timestamp = `Generated: ${new Date().toISOString()}\n`;
    const separator = `${'='.repeat(80)}\n\n`;

    return header + timestamp + separator + this.logs.join('\n');
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
   * Fetch all used URLs from the System API
   */
  private async fetchUsedUrls(): Promise<Set<string>> {
    try {
      console.log('Fetching used URLs from System API...');

      const response = await this.apiRequest<UsedUrlsResponse>('/api/system/s3-used-urls');

      console.log(`Retrieved ${response.total_urls} used URLs from database`);
      console.log('Breakdown:', response.breakdown);

      // Create a Set of normalized S3 keys
      const usedKeys = new Set<string>();

      response.urls.forEach(url => {
        // Extract S3 key from URL
        // Handles formats like:
        // - https://bucket.s3.region.amazonaws.com/path/to/file.jpg
        // - https://s3.region.amazonaws.com/bucket/path/to/file.jpg
        // - s3://bucket/path/to/file.jpg
        // - /path/to/file.jpg (relative path)
        const key = this.extractS3KeyFromUrl(url);
        if (key) {
          usedKeys.add(key);
        }
      });

      console.log(`Extracted ${usedKeys.size} unique S3 keys from URLs`);

      // TEMPORARY: Log extracted keys for verification
      console.log('\n========== EXTRACTED KEYS FROM DATABASE ==========');
      const sortedKeys = Array.from(usedKeys).sort();
      sortedKeys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
      });
      console.log('==================================================\n');

      return usedKeys;
    } catch (error: any) {
      console.error('Error fetching used URLs:', error.message);
      throw error;
    }
  }

  /**
   * Decode URL-encoded string, handling both %20 and + for spaces
   */
  private decodeS3Key(encodedKey: string): string {
    // Replace + with spaces (AWS S3 sometimes uses + instead of %20)
    const withSpaces = encodedKey.replace(/\+/g, ' ');
    // Decode percent-encoded characters (%20, %2F, etc.)
    return decodeURIComponent(withSpaces);
  }

  /**
   * Extract S3 key from various URL formats
   */
  private extractS3KeyFromUrl(url: string): string | null {
    if (!url || url.trim().length === 0) {
      return null;
    }

    try {
      // Remove leading/trailing whitespace
      url = url.trim();

      let key: string;

      // If it's a full S3 URL
      if (url.includes('amazonaws.com')) {
        const urlObj = new URL(url);
        // Extract path and remove leading slash
        // Note: URL constructor decodes %20 but not +, so we still need to decode
        key = urlObj.pathname.substring(1);
        // Handle + signs that might represent spaces
        key = this.decodeS3Key(key);
      }
      // If it's an s3:// protocol URL
      else if (url.startsWith('s3://')) {
        const parts = url.replace('s3://', '').split('/');
        // Remove bucket name (first part) and join the rest
        key = parts.slice(1).join('/');
        // Decode URL-encoded characters (handles both %20 and +)
        key = this.decodeS3Key(key);
      }
      // If it's a relative path (starts with /)
      else if (url.startsWith('/')) {
        key = url.substring(1);
        // Decode URL-encoded characters (handles both %20 and +)
        key = this.decodeS3Key(key);
      }
      // Otherwise, treat it as an S3 key
      else {
        key = url;
        // Decode URL-encoded characters (handles both %20 and +)
        key = this.decodeS3Key(key);
      }

      return key;
    } catch (error) {
      console.warn(`Failed to parse URL: ${url}`, error);
      return null;
    }
  }

  /**
   * List all files in S3 bucket
   */
  private async listAllS3Files(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    console.log(`Listing all files in bucket: ${this.bucketName}...`);

    const allFiles: Array<{ key: string; size: number; lastModified: Date }> = [];
    let continuationToken: string | undefined;
    let excludedCount = 0;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          ContinuationToken: continuationToken,
        });

        const response = await this.s3Client.send(command);

        if (response.Contents) {
          response.Contents.forEach(object => {
            if (object.Key) {
              // Exclude qr-codes folder - these are dynamically generated and not tracked in DB
              if (object.Key.startsWith('qr-codes/') || object.Key.includes('/qr-codes/')) {
                excludedCount++;
                return;
              }

              allFiles.push({
                key: object.Key,
                size: object.Size || 0,
                lastModified: object.LastModified || new Date(),
              });
            }
          });
        }

        continuationToken = response.NextContinuationToken;
        console.log(`Fetched ${allFiles.length} files so far... (excluded ${excludedCount} QR codes)`);

      } while (continuationToken);

      console.log(`Total files in S3 bucket: ${allFiles.length}`);
      console.log(`Excluded QR code files: ${excludedCount}`);

      // TEMPORARY: Log S3 keys for verification
      console.log('\n========== KEYS LISTED FROM S3 BUCKET ==========');
      const sortedS3Keys = allFiles.map(f => f.key).sort();
      sortedS3Keys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
      });
      console.log('================================================\n');

      return allFiles;
    } catch (error: any) {
      console.error('Error listing S3 files:', error.message);
      throw error;
    }
  }

  /**
   * Delete unused files from S3
   */
  private async deleteUnusedFiles(unusedFiles: Array<{ key: string; size: number; lastModified: Date; age: number }>): Promise<{ deleted: number; errors: string[] }> {
    if (unusedFiles.length === 0) {
      console.log('No unused files to delete');
      return { deleted: 0, errors: [] };
    }

    const errors: string[] = [];
    let deleted = 0;

    if (this.dryRun) {
      console.log(`DRY RUN MODE: Would delete ${unusedFiles.length} files`);
      return { deleted: 0, errors: [] };
    }

    // Delete in batches of 1000 (S3 limit)
    const batchSize = 1000;
    for (let i = 0; i < unusedFiles.length; i += batchSize) {
      const batch = unusedFiles.slice(i, i + batchSize);

      try {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: batch.map(file => ({ Key: file.key })),
            Quiet: false,
          },
        });

        const response = await this.s3Client.send(command);

        if (response.Deleted) {
          deleted += response.Deleted.length;
          console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}: ${response.Deleted.length} files`);
        }

        if (response.Errors && response.Errors.length > 0) {
          response.Errors.forEach(error => {
            errors.push(`${error.Key}: ${error.Code} - ${error.Message}`);
          });
        }
      } catch (error: any) {
        console.error(`Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      }
    }

    console.log(`Successfully deleted ${deleted} files`);
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors during deletion`);
    }

    return { deleted, errors };
  }

  /**
   * Perform S3 cleanup
   */
  async performCleanup(): Promise<CleanupSummary> {
    console.log('Starting S3 cleanup process...');
    console.log(`Bucket: ${this.bucketName}`);
    console.log(`Dry run: ${this.dryRun}`);
    console.log(`Minimum file age: ${this.minFileAgeDays} days`);

    const summary: CleanupSummary = {
      totalFilesScanned: 0,
      totalFilesInUse: 0,
      totalFilesUnused: 0,
      filesDeleted: 0,
      filesDryRun: 0,
      totalSizeDeleted: 0,
      errors: [],
      unusedFiles: []
    };

    try {
      // Authenticate
      await this.authenticate();

      // Fetch used URLs from database
      const usedKeys = await this.fetchUsedUrls();

      // List all files in S3
      const allFiles = await this.listAllS3Files();
      summary.totalFilesScanned = allFiles.length;

      // Calculate minimum date
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - this.minFileAgeDays);

      // Find unused files
      const now = new Date();
      const unusedFiles = allFiles.filter(file => {
        const isUsed = usedKeys.has(file.key);
        const fileAge = Math.floor((now.getTime() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24));
        const isOldEnough = file.lastModified < minDate;

        if (isUsed) {
          summary.totalFilesInUse++;
          return false;
        }

        if (!isOldEnough) {
          console.log(`Skipping ${file.key} - only ${fileAge} days old (minimum: ${this.minFileAgeDays})`);
          return false;
        }

        return true;
      });

      summary.totalFilesUnused = unusedFiles.length;

      // Add file age and size to summary
      summary.unusedFiles = unusedFiles.map(file => {
        const age = Math.floor((now.getTime() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24));
        return { ...file, age };
      });

      summary.totalSizeDeleted = summary.unusedFiles.reduce((sum, file) => sum + file.size, 0);

      console.log(`\nSummary:`);
      console.log(`- Total files scanned: ${summary.totalFilesScanned}`);
      console.log(`- Files in use: ${summary.totalFilesInUse}`);
      console.log(`- Unused files (eligible for deletion): ${summary.totalFilesUnused}`);
      console.log(`- Total size to be freed: ${(summary.totalSizeDeleted / 1024 / 1024).toFixed(2)} MB`);

      // Delete unused files
      if (summary.totalFilesUnused > 0) {
        const { deleted, errors } = await this.deleteUnusedFiles(summary.unusedFiles);
        summary.filesDeleted = deleted;
        summary.filesDryRun = this.dryRun ? summary.totalFilesUnused : 0;
        summary.errors = errors;
      }

      console.log('S3 cleanup completed successfully');

      return summary;
    } catch (error: any) {
      console.error('S3 cleanup process failed:', error.message);
      summary.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(summary: CleanupSummary): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const sizeInMB = (summary.totalSizeDeleted / 1024 / 1024).toFixed(2);
    const isDryRun = this.dryRun;
    const actionText = isDryRun ? 'would be deleted' : 'deleted';
    const statusColor = summary.errors.length > 0 ? '#dc2626' : (isDryRun ? '#f59e0b' : '#059669');
    const statusIcon = summary.errors.length > 0 ? '⚠️' : (isDryRun ? 'ℹ️' : '✓');

    const fileRows = summary.unusedFiles.slice(0, 50).map(file => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-family: monospace; font-size: 12px;">
          ${file.key}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          ${(file.size / 1024).toFixed(2)} KB
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          ${file.age} days
        </td>
      </tr>
    `).join('');

    const errorRows = summary.errors.slice(0, 20).map(error => `
      <div style="padding: 8px; background-color: #fee2e2; border-left: 3px solid #dc2626; margin-bottom: 8px; font-size: 12px; color: #991b1b;">
        ${error}
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>S3 Cleanup Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; text-align: center;">
                S3 Cleanup Report
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; text-align: center; font-size: 14px;">
                ${currentDate}
              </p>
              ${isDryRun ? `<p style="margin: 8px 0 0 0; color: #fbbf24; text-align: center; font-size: 16px; font-weight: 600;">⚠️ DRY RUN MODE</p>` : ''}
            </td>
          </tr>

          <!-- Summary Cards -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <!-- Total Files Scanned -->
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; border-left: 4px solid #6366f1;">
                  <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                    Files Scanned
                  </p>
                  <p style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">
                    ${summary.totalFilesScanned.toLocaleString()}
                  </p>
                </div>

                <!-- Files In Use -->
                <div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; border-left: 4px solid #059669;">
                  <p style="margin: 0 0 4px 0; color: #065f46; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                    Files In Use
                  </p>
                  <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">
                    ${summary.totalFilesInUse.toLocaleString()}
                  </p>
                </div>

                <!-- Unused Files -->
                <div style="background-color: #fef2f2; padding: 20px; border-radius: 6px; border-left: 4px solid ${statusColor};">
                  <p style="margin: 0 0 4px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                    Unused Files ${isDryRun ? '(To Delete)' : '(Deleted)'}
                  </p>
                  <p style="margin: 0; color: ${statusColor}; font-size: 28px; font-weight: 700;">
                    ${summary.totalFilesUnused.toLocaleString()}
                  </p>
                </div>

                <!-- Space Freed -->
                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; border-left: 4px solid #0284c7;">
                  <p style="margin: 0 0 4px 0; color: #075985; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                    Space ${isDryRun ? 'To Free' : 'Freed'}
                  </p>
                  <p style="margin: 0; color: #0284c7; font-size: 28px; font-weight: 700;">
                    ${sizeInMB} MB
                  </p>
                </div>
              </div>

              ${summary.errors.length > 0 ? `
              <!-- Errors Section -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 16px 0; color: #dc2626; font-size: 18px; font-weight: 600;">
                  ⚠️ Errors (${summary.errors.length})
                </h2>
                ${errorRows}
                ${summary.errors.length > 20 ? `<p style="margin-top: 12px; color: #6b7280; font-size: 12px;">... and ${summary.errors.length - 20} more errors</p>` : ''}
              </div>
              ` : ''}

              ${summary.unusedFiles.length > 0 ? `
              <!-- Files List -->
              <div style="margin-top: 24px;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">
                  Unused Files ${isDryRun ? 'To Be Deleted' : 'Deleted'} ${summary.unusedFiles.length > 50 ? '(First 50)' : ''}
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
                        File Path
                      </th>
                      <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
                        Size
                      </th>
                      <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">
                        Age
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${fileRows}
                  </tbody>
                </table>
                ${summary.unusedFiles.length > 50 ? `<p style="margin-top: 12px; color: #6b7280; font-size: 12px; text-align: center;">... and ${summary.unusedFiles.length - 50} more files</p>` : ''}
              </div>
              ` : `
              <div style="text-align: center; padding: 32px; background-color: #f9fafb; border-radius: 6px;">
                <p style="margin: 0; color: #059669; font-size: 18px; font-weight: 600;">
                  ✓ No unused files found
                </p>
                <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                  All files in S3 are currently in use
                </p>
              </div>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the S3 Cleanup system.
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Bucket: ${this.bucketName} | Minimum file age: ${this.minFileAgeDays} days
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
   * Generate plain text email content
   */
  private generateEmailText(summary: CleanupSummary): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const sizeInMB = (summary.totalSizeDeleted / 1024 / 1024).toFixed(2);
    const isDryRun = this.dryRun;

    let text = `S3 CLEANUP REPORT\n`;
    text += `${currentDate}\n`;
    if (isDryRun) {
      text += `⚠️ DRY RUN MODE - No files were actually deleted\n`;
    }
    text += `\n===========================================\n\n`;
    text += `FILES SCANNED: ${summary.totalFilesScanned.toLocaleString()}\n`;
    text += `FILES IN USE: ${summary.totalFilesInUse.toLocaleString()}\n`;
    text += `UNUSED FILES ${isDryRun ? '(TO DELETE)' : '(DELETED)'}: ${summary.totalFilesUnused.toLocaleString()}\n`;
    text += `SPACE ${isDryRun ? 'TO FREE' : 'FREED'}: ${sizeInMB} MB\n\n`;

    if (summary.errors.length > 0) {
      text += `ERRORS (${summary.errors.length}):\n`;
      text += `-------------------------------------------\n`;
      summary.errors.slice(0, 20).forEach(error => {
        text += `  - ${error}\n`;
      });
      if (summary.errors.length > 20) {
        text += `  ... and ${summary.errors.length - 20} more errors\n`;
      }
      text += `\n`;
    }

    if (summary.unusedFiles.length > 0) {
      text += `UNUSED FILES ${isDryRun ? 'TO BE DELETED' : 'DELETED'}${summary.unusedFiles.length > 50 ? ' (FIRST 50)' : ''}:\n`;
      text += `-------------------------------------------\n`;
      summary.unusedFiles.slice(0, 50).forEach(file => {
        text += `${file.key} (${(file.size / 1024).toFixed(2)} KB, ${file.age} days old)\n`;
      });
      if (summary.unusedFiles.length > 50) {
        text += `... and ${summary.unusedFiles.length - 50} more files\n`;
      }
    } else {
      text += `No unused files found. All files in S3 are currently in use.\n`;
    }

    text += `\n===========================================\n\n`;
    text += `This is an automated report generated by the S3 Cleanup system.\n`;
    text += `Bucket: ${this.bucketName} | Minimum file age: ${this.minFileAgeDays} days\n`;
    text += `Report generated on ${new Date().toLocaleString('en-US')}\n`;

    return text;
  }

  /**
   * Generate attachment file with full list of files to be deleted
   */
  private generateFileAttachment(summary: CleanupSummary): string {
    const currentDate = new Date().toISOString();
    const isDryRun = this.dryRun;

    let content = `S3 CLEANUP - ${isDryRun ? 'FILES TO DELETE' : 'DELETED FILES'}\n`;
    content += `Generated: ${currentDate}\n`;
    content += `Bucket: ${this.bucketName}\n`;
    content += `Total Files: ${summary.totalFilesUnused}\n`;
    content += `Total Size: ${(summary.totalSizeDeleted / 1024 / 1024).toFixed(2)} MB\n`;
    content += `\n${'='.repeat(80)}\n\n`;

    if (summary.unusedFiles.length === 0) {
      content += 'No unused files found.\n';
    } else {
      content += 'FILE PATH | SIZE (KB) | AGE (DAYS) | LAST MODIFIED\n';
      content += `${'-'.repeat(80)}\n`;

      summary.unusedFiles.forEach(file => {
        const sizeKB = (file.size / 1024).toFixed(2);
        const lastModified = file.lastModified.toISOString();
        content += `${file.key} | ${sizeKB} | ${file.age} | ${lastModified}\n`;
      });
    }

    return content;
  }

  /**
   * Send email summary using SMTP
   */
  async sendEmailSummary(summary: CleanupSummary): Promise<void> {
    console.log(`Sending email summary to ${this.superadminEmail}...`);

    const isDryRun = this.dryRun;
    const sizeInMB = (summary.totalSizeDeleted / 1024 / 1024).toFixed(2);

    let subject = `S3 Cleanup Report - ${summary.totalFilesUnused} Files ${isDryRun ? 'To Delete' : 'Deleted'} (${sizeInMB} MB)`;

    if (isDryRun) {
      subject = `🔍 ${subject} [DRY RUN]`;
    } else if (summary.errors.length > 0) {
      subject = `⚠️ ${subject} - ${summary.errors.length} Errors`;
    } else if (summary.totalFilesUnused > 0) {
      subject = `✓ ${subject}`;
    }

    const htmlBody = this.generateEmailHTML(summary);
    const textBody = this.generateEmailText(summary);

    // Generate attachments
    const attachmentContent = this.generateFileAttachment(summary);
    const logsContent = this.generateLogsAttachment();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const attachmentFilename = `s3-cleanup-${isDryRun ? 'to-delete' : 'deleted'}-${timestamp}.txt`;
    const logsFilename = `s3-cleanup-logs-${timestamp}.txt`;

    const mailOptions = {
      from: `Melt Records Dashboard - System Notifications <${this.fromEmail}>`,
      to: this.superadminEmail,
      subject: `[s3-cleanup] ${subject}`,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename: attachmentFilename,
          content: attachmentContent,
          contentType: 'text/plain'
        },
        {
          filename: logsFilename,
          content: logsContent,
          contentType: 'text/plain'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully. Message ID:', info.messageId);
      console.log(`Attachments included:`);
      console.log(`  - ${attachmentFilename} (${summary.totalFilesUnused} files)`);
      console.log(`  - ${logsFilename} (${this.logs.length} log entries)`);
    } catch (error: any) {
      console.error('Error sending email:', error.message);
      throw error;
    }
  }

  /**
   * Main process to perform cleanup and send email
   */
  async cleanupAndNotify(): Promise<CleanupSummary> {
    const summary = await this.performCleanup();
    await this.sendEmailSummary(summary);
    return summary;
  }
}

/**
 * Lambda handler function
 */
export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('S3 Cleanup Lambda triggered', { event, context });

  try {
    const service = new S3CleanupService();
    const summary = await service.cleanupAndNotify();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'S3 cleanup completed successfully',
        filesScanned: summary.totalFilesScanned,
        filesDeleted: summary.filesDeleted,
        filesDryRun: summary.filesDryRun,
        sizeMB: (summary.totalSizeDeleted / 1024 / 1024).toFixed(2),
        errors: summary.errors.length
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'S3 cleanup failed',
        error: error.message,
      }),
    };
  }
};
