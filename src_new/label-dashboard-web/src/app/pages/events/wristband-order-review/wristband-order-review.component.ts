import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';
import { EventService, WristbandColor, WristbandOrder } from '../../../services/event.service';
import { BrandService, BrandSettings } from '../../../services/brand.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-wristband-order-review',
  imports: [CommonModule, FormsModule, BreadcrumbComponent, IconComponent, FloatingActionBarComponent],
  templateUrl: './wristband-order-review.component.html',
  styleUrl: './wristband-order-review.component.scss',
})
export class WristbandOrderReviewComponent implements OnInit {
  order: WristbandOrder | null = null;
  loading = true;
  loadError: string | null = null;

  actionDone = false;
  actionResult: 'confirmed' | 'rejected' | 'shipped' | null = null;
  actionError: string | null = null;
  actioning = false;
  markingAsShipped = false;
  showShipForm = false;
  trackingUrlInput = '';

  showShippingFeeForm = false;
  shippingFeeInput: number | null = null;
  settingShippingFee = false;
  shippingFeeError: string | null = null;

  showDiscountForm = false;
  discountInput: number | null = null;
  settingDiscount = false;
  discountError: string | null = null;

  wristbandColors: WristbandColor[] = [];
  previewColorSlug = '';

  private orderId: number | null = null;
  private brandSettings: BrandSettings | null = null;

  readonly PRICE_PER_10 = 35;

  // Template PNG dimensions and canvas layout constants (must mirror event-add-ons)
  readonly TEMPLATE_W = 2000;
  readonly TEMPLATE_H = 152;
  private readonly CANVAS_ASPECT = 0.107;
  private readonly TMPL_L = 0.05;
  private readonly TMPL_T = 0.18;
  private readonly TMPL_W_FRAC = 0.90;
  private readonly TMPL_H_FRAC = 0.64;

  downloading = false;
  printingSheet = false;
  downloadingPackingSlip = false;
  downloadDropdownOpen = false;

