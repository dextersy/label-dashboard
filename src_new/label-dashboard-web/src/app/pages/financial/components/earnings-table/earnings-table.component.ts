import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Earning } from '../../financial.component';

@Component({
    selector: 'app-earnings-table',
    imports: [CommonModule],
    templateUrl: './earnings-table.component.html',
    styleUrl: './earnings-table.component.scss'
})
export class EarningsTableComponent {
  @Input() earnings: Earning[] = [];
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
