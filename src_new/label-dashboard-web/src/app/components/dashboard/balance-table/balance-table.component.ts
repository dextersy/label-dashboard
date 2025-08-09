import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface ArtistBalance {
  id: number;
  name: string;
  balance: number;
  profile_photo?: string;
}

@Component({
  selector: 'app-balance-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './balance-table.component.html',
  styleUrl: './balance-table.component.scss'
})
export class BalanceTableComponent {
  @Input() artists: ArtistBalance[] = [];

  constructor(private router: Router) {}

  goToFinancial(): void {
    this.router.navigate(['/financial']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getBalanceClass(balance: number): string {
    return balance >= 0 ? 'text-success' : 'text-danger';
  }

  getProfilePhotoUrl(profilePhoto: string | undefined): string {
    if (!profilePhoto || !profilePhoto.startsWith('http')) {
      return 'assets/img/default-avatar.png'; // Default placeholder
    }
    
    // If it's already a full URL, return as is
    return profilePhoto;
  }
}