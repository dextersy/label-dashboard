import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarningsTableComponent } from '../earnings-table/earnings-table.component';
import { RoyaltiesTableComponent } from '../royalties-table/royalties-table.component';
import { FinancialSummary, Earning, Royalty } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-summary-tab',
  standalone: true,
  imports: [CommonModule, EarningsTableComponent, RoyaltiesTableComponent],
  templateUrl: './financial-summary-tab.component.html',
  styleUrl: './financial-summary-tab.component.scss'
})
export class FinancialSummaryTabComponent {
  @Input() summary: FinancialSummary | null = null;
  @Input() latestEarnings: Earning[] = [];
  @Input() latestRoyalties: Royalty[] = [];
  @Input() isAdmin: boolean = false;
  @Input() onPayNow: () => Promise<void> = async () => {};
  
  @Output() viewEarningsDetails = new EventEmitter<void>();
  @Output() viewRoyaltiesDetails = new EventEmitter<void>();
  @Output() viewPaymentsDetails = new EventEmitter<void>();

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}