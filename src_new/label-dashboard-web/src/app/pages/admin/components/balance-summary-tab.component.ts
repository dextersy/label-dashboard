import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, ArtistBalance } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { PaymentConfirmationDialogComponent, PaymentArtist } from './payment-confirmation-dialog.component';

@Component({
  selector: 'app-balance-summary-tab',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent, PaymentConfirmationDialogComponent],
  templateUrl: './balance-summary-tab.component.html'
})
export class BalanceSummaryTabComponent implements OnInit {
  // Artist balances data
  artistBalances: ArtistBalance[] = [];
  balancePagination: PaginationInfo | null = null;
  balanceLoading: boolean = false;
  balanceFilters: SearchFilters = {};
  balanceSort: SortInfo | null = null;
  balanceSummary: any = {};
  
  // Recuperable expenses data
  recuperableExpenses: any[] = [];
  expensesPagination: PaginationInfo | null = null;
  expensesLoading: boolean = false;
  expensesFilters: SearchFilters = {};
  expensesSort: SortInfo | null = null;
  expensesSummary: any = {};
  
  walletBalance: number = 0;

  // Payment confirmation dialog
  showPaymentDialog: boolean = false;
  paymentArtists: PaymentArtist[] = [];
  isProcessingPayment: boolean = false;

  // Balance table columns
  balanceColumns: TableColumn[] = [
    { key: 'name', label: 'Artist', type: 'text', searchable: true, sortable: true },
    { key: 'total_royalties', label: 'Total royalties (₱)', type: 'number', searchable: true, sortable: true },
    { key: 'total_payments', label: 'Total payments (₱)', type: 'number', searchable: true, sortable: true },
    { key: 'total_balance', label: 'Total balance (₱)', type: 'number', searchable: true, sortable: true },
    { key: 'payout_point', label: 'Payout point (₱)', type: 'number', searchable: true, sortable: true },
    { 
      key: 'due_for_payment', 
      label: 'Due for payment', 
      type: 'select', 
      searchable: true, 
      sortable: false, 
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ]
    },
    { 
      key: 'hold_payouts', 
      label: 'Payouts paused', 
      type: 'select', 
      searchable: true, 
      sortable: false,
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ]
    }
  ];

  // Expenses table columns
  expensesColumns: TableColumn[] = [
    { 
      key: 'catalog_no', 
      label: 'Catalog No.', 
      type: 'text', 
      searchable: true, 
      sortable: true,
      mobileClass: 'mobile-hide',
      tabletClass: ''
    },
    { 
      key: 'title', 
      label: 'Release', 
      type: 'text', 
      searchable: true, 
      sortable: true,
      mobileClass: 'mobile-text',
      tabletClass: ''
    },
    { 
      key: 'remaining_expense', 
      label: 'Remaining Expense (₱)', 
      type: 'number', 
      searchable: true, 
      sortable: true, 
      align: 'right', 
      formatter: (item) => this.formatCurrency(item.remaining_expense),
      mobileClass: 'mobile-narrow mobile-number',
      tabletClass: ''
    }
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadBalanceData();
    this.loadRecuperableExpenses();
    this.loadWalletBalance();
  }

  private loadBalanceData(): void {
    this.balanceLoading = true;
    
    const page = this.balancePagination?.current_page || 1;
    const limit = this.balancePagination?.per_page || 10;
    const sortBy = this.balanceSort?.column;
    const sortDirection = this.balanceSort?.direction;
    
    this.adminService.getArtistBalances(page, limit, this.balanceFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.artistBalances = response.data;
        this.balancePagination = response.pagination;
        this.balanceSummary = response.summary;
        this.balanceLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading artist balances');
        this.balanceLoading = false;
      }
    });
  }

  private loadRecuperableExpenses(): void {
    this.expensesLoading = true;
    
    const page = this.expensesPagination?.current_page || 1;
    const limit = this.expensesPagination?.per_page || 10;
    const sortBy = this.expensesSort?.column;
    const sortDirection = this.expensesSort?.direction;
    
    this.adminService.getRecuperableExpenses(page, limit, this.expensesFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.recuperableExpenses = response.data;
        this.expensesPagination = response.pagination;
        this.expensesSummary = response.summary;
        this.expensesLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading recuperable expenses');
        this.expensesLoading = false;
      }
    });
  }

  private loadWalletBalance(): void {
    this.adminService.getWalletBalance().subscribe({
      next: (balance) => {
        this.walletBalance = balance;
      },
      error: (error) => {
        this.notificationService.showError('Error loading wallet balance');
      }
    });
  }

  // Balance table event handlers
  onBalancePageChange(page: number): void {
    if (this.balancePagination) {
      this.balancePagination.current_page = page;
    }
    this.loadBalanceData();
  }

  onBalanceFiltersChange(filters: SearchFilters): void {
    this.balanceFilters = filters;
    if (this.balancePagination) {
      this.balancePagination.current_page = 1;
    }
    this.loadBalanceData();
  }


  onBalanceSortToggle(column: string): void {
    if (this.balanceSort?.column === column) {
      // Toggle direction
      this.balanceSort.direction = this.balanceSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new column with ascending direction
      this.balanceSort = { column, direction: 'asc' };
    }
    this.loadBalanceData();
  }

  // Expenses table event handlers
  onExpensesPageChange(page: number): void {
    if (this.expensesPagination) {
      this.expensesPagination.current_page = page;
    }
    this.loadRecuperableExpenses();
  }

  onExpensesFiltersChange(filters: SearchFilters): void {
    this.expensesFilters = filters;
    if (this.expensesPagination) {
      this.expensesPagination.current_page = 1;
    }
    this.loadRecuperableExpenses();
  }

  onExpensesSortChange(sort: SortInfo | null): void {
    this.expensesSort = sort;
    this.loadRecuperableExpenses();
  }

  // Payment methods
  payAllBalances(): void {
    // First get the detailed list of artists ready for payment
    this.adminService.getArtistsReadyForPayment().subscribe({
      next: (response) => {
        if (response.artists && response.artists.length > 0) {
          this.paymentArtists = response.artists;
          this.showPaymentDialog = true;
        } else {
          this.notificationService.showInfo('No artists are ready for payment at this time');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error loading payment details');
      }
    });
  }

  onConfirmPayment(): void {
    this.isProcessingPayment = true;
    
    this.adminService.payAllBalances().subscribe({
      next: (response) => {
        this.isProcessingPayment = false;
        this.showPaymentDialog = false;
        this.loadBalanceData();
        this.loadWalletBalance();
        this.notificationService.showSuccess(response.message || 'All balances paid successfully');
      },
      error: (error) => {
        this.isProcessingPayment = false;
        this.notificationService.showError('Error paying balances');
      }
    });
  }

  onCancelPayment(): void {
    this.showPaymentDialog = false;
    this.paymentArtists = [];
    this.isProcessingPayment = false;
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

}