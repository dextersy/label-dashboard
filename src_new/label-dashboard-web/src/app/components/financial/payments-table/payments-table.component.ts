import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Payment } from '../../../pages/financial/financial.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters } from '../../shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-payments-table',
  standalone: true,
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

  isAdmin = false;

  // Define table columns for search and sort functionality
  paymentsColumns: TableColumn[] = [
    { 
      key: 'date_paid', 
      label: 'Date', 
      type: 'date', 
      searchable: true, 
      sortable: true,
      mobileClass: 'mobile-narrow',
      tabletClass: ''
    },
    { 
      key: 'description', 
      label: 'Description', 
      type: 'text', 
      searchable: true, 
      sortable: true,
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
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
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

  isNonCashPayment(payment: Payment): boolean {
    // Check if payment has no method data (both PaymentMethod and legacy fields)
    const hasPaymentMethod = payment.paymentMethod && payment.paymentMethod.type;
    const hasLegacyData = payment.paid_thru_type && payment.paid_thru_type.trim() !== '';
    
    return !hasPaymentMethod && !hasLegacyData;
  }

  navigateToNewPayment(): void {
    this.router.navigate(['/financial/payments/new']);
  }
}