import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

export interface LatestReleaseDetail {
  id: number;
  catalog_no: string;
  title: string;
  artist_id: number | null;
  artist_name: string;
  release_date: string;
  cover_art: string | null;
  status: string;
  net_earnings: number;
}

@Component({
  selector: 'app-latest-release-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './latest-release-card.component.html'
})
export class LatestReleaseCardComponent {
  @Input() release!: LatestReleaseDetail;

  constructor(private router: Router) {}

  getCoverArtUrl(): string {
    const art = this.release?.cover_art;
    if (!art || art.trim() === '') return 'assets/img/placeholder.jpg';
    return art.startsWith('http') ? art : `${environment.apiUrl}/uploads/covers/${art}`;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  }

  getStatusClass(): string {
    switch (this.release?.status) {
      case 'Live':           return 'tw-bg-green-100 tw-text-green-700';
      case 'Pending':        return 'tw-bg-amber-100 tw-text-amber-700';
      case 'For Submission': return 'tw-bg-blue-100 tw-text-blue-700';
      case 'Taken Down':     return 'tw-bg-red-100 tw-text-red-700';
      default:               return 'tw-bg-gray-100 tw-text-gray-600';
    }
  }

  goToRelease(): void {
    if (this.release?.artist_id) {
      localStorage.setItem('selected_artist_id', this.release.artist_id.toString());
    }
    this.router.navigate(['/music/releases/edit', this.release.id]);
  }
}
