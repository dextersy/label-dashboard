import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { EventService, WristbandOrder } from '../../../services/event.service';

@Component({
  selector: 'app-wristband-order-review',
  imports: [CommonModule, BreadcrumbComponent, IconComponent],
  templateUrl: './wristband-order-review.component.html',
})
export class WristbandOrderReviewComponent implements OnInit {
  order: WristbandOrder | null = null;
  loading = true;
  loadError: string | null = null;

  actionDone = false;
  actionResult: 'confirmed' | 'rejected' | null = null;
  actionError: string | null = null;
  actioning = false;

  private orderId: number | null = null;

  readonly PRICE_PER_10 = 35;

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
        },
        error: (err) => {
          this.loading = false;
          this.loadError = err?.error?.error ?? 'Failed to load order.';
        },
      });
    });
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
}
