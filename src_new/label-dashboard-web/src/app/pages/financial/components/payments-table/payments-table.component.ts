import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Payment } from '../../financial.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, TableAction, HeaderAction, SearchFilters } from '../../../../components/shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../../services/auth.service';
import { FinancialService } from '../../../../services/financial.service';
import { NotificationService } from '../../../../services/notification.service';

@Component({
    selector: 'app-payments-table',
    imports: [CommonModule, PaginatedTableComponent],
    templateUrl: './payments-table.component.html',
    styleUrl: './payments-table.component.scss'
})
export class PaymentsTableComponent implements OnInit, OnChanges {
  @Input() payments: Payment[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() sortInfo: { column: string; direction: 'asc' | 'desc' } | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' } | null>();
  @Output() refresh = new EventEmitter<void>();

  isAdmin = false;

  rowActions: TableAction[] = [
    {
      icon: 'fas fa-check-circle',
      label: 'Mark as succeeded',
      type: 'secondary',
      hidden: (payment: Payment) => !this.isAdmin || payment.status === 'succeeded',
      handler: (payment: Payment) => this.updateStatus(payment, 'succeeded')
    },
    {
      icon: 'fas fa-ban',
      label: 'Void payment',
      type: 'danger',
      hidden: (payment: Payment) => !this.isAdmin || payment.status === 'failed',
      handler: (payment: Payment) => this.updateStatus(payment, 'failed')
    }
  ];

  get headerActions(): HeaderAction[] {
    if (!this.isAdmin) return [];
    return [{
      icon: 'fas fa-plus',
      label: 'Add',
      handler: () => this.navigateToNewPayment(),
      type: 'primary',
      title: 'Add new payment',
    }];
  }

  // Define table columns for search and sort functionality
  paymentsColumns: TableColumn[] = [
    {
      key: 'date_paid',
      label: 'Date',
      type: 'date',
      searchable: true,
      sortable: true,
      mobileGroup: 'summary',
      mobileClass: 'mobile-narrow',
      tabletClass: ''
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      searchable: true,
      sortable: true,
      mobileGroup: 'summary',
      mobileGroupMain: true,
      mobileClass: 'mobile-text',
      tabletClass: ''
    },
    {
      key: 'paid_thru_type',
      label: 'Method',
      type: 'text',
      searchable: true,
      sortable: true,
      formatter: (payment: any) => this.formatPaymentMethod(payment),
      mobileClass: '',
      tabletClass: 'tablet-hide'
    },
    {
      key: 'amount',
      label: 'Amount',
      type: 'number',
      searchable: true,
      sortable: true,
      align: 'right',
      mobileClass: 'mobile-narrow mobile-number',
      tabletClass: ''
    },
    {
      key: 'payment_processing_fee',
      label: 'Fee',
      type: 'number',
      searchable: true,
      sortable: true,
      align: 'right',
      mobileClass: 'mobile-narrow mobile-number',
      tabletClass: 'tablet-hide'
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'succeeded', label: 'Succeeded' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' }
      ],
      searchable: true,
      sortable: true,
      formatter: (payment: any) => this.formatStatus(payment.status, payment.failure_reason),
      renderHtml: true,
      mobileGroup: 'summary',
      mobileClass: 'mobile-narrow',
      tabletClass: ''
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private financialService: FinancialService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.authService.currentUser.subscribe(user => {
      this.isAdmin = user ? user.is_admin : false;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
  }

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
    // Prioritize PaymentMethod data over legacy paid_thru_* fields
    if (payment.paymentMethod) {
      const { type, account_name, account_number_or_email } = payment.paymentMethod;
      // Format as "Bank name - Account name - Account number" (matching PHP logic)
      if (type && account_name && account_number_or_email) {
        return `${type} - ${account_name} - ${account_number_or_email}`;
      }
      
      // Fallback formats for PaymentMethod
      if (type && account_name) {
        return `${type} - ${account_name}`;
      }
      
      if (type) {
        return type;
      }
    }
    
    // Fall back to legacy paid_thru_* fields (for backward compatibility)
    if (!payment.paid_thru_type || payment.paid_thru_type === null || payment.paid_thru_type.trim() === '') {
      return 'Non-cash / adjustment';
    }
    
    // Format as "Bank name - Account name - Account number" (matching PHP logic)
    if (payment.paid_thru_type && payment.paid_thru_account_name && payment.paid_thru_account_number) {
      return `${payment.paid_thru_type} - ${payment.paid_thru_account_name} - ${payment.paid_thru_account_number}`;
    }
    
    // Fallback formats for legacy fields
    if (payment.paid_thru_account_name) {
      return `${payment.paid_thru_type} - ${payment.paid_thru_account_name}`;
    }
    
    return payment.paid_thru_type;
  }

  formatStatus(status: string | undefined, failureReason?: string): string {
    switch (status) {
      case 'pending':   return '<span class="status-dot status-warning">Pending</span>';
      case 'failed': {
        let html = '<span class="status-dot status-danger">Failed</span>';
        if (failureReason) {
          html += `<br><span class="text-muted small">${failureReason}</span>`;
        }
        return html;
      }
      case 'succeeded':
      default:          return '<span class="status-dot status-success">Succeeded</span>';
    }
  }

  isNonCashPayment(payment: Payment): boolean {
    // Check if payment has no method data (both PaymentMethod and legacy fields)
    const hasPaymentMethod = payment.paymentMethod && payment.paymentMethod.type;
    const hasLegacyData = payment.paid_thru_type && payment.paid_thru_type.trim() !== '';
    
    return !hasPaymentMethod && !hasLegacyData;
  }

  async updateStatus(payment: Payment, status: 'succeeded' | 'failed'): Promise<void> {
    try {
      await this.financialService.updatePaymentStatus(payment.id, status);
      this.notificationService.showSuccess(status === 'succeeded' ? 'Payment marked as succeeded' : 'Payment voided');
      this.refresh.emit();
    } catch {
      this.notificationService.showError('Failed to update payment status');
    }
  }

  navigateToNewPayment(): void {
    this.router.navigate(['/financial/payments/new']);
  }
}