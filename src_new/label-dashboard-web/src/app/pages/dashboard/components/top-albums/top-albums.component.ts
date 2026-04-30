import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
    imports: [CommonModule],
    templateUrl: './top-albums.component.html',
    styleUrl: './top-albums.component.scss'
})
export class TopAlbumsComponent {
  @Input() releases: TopEarningRelease[] = [];

  constructor(private router: Router) {}

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

  goToFinancial(): void {
    this.router.navigate(['/financial/release']);
  }
}
