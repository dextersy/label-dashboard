import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Payment } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-payments-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payments-table.component.html',
  styleUrl: './payments-table.component.scss'
})
export class PaymentsTableComponent {
  @Input() payments: Payment[] = [];
  @Input() showHeader: boolean = true;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  formatPaymentMethod(payment: Payment): string {
    // If no payment method type is set, show as non-cash
    if (!payment.paid_thru_type || payment.paid_thru_type.trim() === '') {
      return 'Non-cash / adjustment';
    }
    
    // Format regular payment methods
    if (payment.paid_thru_account_name) {
      return `${payment.paid_thru_type} - ${payment.paid_thru_account_name}`;
    }
    
    return payment.paid_thru_type;
  }

  isNonCashPayment(payment: Payment): boolean {
    return !payment.paid_thru_type || payment.paid_thru_type.trim() === '';
  }
}