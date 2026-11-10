import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../../components/shared/date-range-filter/date-range-filter.component';
import { environment } from 'environments/environment';

export interface TopEarningRelease {
  id: number;
  catalog_no: string;
  title: string;
  artist_name: string;
  total_earnings: number;
  cover_art?: string;
}

@Component({
    selector: 'app-top-albums',
    imports: [CommonModule, DateRangeFilterComponent],
    templateUrl: './top-albums.component.html',
    styleUrl: './top-albums.component.scss'
})
export class TopAlbumsComponent implements OnInit {
  @Input() ctaLabel: string = 'View all release earnings →';
  @Input() ctaRoute: string = '/financial/release';

  releases: TopEarningRelease[] = [];
  loading = false;
  private startDate = '';
  private endDate = '';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  get displayReleases(): TopEarningRelease[] {
    return this.releases.slice(0, 6);
  }

  get combinedEarnings(): number {
    return this.displayReleases.reduce((s, r) => s + (r.total_earnings || 0), 0);
  }

  getMax(): number {
    return Math.max(0, ...this.displayReleases.map(r => r.total_earnings || 0));
  }

  getPct(value: number): number {
    const max = this.getMax();
    if (max === 0) return 0;
    return Math.max(0, Math.round((value / max) * 100));
  }

  formatShort(amount: number): string {
    const v = amount || 0;
    if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(0) + 'K';
    return '₱' + Math.round(v);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  }

  onDateRangeChange(range: DateRangeSelection): void {
    if (range.preset === 'alltime') {
      this.startDate = '';
      this.endDate = '';
    } else {
      this.startDate = range.startDate;
      this.endDate = range.endDate;
    }
    this.loadData();
  }

  goToFinancial(): void {
    this.router.navigate([this.ctaRoute]);
  }

  private loadData(): void {
    this.loading = true;
    const params = new URLSearchParams();
    if (this.startDate) params.set('startDate', this.startDate);
    if (this.endDate)   params.set('endDate', this.endDate);
    const query = params.toString() ? `?${params}` : '';

    this.http.get<{ releases: TopEarningRelease[] }>(`${environment.apiUrl}/dashboard/top-earning-releases${query}`).subscribe({
      next: ({ releases }) => {
        this.releases = releases;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
