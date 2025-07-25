import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Payment, PaymentMethod, PayoutSettings } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-payments-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './financial-payments-tab.component.html',
  styleUrl: './financial-payments-tab.component.scss'
})
export class FinancialPaymentsTabComponent {
  @Input() payments: Payment[] = [];
  @Input() paymentMethods: PaymentMethod[] = [];
  @Input() payoutSettings: PayoutSettings | null = null;
  @Input() supportedBanks: { bank_code: string; bank_name: string }[] = [];
  @Input() addPaymentMethodForm: any = {};
  @Input() onSubmitPaymentMethod: () => Promise<void> = async () => {};
  @Input() onUpdatePayoutSettings: () => Promise<void> = async () => {};

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }
}