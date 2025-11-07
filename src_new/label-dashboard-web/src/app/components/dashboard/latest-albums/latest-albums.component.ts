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
}

@Component({
  selector: 'app-latest-albums',
  standalone: true,
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

  getImageSrc(coverArt: string): string {
    return coverArt && coverArt.trim() !== '' ? coverArt : '/assets/img/placeholder.jpg';
  }
}