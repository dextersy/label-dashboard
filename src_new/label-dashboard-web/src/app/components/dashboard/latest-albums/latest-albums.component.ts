import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface LatestRelease {
  id: number;
  catalog_no: string;
  title: string;
  artist_name: string;
  release_date: string;
  cover_art: string;
  status: string;
}

@Component({
    selector: 'app-latest-albums',
    imports: [CommonModule],
    templateUrl: './latest-albums.component.html',
    styleUrl: './latest-albums.component.scss'
})
export class LatestAlbumsComponent {
  @Input() releases: LatestRelease[] = [];

  constructor(private router: Router) {}

  goToReleases(): void {
    this.router.navigate(['/artist/releases']);
  }

  goToRelease(releaseId: number): void {
    this.router.navigate(['/artist/releases/edit', releaseId]);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Live':
        return 'badge-success';
      case 'For Submission':
        return 'badge-info';
      case 'Pending':
        return 'badge-warning';
      case 'Draft':
        return 'badge-secondary';
      case 'Taken Down':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getImageSrc(coverArt: string): string {
    return coverArt && coverArt.trim() !== '' ? coverArt : '/assets/img/placeholder.jpg';
  }
}