  constructor(
    private route: ActivatedRoute,
    private breadcrumbService: BreadcrumbService,
    private eventService: EventService,
    private brandService: BrandService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'Events', route: '/campaigns/events', icon: 'ticket' },
      { label: 'Add-ons', route: '/campaigns/events/add-ons' },
      { label: 'Review Order' },
    ]);

    this.brandService.brandSettings$.subscribe(s => { this.brandSettings = s; });

    this.eventService.getWristbandColors().subscribe({
      next: (colors) => {
        this.wristbandColors = colors;
        this.syncPreviewColor();
      },
    });

    this.route.queryParams.subscribe(params => {
      this.orderId = params['order_id'] ? parseInt(params['order_id']) : null;

      // Reset all transient state when navigating to a different order
      this.order = null;
      this.loading = true;
      this.loadError = null;
      this.actionDone = false;
      this.actionResult = null;
      this.actionError = null;
      this.actioning = false;
      this.markingAsShipped = false;
      this.showShipForm = false;
      this.trackingUrlInput = '';
      this.showShippingFeeForm = false;
      this.shippingFeeInput = null;
      this.shippingFeeError = null;
      this.showDiscountForm = false;
      this.discountInput = null;
      this.discountError = null;
      this.previewColorSlug = '';
      this.downloadDropdownOpen = false;

      if (!this.orderId) {
        this.loading = false;
        this.loadError = 'No order ID specified.';
        return;
      }

      this.eventService.getWristbandOrderById(this.orderId).subscribe({
        next: (order) => {
          this.order = order;
          this.loading = false;
          this.syncPreviewColor();
        },
        error: (err) => {
          this.loading = false;
          this.loadError = err?.error?.error ?? 'Failed to load order.';
        },
      });
    });
  }

  // Default preview to the first color in the order, or first available color overall
  private syncPreviewColor(): void {
    if (this.previewColorSlug) return;
    const first = this.orderedColors[0]?.slug ?? this.wristbandColors[0]?.slug;
    if (first) this.previewColorSlug = first;
  }

  get orderedColors(): WristbandColor[] {
    const slugs = new Set(
      (this.order?.items ?? []).filter(i => i.quantity > 0 && i.color).map(i => i.color!.slug)
    );
    return this.wristbandColors.filter(c => slugs.has(c.slug));
  }

  get previewColor(): WristbandColor | undefined {
    return this.orderedColors.find(c => c.slug === this.previewColorSlug)
      ?? this.orderedColors[0];
  }

  selectPreviewColor(slug: string): void {
    this.previewColorSlug = slug;
  }

  // Design position expressed as percentages of the canvas dimensions so the
  // overlay scales correctly at any canvas width without needing a ViewChild.
  get designLeftPct(): number {
    const cW = this.order?.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    return ((this.order?.design_x ?? 0) / cW) * 100;
  }

  get designTopPct(): number {
    const cW = this.order?.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    return ((this.order?.design_y ?? 0) / (cW * this.CANVAS_ASPECT)) * 100;
  }

  get designWidthPct(): number {
    const cW = this.order?.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    return ((this.order?.design_width ?? 0) / cW) * 100;
  }

  get designHeightPct(): number {
    const cW = this.order?.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    return ((this.order?.design_height ?? 0) / (cW * this.CANVAS_ASPECT)) * 100;
  }

  private executeAction(action: 'confirm' | 'reject'): void {
    if (!this.orderId || this.actioning) return;
    this.actioning = true;
    this.actionError = null;

    const obs = action === 'confirm'
      ? this.eventService.confirmWristbandOrder(this.orderId)
      : this.eventService.rejectWristbandOrder(this.orderId);

    obs.subscribe({
      next: () => {
        this.actioning = false;
        this.actionDone = true;
        this.actionResult = action === 'confirm' ? 'confirmed' : 'rejected';
        if (this.order) this.order = { ...this.order, status: action === 'confirm' ? 'confirmed' : 'rejected' };
      },
      error: (err: any) => {
        this.actioning = false;
        this.actionError = err?.error?.error ?? `Failed to ${action} order.`;
      },
    });
  }

  confirm(): void { this.executeAction('confirm'); }
  reject(): void  { this.executeAction('reject'); }

  openShipForm(): void {
    this.trackingUrlInput = '';
    this.actionError = null;
    this.showShipForm = true;
  }

  cancelShipForm(): void {
    this.showShipForm = false;
    this.trackingUrlInput = '';
  }

  markAsShipped(): void {
    if (!this.orderId || this.markingAsShipped) return;
    this.markingAsShipped = true;
    this.actionError = null;
    const raw = this.trackingUrlInput.trim();
    const trackingUrl = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw || null;
    this.eventService.markWristbandOrderAsShipped(this.orderId, trackingUrl).subscribe({
      next: () => {
        this.markingAsShipped = false;
        this.showShipForm = false;
        this.actionDone = true;
        this.actionResult = 'shipped';
        if (this.order) this.order = { ...this.order, status: 'shipped', tracking_url: trackingUrl };
      },
      error: (err: any) => {
        this.markingAsShipped = false;
        this.actionError = err?.error?.error ?? 'Failed to mark order as shipped.';
      },
    });
  }

  get eventTitle(): string | null {
    return (this.order as any)?.event?.title ?? null;
  }

  get totalQty(): number {
    return (this.order?.items ?? []).reduce((s, i) => s + i.quantity, 0);
  }

  get totalPrice(): number {
    return (this.totalQty / 10) * this.PRICE_PER_10;
  }

  get grandTotal(): number {
    const subtotal = this.totalPrice + parseFloat(String(this.order?.shipping_fee ?? 0));
    const discount = parseFloat(String(this.order?.discount ?? 0));
    return Math.max(0, subtotal - discount);
  }

  get deliveryAddress(): string | null {
    const s = (this.order as any)?.event?.wristbandSettings;
    if (!s) return null;
    const parts: string[] = [
      s.delivery_name,
      s.delivery_street,
      [s.delivery_city, s.delivery_country, s.delivery_zip].filter(Boolean).join(', '),
      s.delivery_phone,
    ].filter(Boolean);
    return parts.length ? parts.join('\n') : null;
  }

  openShippingFeeForm(): void {
    this.shippingFeeInput = this.order?.shipping_fee ?? null;
    this.shippingFeeError = null;
    this.showShippingFeeForm = true;
  }

  cancelShippingFeeForm(): void {
    this.showShippingFeeForm = false;
    this.shippingFeeError = null;
  }

  saveShippingFee(): void {
    if (!this.order || this.settingShippingFee) return;
    const fee = this.shippingFeeInput;
    if (fee !== null && (isNaN(fee) || fee < 0)) {
      this.shippingFeeError = 'Enter a valid non-negative amount.';
      return;
    }
    this.settingShippingFee = true;
    this.shippingFeeError = null;
    this.eventService.setWristbandShippingFee(this.order.id, fee).subscribe({
      next: (updated) => {
        this.order = updated;
        this.settingShippingFee = false;
        this.showShippingFeeForm = false;
      },
      error: (err: any) => {
        this.settingShippingFee = false;
        this.shippingFeeError = err?.error?.error ?? 'Failed to save shipping fee.';
      },
    });
  }

  removeShippingFee(): void {
    if (!this.order || this.settingShippingFee) return;
    this.settingShippingFee = true;
    this.shippingFeeError = null;
    this.eventService.setWristbandShippingFee(this.order.id, null).subscribe({
      next: (updated) => {
        this.order = updated;
        this.settingShippingFee = false;
        this.showShippingFeeForm = false;
      },
      error: (err: any) => {
        this.settingShippingFee = false;
        this.shippingFeeError = err?.error?.error ?? 'Failed to remove shipping fee.';
      },
    });
  }

  openDiscountForm(): void {
    this.discountInput = this.order?.discount ?? null;
    this.discountError = null;
    this.showDiscountForm = true;
  }

  cancelDiscountForm(): void {
    this.showDiscountForm = false;
    this.discountError = null;
  }

  saveDiscount(): void {
    if (!this.order || this.settingDiscount) return;
    const amount = this.discountInput;
    if (amount !== null && (isNaN(amount) || amount < 0)) {
      this.discountError = 'Enter a valid non-negative amount.';
      return;
    }
    this.settingDiscount = true;
    this.discountError = null;
    this.eventService.setWristbandDiscount(this.order.id, amount).subscribe({
      next: (updated) => {
        this.order = updated;
        this.settingDiscount = false;
        this.showDiscountForm = false;
      },
      error: (err: any) => {
        this.settingDiscount = false;
        this.discountError = err?.error?.error ?? 'Failed to save discount.';
      },
    });
  }

  removeDiscount(): void {
    if (!this.order || this.settingDiscount) return;
    this.settingDiscount = true;
    this.discountError = null;
    this.eventService.setWristbandDiscount(this.order.id, null).subscribe({
      next: (updated) => {
        this.order = updated;
        this.settingDiscount = false;
        this.showDiscountForm = false;
      },
      error: (err: any) => {
        this.settingDiscount = false;
        this.discountError = err?.error?.error ?? 'Failed to remove discount.';
      },
    });
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      draft: 'status-warning',
      placed: 'status-info',
      rejected: 'status-danger',
      confirmed: 'status-success',
      shipped: 'status-shipped',
    };
    return `status-badge ${map[status] ?? 'status-secondary'}`;
  }

  downloadDesign(): void {
    const order = this.order;
    if (!order?.design_url || this.downloading) return;

    const canvasW = order.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    const canvasH = canvasW * this.CANVAS_ASPECT;
    const scaleX = this.TEMPLATE_W / (this.TMPL_W_FRAC * canvasW);
    const scaleY = this.TEMPLATE_H / (this.TMPL_H_FRAC * canvasH);

    const x = ((order.design_x ?? 0) - this.TMPL_L * canvasW) * scaleX;
    const y = ((order.design_y ?? 0) - this.TMPL_T * canvasH) * scaleY;
    const w = (order.design_width ?? 0) * scaleX;
    const h = (order.design_height ?? 0) * scaleY;

    this.downloading = true;

    const token = localStorage.getItem('auth_token');
    const proxyUrl = `${environment.apiUrl}/events/wristband-orders/${order.id}/design`;

    fetch(proxyUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch design');
        return res.blob();
      })
      .then(blob => new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { resolve(img); URL.revokeObjectURL(objectUrl); };
        img.onerror = () => { reject(); URL.revokeObjectURL(objectUrl); };
        img.src = objectUrl;
      }))
      .then(img => {
        const canvas = document.createElement('canvas');
        canvas.width = this.TEMPLATE_W;
        canvas.height = this.TEMPLATE_H;
        const ctx = canvas.getContext('2d')!;

        // Replicate object-fit: contain — scale image to fit inside (w × h) box while preserving aspect ratio
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const boxAspect = w / h;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgAspect > boxAspect) {
          drawW = w;
          drawH = w / imgAspect;
          drawX = x;
          drawY = y + (h - drawH) / 2;
        } else {
          drawH = h;
          drawW = h * imgAspect;
          drawX = x + (w - drawW) / 2;
          drawY = y;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        canvas.toBlob(blob => {
          this.downloading = false;
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wristband-design-order-${order.id}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      })
      .catch(() => { this.downloading = false; });
  }

  printSheet(): void {
    const order = this.order;
    if (!order?.design_url || this.printingSheet) return;

    const canvasW = order.canvas_width ?? (this.TEMPLATE_W / this.TMPL_W_FRAC);
    const canvasH = canvasW * this.CANVAS_ASPECT;
    const scaleX = this.TEMPLATE_W / (this.TMPL_W_FRAC * canvasW);
    const scaleY = this.TEMPLATE_H / (this.TMPL_H_FRAC * canvasH);

    const x = ((order.design_x ?? 0) - this.TMPL_L * canvasW) * scaleX;
    const y = ((order.design_y ?? 0) - this.TMPL_T * canvasH) * scaleY;
    const w = (order.design_width ?? 0) * scaleX;
    const h = (order.design_height ?? 0) * scaleY;

    this.printingSheet = true;

    const token = localStorage.getItem('auth_token');
    const proxyUrl = `${environment.apiUrl}/events/wristband-orders/${order.id}/design`;

    fetch(proxyUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch design');
        return res.blob();
      })
      .then(blob => new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { resolve(img); URL.revokeObjectURL(objectUrl); };
        img.onerror = () => { reject(); URL.revokeObjectURL(objectUrl); };
        img.src = objectUrl;
      }))
      .then(img => {
        const STRIPS = 10;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = STRIPS * this.TEMPLATE_H;  // 1520px (10 × 19mm)
        sheetCanvas.height = this.TEMPLATE_W;           // 2000px (250mm)
        const ctx = sheetCanvas.getContext('2d')!;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

        // Each strip is the wristband (TEMPLATE_W × TEMPLATE_H) rotated 90° CW
        // so the left end of the wristband (x=0) appears at the top of the column.
        // After translate((i+1)*TEMPLATE_H, 0) + rotate(π/2):
        //   (0, 0) in strip space → top-right of column i on the sheet
        //   (TEMPLATE_W, 0)       → bottom-right of column i
        //   (0, -TEMPLATE_H)      → top-left of column i
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const boxAspect = w / h;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgAspect > boxAspect) {
          drawW = w;   drawH = w / imgAspect;
          drawX = x;   drawY = y + (h - drawH) / 2;
        } else {
          drawH = h;   drawW = h * imgAspect;
          drawX = x + (w - drawW) / 2;   drawY = y;
        }

        // Calibration — tweak these three values to align the physical print:
        //   PITCH       : px between strip columns; < TEMPLATE_H (152) compresses horizontally
        //   BASE_OFFSET : leftward shift applied to every strip (negative = left)
        //   STEP_OFFSET : additional leftward shift added per strip index (progressive)
        const PITCH       = 150;   // compressed from 152
        const BASE_OFFSET = -3;    // all strips shift left
        const STEP_OFFSET = -0.3;  // each strip shifts 0.3px more left than the previous

        for (let i = 0; i < STRIPS; i++) {
          ctx.save();
          ctx.translate((i + 1) * PITCH + BASE_OFFSET + i * STEP_OFFSET, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }

        const dataUrl = sheetCanvas.toDataURL('image/png');
        this.printingSheet = false;

        const printWin = window.open('', '_blank');
        if (!printWin) return;
        const orderId = order.id;
        printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Wristband Print Sheet \u2013 Order #${orderId}</title>
  <style>
    @page { size: 190mm 250mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: 190mm; height: 250mm; overflow: hidden; }
    img { display: block; width: 190mm; height: 250mm; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Wristband print sheet">
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`);
        printWin.document.close();
      })
      .catch(() => { this.printingSheet = false; });
  }

  downloadPackingSlip(): void {
    const order = this.order;
    if (!order || this.downloadingPackingSlip) return;

    this.downloadingPackingSlip = true;

    const address = this.deliveryAddress ?? '(No delivery address on file)';
    const eventTitle = this.eventTitle ?? '';

    const brand = this.brandSettings;
    const brandColor = brand?.brand_color ?? '#000000';
    const brandName = brand?.name ?? '';
    const logoUrl = brand?.logo_url ?? null;

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${brandName}" class="brand-logo">`
      : `<span class="brand-name-text">${brandName}</span>`;

    const itemRows = (order.items ?? [])
      .filter(i => i.quantity > 0)
      .map(i => {
        const label = i.color?.label ?? '—';
        const price = ((i.quantity / 10) * this.PRICE_PER_10).toFixed(2);
        return `<tr>
          <td>${label}</td>
          <td class="num">${i.quantity}</td>
          <td class="num">&#8369;${price}</td>
        </tr>`;
      })
      .join('');

    const shippingRow = order.shipping_fee != null
      ? `<tr class="subtotal">
          <td>Shipping fee</td>
          <td class="num">—</td>
          <td class="num">&#8369;${parseFloat(String(order.shipping_fee)).toFixed(2)}</td>
        </tr>`
      : '';

    const discountRow = order.discount != null
      ? `<tr class="subtotal">
          <td>Discount</td>
          <td class="num">—</td>
          <td class="num">&#8722;&#8369;${parseFloat(String(order.discount)).toFixed(2)}</td>
        </tr>`
      : '';

    const addressHtml = address.split('\n').map(l => `<div>${l}</div>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Packing Slip \u2013 Wristband Order #${order.id}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${brandColor}; padding-bottom: 5mm; margin-bottom: 7mm; }
    .brand-logo { max-height: 14mm; max-width: 50mm; object-fit: contain; display: block; filter: brightness(0); }
    .brand-name-text { font-size: 14pt; font-weight: bold; color: ${brandColor}; }
    .header-right { text-align: right; }
    h1 { font-size: 18pt; margin: 0 0 1mm; }
    .meta { font-size: 9pt; color: #555; }
    .section-label { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 2mm; border-bottom: 1px solid #ccc; padding-bottom: 1mm; margin-top: 6mm; }
    .address { font-size: 10pt; line-height: 1.6; margin-top: 2mm; }
    table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
    th { text-align: left; font-size: 9pt; font-weight: bold; padding: 2mm 2mm; border-bottom: 1.5px solid #333; }
    td { padding: 2mm 2mm; font-size: 10pt; border-bottom: 1px solid #e0e0e0; }
    .num { text-align: right; }
    tr.subtotal td { color: #555; }
    tfoot tr td { font-weight: bold; border-top: 1.5px solid #333; border-bottom: none; padding-top: 3mm; }
    .footer { font-size: 8pt; color: #aaa; margin-top: 8mm; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 3mm; }
    .receipt-cut { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px dashed #999; padding-top: 4mm; background: #fff; page-break-inside: avoid; }
    .receipt-cut-label { font-size: 7.5pt; color: #888; text-align: center; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4mm; }
    .receipt-cut-label::before, .receipt-cut-label::after { content: '  ✂  '; }
    .receipt-title { font-size: 12pt; font-weight: bold; margin: 0 0 1mm; }
    .receipt-meta { font-size: 9pt; color: #555; margin-bottom: 3mm; }
    .receipt-fields { display: flex; gap: 8mm; margin-top: 5mm; padding-bottom: 4mm; }
    .receipt-field { flex: 1; }
    .receipt-field-wide { flex: 2; }
    .receipt-field-label { font-size: 8pt; color: #666; margin-bottom: 2mm; }
    .receipt-field-line { border-bottom: 1px solid #333; height: 14mm; }
  </style>
</head>
<body>
  <div class="header">
    <div>${logoHtml}</div>
    <div class="header-right">
      <h1>Packing Slip</h1>
      <div class="meta">Order #${order.id}${eventTitle ? ' &mdash; ' + eventTitle : ''}</div>
    </div>
  </div>

  <div class="section-label">Ship To</div>
  <div class="address">${addressHtml}</div>

  <div class="section-label">Items</div>
  <table>
    <thead>
      <tr>
        <th>Color</th>
        <th class="num">Qty</th>
        <th class="num">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${shippingRow}
      ${discountRow}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${this.totalQty}</td>
        <td class="num">&#8369;${this.grandTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">${brandName} &mdash; Generated ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>

  <div class="receipt-cut">
    <div class="receipt-cut-label">Delivery Receipt &mdash; Cut and retain</div>
    <div class="receipt-title">Delivery Receipt</div>
    <div class="receipt-meta">Order #${order.id}${eventTitle ? ' &mdash; ' + eventTitle : ''} &mdash; ${this.totalQty} wristband${this.totalQty !== 1 ? 's' : ''}</div>
    <div class="address">${addressHtml}</div>
    <div class="receipt-fields">
      <div class="receipt-field receipt-field-wide">
        <div class="receipt-field-label">Received by (print name &amp; signature)</div>
        <div class="receipt-field-line"></div>
      </div>
      <div class="receipt-field">
        <div class="receipt-field-label">Date received</div>
        <div class="receipt-field-line"></div>
      </div>
    </div>
  </div>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    this.downloadingPackingSlip = false;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }
}
