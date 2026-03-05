import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { LabelFinanceService, LabelFinanceDashboard, LabelFinanceBreakdown, LabelPaymentMethod, LabelPayment, LabelPaymentsResponse } from '../../../services/label-finance.service';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { ModalToBodyDirective } from '../../../directives/modal-to-body.directive';
import { PaginatedTableComponent, PaginationInfo, SortInfo, TableColumn } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
    selector: 'app-label-finance-tab',
    imports: [CommonModule, FormsModule, DateRangeFilterComponent, ModalToBodyDirective, PaginatedTableComponent],
    templateUrl: './label-finance-tab.component.html',
    styleUrl: './label-finance-tab.component.scss'
})
export class LabelFinanceTabComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private brandId!: number;

  dashboard: LabelFinanceDashboard | null = null;
  breakdown: LabelFinanceBreakdown | null = null;
  breakdownType: 'music' | 'event' | 'fundraiser' = 'music';
  showBreakdownModal = false;

  breakdownLoading = false;
  breakdownPagination: PaginationInfo | null = null;
  breakdownPage = 1;
  breakdownSort: SortInfo | null = null;
  breakdownFilters: { [key: string]: string } = {};

  readonly musicColumns: TableColumn[] = [
    { key: 'release_title', label: 'Release', sortable: true },
    { key: 'gross_earnings', label: 'Gross Earnings', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-number', formatter: (item: any) => this.formatCurrency(item.gross_earnings) },
    { key: 'royalties', label: 'Royalties', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-number', formatter: (item: any) => this.formatCurrency(item.royalties) },
    { key: 'platform_fees', label: 'Platform Fees', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatCurrency(item.platform_fees) },
    { key: 'net_earnings', label: 'Net Earnings', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-number', renderHtml: true, formatter: (item: any) => { const v = item.net_earnings; return `<span class="${v < 0 ? 'text-danger' : ''}">${this.formatCurrency(v)}</span>`; } },
  ];

  readonly eventColumns: TableColumn[] = [
    { key: 'event_name', label: 'Event', sortable: true },
    { key: 'sales', label: 'Sales', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-number', formatter: (item: any) => this.formatCurrency(item.sales) },
    { key: 'platform_fees', label: 'Platform Fees', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatCurrency(item.platform_fees) },
    { key: 'processing_fees', label: 'Processing Fees', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatCurrency(item.processing_fees) },
    { key: 'net_earnings', label: 'Net Earnings', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-number', renderHtml: true, formatter: (item: any) => { const v = item.net_earnings; return `<span class="${v < 0 ? 'text-danger' : ''}">${this.formatCurrency(v)}</span>`; } },
  ];

  readonly fundraiserColumns: TableColumn[] = [
    { key: 'fundraiser_name', label: 'Fundraiser', sortable: true },
    { key: 'gross_earnings', label: 'Gross Donations', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-number', formatter: (item: any) => this.formatCurrency(item.gross_earnings) },
    { key: 'platform_fees', label: 'Platform Fees', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatCurrency(item.platform_fees) },
    { key: 'processing_fees', label: 'Processing Fees', sortable: true, searchable: false, align: 'right', tabletClass: 'tablet-hide', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatCurrency(item.processing_fees) },
    { key: 'net_earnings', label: 'Net Earnings', sortable: true, searchable: false, align: 'right', mobileClass: 'mobile-number', renderHtml: true, formatter: (item: any) => { const v = item.net_earnings; return `<span class="${v < 0 ? 'text-danger' : ''}">${this.formatCurrency(v)}</span>`; } },
  ];

  get currentBreakdownColumns(): TableColumn[] {
    return this.breakdownType === 'music' ? this.musicColumns
         : this.breakdownType === 'event'  ? this.eventColumns
         : this.fundraiserColumns;
  }

  paymentMethods: LabelPaymentMethod[] = [];
  payments: LabelPayment[] = [];
  paymentsResponse: LabelPaymentsResponse | null = null;
  paymentsLoading = false;

  readonly paymentColumns: TableColumn[] = [
    { key: 'date_paid', label: 'Date', sortable: false, formatter: (item: any) => new Date(item.date_paid).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), hideDataLabel: true },
    { key: 'description', label: 'Description', sortable: false, cardHeader: true, formatter: (item: any) => item.description || 'Payment received' , hideDataLabel: true},
    { key: 'amount', label: 'Amount', sortable: false, align: 'right', mobileClass: 'mobile-number', formatter: (item: any) => this.formatCurrency(item.amount), hideDataLabel: true },
    { key: 'payment_method', label: 'Payment Method', sortable: false, tabletClass: 'tablet-hide', mobileClass: 'mobile-hide', formatter: (item: any) => this.formatPaymentMethod(item), hideDataLabel: true },
    { key: 'reference_number', label: 'Reference', sortable: false, mobileClass: 'mobile-hide', formatter: (item: any) => item.reference_number || 'N/A', hideDataLabel: true },
  ];

  showAddPaymentMethodModal = false;
  newPaymentMethod: any = {}; // Using 'any' to allow bank_selection property
  isAddingPaymentMethod = false;
  supportedBanks: Array<{bank_code: string, bank_name: string}> = [];

  startDate?: string;
  endDate?: string;
  loading = false;

  constructor(
    private labelFinanceService: LabelFinanceService,
    private adminService: AdminService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSupportedBanks();
    
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        if (user?.brand_id) {
          this.brandId = user.brand_id;
          this.loadDashboard();
          this.loadPaymentMethods();
          this.loadPayments();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSupportedBanks(): void {
    this.subscriptions.add(
      this.adminService.getSupportedBanks().subscribe({
        next: (banks) => {
          this.supportedBanks = banks;
        },
        error: (error) => {
          console.error('Error loading supported banks:', error);
          this.notificationService.showError('Failed to load supported banks. Payment methods may not work properly.');
        }
      })
    );
  }

  onDateRangeChanged(selection: DateRangeSelection): void {
    this.startDate = selection.startDate;
    this.endDate = selection.endDate;
    this.loadDashboard();
  }

  onRefresh(): void {
    this.loadDashboard();
    this.loadPaymentMethods();
    this.loadPayments();
  }

  private loadDashboard(): void {
    if (!this.brandId) return;

    this.loading = true;
    this.subscriptions.add(
      this.labelFinanceService.getDashboard(this.brandId, this.startDate, this.endDate)
        .subscribe({
          next: (data) => {
            this.dashboard = data;
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading dashboard:', error);
            this.notificationService.showError('Failed to load dashboard data');
            this.loading = false;
          }
        })
    );
  }

  showBreakdown(type: 'music' | 'event' | 'fundraiser'): void {
    if (!this.brandId) {
      this.notificationService.showError('Brand information not loaded yet');
      return;
    }

    this.breakdownType = type;
    this.breakdown = null;
    this.breakdownPage = 1;
    this.breakdownSort = null;
    this.breakdownFilters = {};
    this.breakdownPagination = null;
    this.showBreakdownModal = true;
    this.loadBreakdown();
  }

  private loadBreakdown(): void {
    if (!this.brandId) return;

    const nameKey = this.breakdownType === 'music' ? 'release_title'
                  : this.breakdownType === 'event'  ? 'event_name'
                  : 'fundraiser_name';
    const search = this.breakdownFilters[nameKey] || undefined;

    this.breakdownLoading = true;
    this.subscriptions.add(
      this.labelFinanceService.getBreakdown(
        this.brandId,
        this.breakdownType,
        this.startDate,
        this.endDate,
        this.breakdownPage,
        10,
        this.breakdownSort?.column,
        this.breakdownSort?.direction,
        search
      ).subscribe({
        next: (data) => {
          this.breakdown = data;
          this.breakdownPagination = data.pagination;
          this.breakdownLoading = false;
        },
        error: (error) => {
          console.error('Error loading breakdown:', error);
          this.notificationService.showError('Failed to load breakdown data');
          this.breakdownLoading = false;
        }
      })
    );
  }

  onBreakdownPageChange(page: number): void {
    this.breakdownPage = page;
    this.loadBreakdown();
  }

  onBreakdownSortChange(sort: SortInfo | null): void {
    this.breakdownSort = sort;
    this.breakdownPage = 1;
    this.loadBreakdown();
  }

  onBreakdownFiltersChange(filters: { [key: string]: string }): void {
    this.breakdownFilters = filters;
    this.breakdownPage = 1;
    this.loadBreakdown();
  }

  closeBreakdownModal(): void {
    this.showBreakdownModal = false;
  }

  formatCurrency(value: number): string {
    return `₱${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private loadPaymentMethods(): void {
    this.subscriptions.add(
      this.adminService.getLabelPaymentMethods().subscribe({
        next: (response) => {
          this.paymentMethods = (response as any)?.paymentMethods || response || [];
        },
        error: (error) => {
          console.error('Error loading payment methods:', error);
          this.notificationService.showError('Failed to load payment methods');
        }
      })
    );
  }

  loadPayments(page: number = 1): void {
    if (!this.brandId) return;

    this.paymentsLoading = true;
    this.subscriptions.add(
      this.labelFinanceService.getPayments(this.brandId, page, 10, 'date_paid', 'desc', this.startDate, this.endDate)
        .subscribe({
          next: (response) => {
            this.paymentsResponse = response;
            this.payments = response.payments;
            this.paymentsLoading = false;
          },
          error: (error) => {
            console.error('Error loading payments:', error);
            this.notificationService.showError('Failed to load payments');
            this.paymentsLoading = false;
          }
        })
    );
  }

  onPaymentsPageChange(page: number): void {
    this.loadPayments(page);
  }

  openAddPaymentMethodModal(): void {
    this.newPaymentMethod = {
      bank_selection: '',
      account_name: '',
      account_number_or_email: '',
      is_default_for_brand: false
    };
    this.showAddPaymentMethodModal = true;
  }

  closeAddPaymentMethodModal(): void {
    this.showAddPaymentMethodModal = false;
    this.newPaymentMethod = {};
  }

  addPaymentMethod(): void {
    if (!this.newPaymentMethod.bank_selection || !this.newPaymentMethod.account_name || !this.newPaymentMethod.account_number_or_email) {
      this.notificationService.showError('Please fill in all required fields');
      return;
    }

    // Parse bank_selection to get bank_code and type
    const [bank_code, bank_name] = this.newPaymentMethod.bank_selection.split(',');
    
    const paymentMethodData = {
      ...this.newPaymentMethod,
      type: bank_name,
      bank_code: bank_code
    };

    this.isAddingPaymentMethod = true;
    this.subscriptions.add(
      this.adminService.addLabelPaymentMethod(paymentMethodData as LabelPaymentMethod).subscribe({
        next: () => {
          this.notificationService.showSuccess('Payment method added successfully');
          this.closeAddPaymentMethodModal();
          this.loadPaymentMethods();
          this.isAddingPaymentMethod = false;
        },
        error: (error) => {
          console.error('Error adding payment method:', error);
          this.notificationService.showError('Failed to add payment method');
          this.isAddingPaymentMethod = false;
        }
      })
    );
  }

  // Note: Delete functionality not available in AdminService yet
  // deletePaymentMethod(id: number): void {
  //   if (!confirm('Are you sure you want to delete this payment method?')) {
  //     return;
  //   }
  //   // Implementation would go here when delete method is available
  // }

formatPaymentMethod(payment: LabelPayment): string {
    // Prioritize PaymentMethod data over legacy paid_thru_* fields
    if (payment.paymentMethod) {
      const { type, account_name, account_number_or_email } = payment.paymentMethod;
      // Format as "type - account name (account number)"
      if (type && account_name && account_number_or_email) {
        return `${type} - ${account_name} (${account_number_or_email})`;
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
      return 'Manual Payment';
    }
    
    // Format as "type - account name (account number)" for legacy fields
    if (payment.paid_thru_type && payment.paid_thru_account_name && payment.paid_thru_account_number) {
      return `${payment.paid_thru_type} - ${payment.paid_thru_account_name} (${payment.paid_thru_account_number})`;
    }
    
    // Fallback formats for legacy fields
    if (payment.paid_thru_account_name) {
      return `${payment.paid_thru_type} - ${payment.paid_thru_account_name}`;
    }
    
    return payment.paid_thru_type;
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}