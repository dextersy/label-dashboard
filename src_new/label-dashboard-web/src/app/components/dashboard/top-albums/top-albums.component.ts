import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface TopEarningRelease {
  id: number;
  catalog_no: string;
  title: string;
  artist_name: string;
  total_earnings: number;
}

@Component({
  selector: 'app-top-albums',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-albums.component.html',
  styleUrl: './top-albums.component.scss'
})
export class TopAlbumsComponent {
  @Input() releases: TopEarningRelease[] = [];

  constructor(private router: Router) {}

  goToFinancial(): void {
    this.router.navigate(['/financial'], { fragment: 'release' });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}