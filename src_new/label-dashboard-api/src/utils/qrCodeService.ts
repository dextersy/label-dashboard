import QRCode from 'qrcode';
import AWS from 'aws-sdk';

// Configure AWS S3 (reusing existing configuration pattern)
AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const s3 = new AWS.S3();
const S3_BUCKET = process.env.S3_BUCKET || 'melt-records-assets';

export class QRCodeService {
  /**
   * Generate QR code filename based on event ID and ticket code
   * Format: "QR-<event ID>-<ticket code>"
   */
  private static generateQRCodeFilename(eventId: number, ticketCode: string): string {
    return `QR-${eventId}-${ticketCode}.png`;
  }

  /**
   * Generate S3 key for QR code storage
   */
  private static generateS3Key(eventId: number, ticketCode: string): string {
    const filename = this.generateQRCodeFilename(eventId, ticketCode);
    return `qr-codes/${filename}`;
  }

  /**
   * Check if QR code already exists in S3
   */
  static async qrCodeExists(eventId: number, ticketCode: string): Promise<boolean> {
    try {
      const key = this.generateS3Key(eventId, ticketCode);
      
      await s3.headObject({
        Bucket: S3_BUCKET,
        Key: key
      }).promise();
      
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }


  /**
   * Generate QR code and upload to S3
   */
  static async generateAndStoreQRCode(eventId: number, ticketCode: string): Promise<string> {
    try {
      const key = this.generateS3Key(eventId, ticketCode);
      
      // Generate QR code as buffer containing just the ticket code
      const qrCodeBuffer = await QRCode.toBuffer(ticketCode, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Upload to S3
      const uploadParams = {
        Bucket: S3_BUCKET,
        Key: key,
        Body: qrCodeBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      };

      await s3.upload(uploadParams).promise();

      // Return the public S3 URL
      return `https://${S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Failed to generate and store QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Get QR code URL from S3 (if it exists) or generate new one
   */
  static async getOrCreateQRCodeUrl(eventId: number, ticketCode: string): Promise<string> {
    try {
      // Check if QR code already exists
      const exists = await this.qrCodeExists(eventId, ticketCode);
      
      if (exists) {
        // Return existing S3 URL
        const key = this.generateS3Key(eventId, ticketCode);
        return `https://${S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
      } else {
        // Generate and store new QR code
        return await this.generateAndStoreQRCode(eventId, ticketCode);
      }
    } catch (error) {
      console.error('Failed to get or create QR code:', error);
      throw new Error('Failed to process QR code');
    }
  }

  /**
   * Delete QR code from S3 (useful for ticket cancellations)
   */
  static async deleteQRCode(eventId: number, ticketCode: string): Promise<boolean> {
    try {
      const key = this.generateS3Key(eventId, ticketCode);
      
      await s3.deleteObject({
        Bucket: S3_BUCKET,
        Key: key
      }).promise();
      
      return true;
    } catch (error) {
      console.error('Failed to delete QR code:', error);
      return false;
    }
  }
}