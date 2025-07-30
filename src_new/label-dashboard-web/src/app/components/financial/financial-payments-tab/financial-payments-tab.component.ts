import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Payment, PaymentMethod, PayoutSettings } from '../../../pages/financial/financial.component';
import { PaymentsTableComponent } from '../payments-table/payments-table.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters } from '../../shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-financial-payments-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentsTableComponent, PaginatedTableComponent],
  templateUrl: './financial-payments-tab.component.html',
  styleUrl: './financial-payments-tab.component.scss'
})
export class FinancialPaymentsTabComponent {
  @Input() payments: Payment[] = [];
  @Input() paymentsPagination: PaginationInfo | null = null;
  @Input() paymentsLoading: boolean = false;
  @Input() paymentsSort: { column: string; direction: 'asc' | 'desc' } | null = null;
  @Input() paymentMethods: PaymentMethod[] = [];
  @Output() paymentsPageChange = new EventEmitter<number>();
  @Output() paymentsFiltersChange = new EventEmitter<SearchFilters>();
  @Output() paymentsSortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' } | null>();
  @Input() payoutSettings: PayoutSettings | null = null;
  @Input() supportedBanks: { bank_code: string; bank_name: string }[] = [];
  @Input() addPaymentMethodForm: any = {};
  @Input() addingPaymentMethod: boolean = false;
  @Input() onSubmitPaymentMethod: () => Promise<void> = async () => {};
  @Input() onUpdatePayoutSettings: () => Promise<void> = async () => {};
  @Input() onDeletePaymentMethod: (paymentMethodId: number) => Promise<void> = async () => {};
  @Input() onSetDefaultPaymentMethod: (paymentMethodId: number) => Promise<void> = async () => {};

  // Define table columns for search and sort functionality
  paymentsColumns: TableColumn[] = [
    { key: 'date_paid', label: 'Date Paid', type: 'date', searchable: true, sortable: true },
    { key: 'description', label: 'Description', type: 'text', searchable: true, sortable: true },
    { key: 'paid_thru_type', label: 'Paid Through', type: 'text', searchable: true, sortable: true },
    { key: 'amount', label: 'Amount', type: 'number', searchable: true, sortable: true },
    { key: 'payment_processing_fee', label: 'Processing Fee', type: 'number', searchable: true, sortable: true }
  ];

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  async deletePaymentMethod(paymentMethodId: number): Promise<void> {
    if (confirm('Are you sure you want to delete this payment method?')) {
      await this.onDeletePaymentMethod(paymentMethodId);
    }
  }

  async setDefaultPaymentMethod(paymentMethodId: number): Promise<void> {
    await this.onSetDefaultPaymentMethod(paymentMethodId);
  }

}