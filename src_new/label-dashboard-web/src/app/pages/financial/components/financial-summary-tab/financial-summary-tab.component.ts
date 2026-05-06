import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinancialSummary, Earning, Royalty, PayoutSettings } from '../../financial.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-financial-summary-tab',
    imports: [CommonModule, IconComponent],
    templateUrl: './financial-summary-tab.component.html',
    styleUrl: './financial-summary-tab.component.scss'
})
export class FinancialSummaryTabComponent {
  @Input() summary: FinancialSummary | null = null;
  @Input() latestEarnings: Earning[] = [];
  @Input() latestRoyalties: Royalty[] = [];
  @Input() isAdmin: boolean = false;
  @Input() payoutSettings: PayoutSettings | null = null;
  @Input() onPayNow: () => Promise<void> = async () => {};

  @Output() viewEarningsDetails = new EventEmitter<void>();
  @Output() viewRoyaltiesDetails = new EventEmitter<void>();
  @Output() viewPaymentsDetails = new EventEmitter<void>();

  activeMobileTab: 'earnings' | 'royalties' = 'earnings';

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}