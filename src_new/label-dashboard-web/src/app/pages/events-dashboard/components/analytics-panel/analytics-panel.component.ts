import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventSales } from '../../../dashboard/components/event-sales-chart/event-sales-chart.component';
import { FundraiserDonations } from '../../../dashboard/components/fundraiser-donations-chart/fundraiser-donations-chart.component';

type TimeFilter = 'all' | 'year' | 'month';

interface ChartBar {
  name: string;
  value: number;
}

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-panel.component.html'
})
export class AnalyticsPanelComponent {
  @Input() eventSales: EventSales[] = [];
  @Input() fundraiserDonations: FundraiserDonations[] = [];

  activeFilter: TimeFilter = 'all';

  readonly filterOptions: { key: TimeFilter; label: string; last: boolean }[] = [
    { key: 'all',   label: 'All time',    last: false },
    { key: 'year',  label: 'This year',   last: false },
    { key: 'month', label: 'This month',  last: true  },
  ];

  setFilter(f: TimeFilter): void {
    this.activeFilter = f;
  }

  get filteredEventSales(): EventSales[] {
    if (this.activeFilter === 'all') return this.eventSales;
    const now = new Date();
    return this.eventSales.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      if (this.activeFilter === 'year')  return d.getFullYear() === now.getFullYear();
      if (this.activeFilter === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return true;
    });
  }

  get ticketSalesBars(): ChartBar[] {
    return this.filteredEventSales.map(e => ({ name: e.name || 'Untitled', value: e.total_sales || 0 }));
  }

  get ticketsSoldBars(): ChartBar[] {
    return this.filteredEventSales.map(e => ({ name: e.name || 'Untitled', value: e.tickets_sold || 0 }));
  }

  get donationsBars(): ChartBar[] {
    return this.fundraiserDonations.map(f => ({ name: f.name || 'Untitled', value: f.total_raised || 0 }));
  }

  get donorCountBars(): ChartBar[] {
    return this.fundraiserDonations.map(f => ({ name: f.name || 'Untitled', value: f.donor_count || 0 }));
  }

  get totalTicketSales(): number  { return this.ticketSalesBars.reduce((s, b) => s + b.value, 0); }
  get totalTicketsSold(): number  { return this.ticketsSoldBars.reduce((s, b) => s + b.value, 0); }
  get totalDonations(): number    { return this.donationsBars.reduce((s, b) => s + b.value, 0); }
  get totalDonors(): number       { return this.donorCountBars.reduce((s, b) => s + b.value, 0); }

  getMax(bars: ChartBar[]): number {
    return bars.length ? Math.max(0, ...bars.map(b => b.value)) : 0;
  }

  getBarHeightPx(value: number, max: number): number {
    if (max === 0 || value === 0) return 3;
    return Math.max(3, Math.round((value / max) * 100));
  }

  getBarOpacity(value: number, max: number): number {
    if (max === 0 || value === 0) return 0.25;
    if (value === max) return 1;
    return 0.65;
  }

  shouldShowLabel(value: number, max: number): boolean {
    if (max === 0) return false;
    return (value / max) >= 0.2;
  }

  isTopBar(value: number, max: number): boolean {
    return max > 0 && value === max;
  }

  formatShortCurrency(value: number): string {
    if (value >= 1_000_000) return '₱' + (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000)     return '₱' + (value / 1_000).toFixed(0) + 'K';
    return '₱' + Math.round(value);
  }

  formatShortCount(value: number): string {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000)     return (value / 1_000).toFixed(1) + 'K';
    return value.toString();
  }
}
