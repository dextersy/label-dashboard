import { Handler, ScheduledEvent } from 'aws-lambda';
import nodemailer from 'nodemailer';
import axios from 'axios';
import ExcelJS from 'exceljs';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface SongStatus {
  id: number;
  track_number: number;
  title: string;
  isrc: string | null;
  has_lyrics: boolean;
  has_audio: boolean;
  author_count: number;
  composer_count: number;
}

interface ReleaseStatus {
  id: number;
  title: string;
  catalog_no: string;
  status: string;
  UPC: string | null;
  cover_art: string | null;
  release_date: string | null;
  description: string | null;
  brand_id: number;
  brand_name: string;
  artists: string[];
  song_count: number;
  songs: SongStatus[];
}

interface SystemApiResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  results: ReleaseStatus[];
}

interface ValidationError {
  message: string;
  trackNumbers?: number[];
}

interface ValidationWarning {
  message: string;
  trackNumbers?: number[];
}

interface ReleaseValidation {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

class ReleaseStatusReportService {
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
   * Fetch all releases with song status from the System API
   */
  private async fetchAllReleases(): Promise<ReleaseStatus[]> {
    console.log('Fetching release status from System API (cross-brand)...');

    let allReleases: ReleaseStatus[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const endpoint = `/api/system/release-status?page=${currentPage}&limit=100`;
      const response = await this.apiRequest<SystemApiResponse>(endpoint);

      allReleases = allReleases.concat(response.results);

      console.log(`Fetched page ${currentPage} of ${response.totalPages} (${response.results.length} releases)`);

      hasMorePages = currentPage < response.totalPages;
      currentPage++;
    }

    console.log(`Retrieved ${allReleases.length} total releases from all brands`);

    // Log summary by brand
    const brandCounts = allReleases.reduce((acc, release) => {
      const brandName = release.brand_name || 'Unknown';
      acc[brandName] = (acc[brandName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Releases by brand:');
    Object.entries(brandCounts).forEach(([brandName, count]) => {
      console.log(`  - ${brandName}: ${count} release${count === 1 ? '' : 's'}`);
    });

    return allReleases;
  }

  /**
   * Validate a release and its songs (mirrors frontend ReleaseValidationService)
   */
  private validateRelease(release: ReleaseStatus): ReleaseValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Release-level errors
    if (!release.cover_art) {
      errors.push({ message: 'No cover art' });
    }

    // Release-level warnings
    if (!release.description || release.description === 'null') {
      warnings.push({ message: 'No release description' });
    }

    // Song-level validations
    if (release.songs.length === 0) {
      errors.push({ message: 'No tracks in tracklist' });
    } else {
      const songsWithoutAuthors = release.songs
        .filter(song => song.author_count === 0)
        .map(song => song.track_number || 0);
      if (songsWithoutAuthors.length > 0) {
        errors.push({ message: 'No authors', trackNumbers: songsWithoutAuthors });
      }

      const songsWithoutComposers = release.songs
        .filter(song => song.composer_count === 0)
        .map(song => song.track_number || 0);
      if (songsWithoutComposers.length > 0) {
        errors.push({ message: 'No composers', trackNumbers: songsWithoutComposers });
      }

      const songsWithoutAudio = release.songs
        .filter(song => !song.has_audio)
        .map(song => song.track_number || 0);
      if (songsWithoutAudio.length > 0) {
        errors.push({ message: 'No audio master', trackNumbers: songsWithoutAudio });
      }

      const songsWithoutLyrics = release.songs
        .filter(song => !song.has_lyrics)
        .map(song => song.track_number || 0);
      if (songsWithoutLyrics.length > 0) {
        warnings.push({ message: 'No lyrics', trackNumbers: songsWithoutLyrics });
      }
    }

    return { errors, warnings };
  }

  /**
   * Format validation messages for display
   */
  private formatValidationMessages(items: (ValidationError | ValidationWarning)[]): string {
    if (items.length === 0) return '';
    return items.map(item => {
      if (item.trackNumbers && item.trackNumbers.length > 0) {
        return `${item.message} (Track${item.trackNumbers.length > 1 ? 's' : ''} ${item.trackNumbers.join(', ')})`;
      }
      return item.message;
    }).join('; ');
  }

  /**
   * Generate Excel workbook with release and song status
   */
  private async generateExcel(releases: ReleaseStatus[]): Promise<Buffer> {
    console.log('Generating Excel report...');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Release Status Report';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Release & Song Status');

    // Define styles
    const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const releaseFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const releaseFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    const errorFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
    const warningFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
    const okFont: Partial<ExcelJS.Font> = { color: { argb: 'FF2E7D32' } };
    const missingFont: Partial<ExcelJS.Font> = { color: { argb: 'FFC62828' }, bold: true };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
    };

    // Add header row
    const headerRow = worksheet.addRow([
      'Brand',
      'Release Title',
      'Catalog #',
      'Release Status',
      'UPC',
      'Cover Art',
      'Release Date',
      'Artists',
      'Errors',
      'Warnings',
      'Track #',
      'Song Title',
      'ISRC',
      'Composers',
      'Authors',
      'Lyrics',
      'Audio Master'
    ]);

    headerRow.eachCell((cell) => {
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Set column widths
    worksheet.columns = [
      { width: 18 },  // Brand
      { width: 28 },  // Release Title
      { width: 10 },  // Catalog #
      { width: 14 },  // Release Status
      { width: 16 },  // UPC
      { width: 10 },  // Cover Art
      { width: 13 },  // Release Date
      { width: 24 },  // Artists
      { width: 35 },  // Errors
      { width: 35 },  // Warnings
      { width: 8 },   // Track #
      { width: 28 },  // Song Title
      { width: 16 },  // ISRC
      { width: 12 },  // Composers
      { width: 12 },  // Authors
      { width: 8 },   // Lyrics
      { width: 12 },  // Audio Master
    ];

    // Track statistics
    let totalSongs = 0;
    let releasesWithErrors = 0;
    let releasesWithWarnings = 0;

    // Add data rows grouped by release
    for (const release of releases) {
      const validation = this.validateRelease(release);
      const hasErrors = validation.errors.length > 0;
      const hasWarnings = validation.warnings.length > 0;

      if (hasErrors) releasesWithErrors++;
      if (hasWarnings) releasesWithWarnings++;

      const errorsText = this.formatValidationMessages(validation.errors);
      const warningsText = this.formatValidationMessages(validation.warnings);

      const artistNames = release.artists.join(', ');

      if (release.songs.length === 0) {
        // Release with no songs - single row
        const row = worksheet.addRow([
          release.brand_name,
          release.title,
          release.catalog_no,
          release.status,
          release.UPC || 'MISSING',
          release.cover_art ? 'Yes' : 'No',
          release.release_date || 'MISSING',
          artistNames,
          errorsText,
          warningsText,
          '', '', '', '', '', '', ''
        ]);
        this.styleReleaseRow(row, hasErrors, hasWarnings, releaseFont, releaseFill, errorFill, warningFill, thinBorder, release);
      } else {
        // First song row includes release info
        const firstSong = release.songs[0];
        totalSongs++;

        const row = worksheet.addRow([
          release.brand_name,
          release.title,
          release.catalog_no,
          release.status,
          release.UPC || 'MISSING',
          release.cover_art ? 'Yes' : 'No',
          release.release_date || 'MISSING',
          artistNames,
          errorsText,
          warningsText,
          firstSong.track_number || 1,
          firstSong.title,
          firstSong.isrc || 'MISSING',
          firstSong.composer_count > 0 ? firstSong.composer_count.toString() : 'MISSING',
          firstSong.author_count > 0 ? firstSong.author_count.toString() : 'MISSING',
          firstSong.has_lyrics ? 'Yes' : 'No',
          firstSong.has_audio ? 'Yes' : 'No'
        ]);
        this.styleReleaseRow(row, hasErrors, hasWarnings, releaseFont, releaseFill, errorFill, warningFill, thinBorder, release);
        this.styleSongCells(row, firstSong, okFont, missingFont);

        // Additional song rows
        for (let i = 1; i < release.songs.length; i++) {
          const song = release.songs[i];
          totalSongs++;

          const songRow = worksheet.addRow([
            '', '', '', '', '', '', '', '', '', '',
            song.track_number || i + 1,
            song.title,
            song.isrc || 'MISSING',
            song.composer_count > 0 ? song.composer_count.toString() : 'MISSING',
            song.author_count > 0 ? song.author_count.toString() : 'MISSING',
            song.has_lyrics ? 'Yes' : 'No',
            song.has_audio ? 'Yes' : 'No'
          ]);

          // Style song-only rows
          songRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = thinBorder;
            if (colNumber >= 11) {
              cell.alignment = { horizontal: 'center' };
            }
          });
          this.styleSongCells(songRow, song, okFont, missingFont);
        }
      }
    }

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: worksheet.rowCount, column: 17 }
    };

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    const summaryHeaderFont: Partial<ExcelJS.Font> = { bold: true, size: 14 };
    const summaryLabelFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };

    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 20;

