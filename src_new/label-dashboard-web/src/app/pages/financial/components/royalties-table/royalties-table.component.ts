import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Royalty } from '../../financial.component';

@Component({
    selector: 'app-royalties-table',
    imports: [CommonModule],
    templateUrl: './royalties-table.component.html',
    styleUrl: './royalties-table.component.scss'
})
export class RoyaltiesTableComponent {
  @Input() royalties: Royalty[] = [];
  @Input() showHeader: boolean = true;

  readonly coverArtPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#e5e7eb" rx="3"/><text x="14" y="20" font-size="14" text-anchor="middle" fill="#9ca3af">♪</text></svg>')}`;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }
}
