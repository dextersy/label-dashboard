import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { EventService, WristbandColor, WristbandOrder } from '../../../services/event.service';

@Component({
  selector: 'app-wristband-order-review',
  imports: [CommonModule, BreadcrumbComponent, IconComponent],
  templateUrl: './wristband-order-review.component.html',
  styleUrl: './wristband-order-review.component.scss',
})
export class WristbandOrderReviewComponent implements OnInit {
  order: WristbandOrder | null = null;
  loading = true;
  loadError: string | null = null;

  actionDone = false;
  actionResult: 'confirmed' | 'rejected' | null = null;
  actionError: string | null = null;
  actioning = false;

  wristbandColors: WristbandColor[] = [];
  previewColorSlug = '';

  private orderId: number | null = null;

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

  constructor(
    private route: ActivatedRoute,
    private breadcrumbService: BreadcrumbService,
    private eventService: EventService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'Events', route: '/campaigns/events', icon: 'ticket' },
      { label: 'Add-ons', route: '/campaigns/events/add-ons' },
      { label: 'Review Order' },
    ]);

    this.eventService.getWristbandColors().subscribe({
      next: (colors) => {
        this.wristbandColors = colors;
        this.syncPreviewColor();
      },
    });

    this.route.queryParams.subscribe(params => {
      this.orderId = params['order_id'] ? parseInt(params['order_id']) : null;

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

  get eventTitle(): string | null {
    return (this.order as any)?.event?.title ?? null;
  }

  get totalQty(): number {
    return (this.order?.items ?? []).reduce((s, i) => s + i.quantity, 0);
  }

  get totalPrice(): number {
    return (this.totalQty / 10) * this.PRICE_PER_10;
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      draft: 'status-warning',
      placed: 'status-info',
      rejected: 'status-danger',
      confirmed: 'status-success',
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

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
    };
    img.onerror = () => { this.downloading = false; };
    img.src = order.design_url;
  }
}
