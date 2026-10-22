import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  // Only allow https:// and http:// — reject file://, data:, etc.
  if (!/^https?:\/\//i.test(url)) return null;

  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, (imgRes) => {
        let totalBytes = 0;
        const chunks: Buffer[] = [];

        imgRes.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_IMAGE_BYTES) {
            imgRes.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        imgRes.on('end', () => resolve(Buffer.concat(chunks)));
        imgRes.on('error', () => resolve(null));
      });

      req.setTimeout(FETCH_TIMEOUT_MS, () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** Interpolate two hex colours for the gradient accent band. */
export function lerpHex(from: string, to: string, t: number): string {
  const f = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = f(from);
  const [r2, g2, b2] = f(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Draw a simulated left→right gradient rect using thin vertical slices. */
export function drawGradientRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  colorFrom: string, colorTo: string,
  steps = 60,
): void {
  const sliceW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.rect(x + i * sliceW, y, sliceW + 0.5, h)
      .fill(lerpHex(colorFrom, colorTo, t));
  }
}

/** Format a currency amount. Uses thousands separators; avoids non-ASCII symbols. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',   // e.g. "PHP 1,290.03" — all ASCII
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/** Short date: Oct 20, 2026 */
export function fmtShort(d: Date | string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Draw a small filled circle (replaces Unicode bullet which breaks built-in fonts). */
export function drawDot(doc: InstanceType<typeof PDFDocument>, cx: number, cy: number, r: number, color: string): void {
  doc.save().circle(cx, cy, r).fill(color).restore();
}

/** Draw a horizontal hairline. */
export function hairline(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, color = '#E7E4F0'): void {
  doc.save().strokeColor(color).lineWidth(0.75).moveTo(x, y).lineTo(x + w, y).stroke().restore();
}
