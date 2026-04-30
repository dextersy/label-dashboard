import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface ArtistBalance {
  id: number;
  name: string;
  balance: number;
  profile_photo?: string;
}

const AVATAR_PALETTE = [
  { bg: 'rgba(20, 184, 166, 0.15)',  text: '#0d9488' }, // teal
  { bg: 'rgba(236, 72, 153, 0.15)',  text: '#db2777' }, // pink
  { bg: 'rgba(34, 197, 94, 0.15)',   text: '#16a34a' }, // green
  { bg: 'rgba(59, 130, 246, 0.15)',  text: '#2563eb' }, // blue
  { bg: 'rgba(156, 163, 175, 0.15)', text: '#6b7280' }, // gray
  { bg: 'rgba(251, 146, 60, 0.15)',  text: '#ea580c' }, // orange
  { bg: 'rgba(168, 85, 247, 0.15)',  text: '#9333ea' }, // purple
];

function hashName(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h;
}

@Component({
    selector: 'app-balance-table',
    imports: [CommonModule],
    templateUrl: './balance-table.component.html',
    styleUrl: './balance-table.component.scss'
})
export class BalanceTableComponent {
  @Input() artists: ArtistBalance[] = [];

  constructor(private router: Router) {}

  get netBalance(): number {
    return this.artists.reduce((s, a) => s + (a.balance || 0), 0);
  }

  getInitials(name: string): string {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  getAvatarBg(name: string): string {
    return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length].bg;
  }

  getAvatarColor(name: string): string {
    return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length].text;
  }

  getProfilePhotoUrl(profilePhoto: string | undefined): string | null {
    if (!profilePhoto || !profilePhoto.startsWith('http')) return null;
    return profilePhoto;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  goToFinancial(): void {
    this.router.navigate(['/financial']);
  }
}