    const titleRow = summarySheet.addRow(['Release & Song Status Report']);
    titleRow.getCell(1).font = summaryHeaderFont;

    const dateRow = summarySheet.addRow([`Generated: ${new Date().toLocaleString('en-US')}`]);
    dateRow.getCell(1).font = { size: 11, color: { argb: 'FF666666' } };

    summarySheet.addRow([]);

    const statsData = [
      ['Total Releases', releases.length],
      ['Total Songs', totalSongs],
      ['Releases with Errors', releasesWithErrors],
      ['Releases with Warnings', releasesWithWarnings],
    ];

    // Count by status
    const statusCounts = releases.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    statsData.push(['', '']);
    statsData.push(['By Release Status', '']);
    for (const [status, count] of Object.entries(statusCounts)) {
      statsData.push([`  ${status}`, count]);
    }

    // Count by brand
    const brandCounts = releases.reduce((acc, r) => {
      acc[r.brand_name] = (acc[r.brand_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    statsData.push(['', '']);
    statsData.push(['By Brand', '']);
    for (const [brand, count] of Object.entries(brandCounts)) {
      statsData.push([`  ${brand}`, count]);
    }

    for (const [label, value] of statsData) {
      const row = summarySheet.addRow([label, value]);
      if (typeof value === 'string' && value === '') {
        row.getCell(1).font = summaryLabelFont;
      }
    }

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`Excel report generated: ${releases.length} releases, ${totalSongs} songs`);

    return Buffer.from(buffer);
  }

  /**
   * Apply styling to release-level cells in a row
   */
  private styleReleaseRow(
    row: ExcelJS.Row,
    hasErrors: boolean,
    hasWarnings: boolean,
    releaseFont: Partial<ExcelJS.Font>,
    releaseFill: ExcelJS.FillPattern,
    errorFill: ExcelJS.FillPattern,
    warningFill: ExcelJS.FillPattern,
    border: Partial<ExcelJS.Borders>,
    release: ReleaseStatus
  ): void {
    // Style release info columns (1-10)
    for (let col = 1; col <= 10; col++) {
      const cell = row.getCell(col);
      cell.font = releaseFont;
      cell.fill = releaseFill;
      cell.border = border;
      if (col >= 11) {
        cell.alignment = { horizontal: 'center' };
      }
    }

    // Style song columns (11-17) with border
    for (let col = 11; col <= 17; col++) {
      const cell = row.getCell(col);
      cell.border = border;
      cell.alignment = { horizontal: 'center' };
    }

    // Color errors column
    if (hasErrors) {
      row.getCell(9).fill = errorFill;
      row.getCell(9).font = { bold: true, color: { argb: 'FFC62828' } };
    }

    // Color warnings column
    if (hasWarnings) {
      row.getCell(10).fill = warningFill;
      row.getCell(10).font = { bold: true, color: { argb: 'FFE65100' } };
    }

    // Color UPC cell if missing
    if (!release.UPC) {
      row.getCell(5).font = { bold: true, color: { argb: 'FFC62828' } };
    }

    // Color Cover Art cell
    if (!release.cover_art) {
      row.getCell(6).font = { bold: true, color: { argb: 'FFC62828' } };
    }

    // Color Release Date cell if missing
    if (!release.release_date) {
      row.getCell(7).font = { bold: true, color: { argb: 'FFC62828' } };
    }

    // Wrap text on errors/warnings
    row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(10).alignment = { wrapText: true, vertical: 'top' };
  }

  /**
   * Apply color coding to song status cells
   */
  private styleSongCells(
    row: ExcelJS.Row,
    song: SongStatus,
    okFont: Partial<ExcelJS.Font>,
    missingFont: Partial<ExcelJS.Font>
  ): void {
    // ISRC (col 13)
    row.getCell(13).font = song.isrc ? okFont : missingFont;

    // Composers (col 14)
    row.getCell(14).font = song.composer_count > 0 ? okFont : missingFont;

    // Authors (col 15)
    row.getCell(15).font = song.author_count > 0 ? okFont : missingFont;

    // Lyrics (col 16) - warning level, not error
    if (!song.has_lyrics) {
      row.getCell(16).font = { color: { argb: 'FFE65100' } };
    } else {
      row.getCell(16).font = okFont;
    }

    // Audio Master (col 17)
    row.getCell(17).font = song.has_audio ? okFont : missingFont;
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(releases: ReleaseStatus[], releasesWithErrors: number, releasesWithWarnings: number, totalSongs: number): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Release Status Report</title>
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
                Release & Song Status Report
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; text-align: center; font-size: 14px;">
                ${currentDate}
              </p>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                <div style="background-color: #f0f4ff; border-left: 4px solid #4472C4; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                  <p style="margin: 0 0 4px 0; color: #1e3a5f; font-size: 13px; font-weight: 600; text-transform: uppercase;">Total Releases</p>
                  <p style="margin: 0; color: #4472C4; font-size: 28px; font-weight: 700;">${releases.length}</p>
                </div>
                <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                  <p style="margin: 0 0 4px 0; color: #065f46; font-size: 13px; font-weight: 600; text-transform: uppercase;">Total Songs</p>
                  <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">${totalSongs}</p>
                </div>
              </div>
              ${releasesWithErrors > 0 ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                <p style="margin: 0 0 4px 0; color: #991b1b; font-size: 13px; font-weight: 600; text-transform: uppercase;">Releases with Errors</p>
                <p style="margin: 0; color: #dc2626; font-size: 28px; font-weight: 700;">${releasesWithErrors}</p>
              </div>
              ` : ''}
              ${releasesWithWarnings > 0 ? `
              <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                <p style="margin: 0 0 4px 0; color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase;">Releases with Warnings</p>
                <p style="margin: 0; color: #d97706; font-size: 28px; font-weight: 700;">${releasesWithWarnings}</p>
              </div>
              ` : ''}
              <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                The detailed report is attached as an Excel file.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated report generated by the Release Status Report system.
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
  private generateEmailText(releases: ReleaseStatus[], releasesWithErrors: number, releasesWithWarnings: number, totalSongs: number): string {
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let text = `RELEASE & SONG STATUS REPORT\n`;
    text += `${currentDate}\n\n`;
    text += `===========================================\n\n`;
    text += `TOTAL RELEASES: ${releases.length}\n`;
    text += `TOTAL SONGS: ${totalSongs}\n`;
    text += `RELEASES WITH ERRORS: ${releasesWithErrors}\n`;
    text += `RELEASES WITH WARNINGS: ${releasesWithWarnings}\n\n`;
    text += `The detailed report is attached as an Excel file.\n\n`;
    text += `===========================================\n\n`;
    text += `This is an automated report generated by the Release Status Report system.\n`;
    text += `Report generated on ${new Date().toLocaleString('en-US')}\n`;

    return text;
  }

  /**
   * Send email with Excel attachment
   */
  private async sendEmailReport(
    excelBuffer: Buffer,
    releases: ReleaseStatus[],
    releasesWithErrors: number,
    releasesWithWarnings: number,
    totalSongs: number
  ): Promise<void> {
    console.log(`Sending email report to ${this.superadminEmail}...`);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `release-status-report_${dateStr}.xlsx`;

    let subject = `Release Status Report - ${releases.length} Releases, ${totalSongs} Songs`;
    if (releasesWithErrors > 0) {
      subject = `${subject} (${releasesWithErrors} with errors)`;
    }

    const htmlBody = this.generateEmailHTML(releases, releasesWithErrors, releasesWithWarnings, totalSongs);
    const textBody = this.generateEmailText(releases, releasesWithErrors, releasesWithWarnings, totalSongs);

    const mailOptions = {
      from: `Melt Records Dashboard - System Notifications <${this.fromEmail}>`,
      to: this.superadminEmail,
      subject: `[release-status-report] ${subject}`,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
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
   * Main process to generate report and send email
   */
  async generateAndSendReport(): Promise<{ releaseCount: number; songCount: number; errorCount: number; warningCount: number }> {
    console.log('Starting release status report process...');

    try {
      // Authenticate with API
      await this.authenticate();

      // Fetch all releases
      const releases = await this.fetchAllReleases();

      // Calculate stats
      let totalSongs = 0;
      let releasesWithErrors = 0;
      let releasesWithWarnings = 0;

      for (const release of releases) {
        totalSongs += release.songs.length;
        const validation = this.validateRelease(release);
        if (validation.errors.length > 0) releasesWithErrors++;
        if (validation.warnings.length > 0) releasesWithWarnings++;
      }

      console.log(`\nReport Summary:`);
      console.log(`  Total releases: ${releases.length}`);
      console.log(`  Total songs: ${totalSongs}`);
      console.log(`  Releases with errors: ${releasesWithErrors}`);
      console.log(`  Releases with warnings: ${releasesWithWarnings}`);

      // Generate Excel
      const excelBuffer = await this.generateExcel(releases);

      // Send email
      await this.sendEmailReport(excelBuffer, releases, releasesWithErrors, releasesWithWarnings, totalSongs);

      console.log('Release status report completed successfully');

      return {
        releaseCount: releases.length,
        songCount: totalSongs,
        errorCount: releasesWithErrors,
        warningCount: releasesWithWarnings,
      };
    } catch (error: any) {
      console.error('Release status report process failed:', error.message);
      throw error;
    }
  }
}

/**
 * Lambda handler function
 */
export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('Release Status Report Lambda triggered', { event, context });

  try {
    const service = new ReleaseStatusReportService();
    const result = await service.generateAndSendReport();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Release status report completed successfully',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Release status report failed',
        error: error.message,
      }),
    };
  }
};
