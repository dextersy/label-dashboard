import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChildBrand } from '../../../services/admin.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';

export interface AggregatedTotals {
  event_sales: number;
  event_platform_fees: number;
  event_processing_fees: number;
  event_estimated_tax: number;
  event_earnings: number;
  add_on_payments?: number;
  music_platform_fees?: number;
  aggregated_event_platform_fees?: number;
  total_platform_fees?: number;
}

export interface DonutSegment {
  label: string;
  color: string;
  pct: number;         // 0–100
  dashoffset: number;  // SVG stroke-dashoffset (circumference = 100)
}

@Component({
    selector: 'app-earnings-breakdown-modal',
    imports: [CommonModule, IconComponent],
    templateUrl: './earnings-breakdown-modal.component.html',
    styleUrls: ['./earnings-breakdown-modal.component.scss']
})
export class EarningsBreakdownModalComponent {
  @Input() show: boolean = false;
  @Input() childBrand: ChildBrand | null = null;
  @Input() aggregatedTotals: AggregatedTotals | null = null;
  @Input() breakdownType: 'music' | 'event' | 'fundraiser' | 'platform_fees' | 'total_event' | 'total_platform_fees' = 'music';
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getMusicBreakdownTitle(): string {
    return 'Music Earnings';
  }

  getEventBreakdownTitle(): string {
    return 'Event Earnings';
  }

  getFundraiserBreakdownTitle(): string {
    return 'Fundraiser Earnings';
  }

  getPlatformFeesBreakdownTitle(): string {
    return 'Platform Fees';
  }

  getTotalEventBreakdownTitle(): string {
    return 'Event Earnings';
  }

  getTotalPlatformFeesBreakdownTitle(): string {
    return 'Platform Fees';
  }

  getModalSubtitle(): string {
    if (this.breakdownType === 'total_event' || this.breakdownType === 'total_platform_fees') {
      return 'All Sublabels';
    }
    return this.childBrand?.brand_name ?? '';
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  /** Returns donut segments or [] if the chart can't be shown (e.g. zero gross). */
  getChartSegments(): DonutSegment[] {
    const raw: { label: string; color: string; value: number }[] = [];
    let total = 0;

    if (this.breakdownType === 'music' && this.childBrand) {
      const gross = this.childBrand.music_gross_earnings;
      if (gross <= 0) return [];
      total = gross;
      raw.push({ label: 'Net Earnings', color: '#16a34a', value: Math.max(0, this.childBrand.music_earnings) });
      raw.push({ label: 'Royalties', color: '#d97706', value: this.childBrand.total_royalties });
      raw.push({ label: 'Platform Fees', color: '#ef4444', value: this.childBrand.music_platform_fees });

    } else if (this.breakdownType === 'event' && this.childBrand) {
      const gross = this.childBrand.event_sales;
      if (gross <= 0) return [];
      total = gross;
      raw.push({ label: 'Net Earnings', color: '#16a34a', value: Math.max(0, this.childBrand.event_earnings) });
      raw.push({ label: 'Platform Fees', color: '#ef4444', value: this.childBrand.event_platform_fees });
      if ((this.childBrand.add_on_payments || 0) > 0) {
        raw.push({ label: 'Add-on Payments', color: '#f97316', value: this.childBrand.add_on_payments || 0 });
      }

    } else if (this.breakdownType === 'fundraiser' && this.childBrand) {
      const gross = this.childBrand.fundraiser_gross_earnings || 0;
      if (gross <= 0) return [];
      total = gross;
      raw.push({ label: 'Net Earnings', color: '#16a34a', value: Math.max(0, this.childBrand.fundraiser_earnings || 0) });
      raw.push({ label: 'Platform Fees', color: '#ef4444', value: this.childBrand.fundraiser_platform_fees || 0 });

    } else if (this.breakdownType === 'platform_fees' && this.childBrand) {
      const t = this.childBrand.platform_fees;
      if (t <= 0) return [];
      total = t;
      raw.push({ label: 'Music Fees', color: '#0891b2', value: this.childBrand.music_platform_fees });
      raw.push({ label: 'Event Fees', color: '#d97706', value: this.childBrand.event_platform_fees });
      const ff = this.childBrand.fundraiser_platform_fees || 0;
      if (ff > 0) raw.push({ label: 'Fundraiser Fees', color: '#ef4444', value: ff });

    } else if (this.breakdownType === 'total_event' && this.aggregatedTotals) {
      const gross = this.aggregatedTotals.event_sales;
      if (gross <= 0) return [];
      total = gross;
      raw.push({ label: 'Net Earnings', color: '#16a34a', value: Math.max(0, this.aggregatedTotals.event_earnings) });
      raw.push({ label: 'Platform Fees', color: '#ef4444', value: this.aggregatedTotals.event_platform_fees });
      if ((this.aggregatedTotals.add_on_payments || 0) > 0) {
        raw.push({ label: 'Add-on Payments', color: '#f97316', value: this.aggregatedTotals.add_on_payments || 0 });
      }

    } else if (this.breakdownType === 'total_platform_fees' && this.aggregatedTotals) {
      const t = this.aggregatedTotals.total_platform_fees || 0;
      if (t <= 0) return [];
      total = t;
      raw.push({ label: 'Music Fees', color: '#0891b2', value: this.aggregatedTotals.music_platform_fees || 0 });
      raw.push({ label: 'Event Fees', color: '#d97706', value: this.aggregatedTotals.aggregated_event_platform_fees || 0 });
    }

    if (total <= 0) return [];

    // Convert to percentages and compute dashoffset (circumference = 100, start at 12 o'clock = offset 25)
    let cumulative = 0;
    return raw.map(seg => {
      const pct = (seg.value / total) * 100;
      const dashoffset = 25 - cumulative;
      cumulative += pct;
      return { label: seg.label, color: seg.color, pct, dashoffset };
    });
  }
}
