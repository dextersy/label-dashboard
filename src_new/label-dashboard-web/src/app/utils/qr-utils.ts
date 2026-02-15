import QRCode from 'qrcode';
import { downloadBlob } from './file-utils';

/**
 * Generate a QR code for the given URL and trigger a PNG download.
 */
export async function downloadQRCode(url: string, filename: string): Promise<void> {
  const canvas = document.createElement('canvas');

  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 512,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate QR code image.'));
        return;
      }
      downloadBlob(blob, `${filename}.png`);
      resolve();
    }, 'image/png');
  });
}
