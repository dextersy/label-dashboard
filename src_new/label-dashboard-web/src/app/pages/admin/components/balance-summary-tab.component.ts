import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, ArtistBalance, ChildBrand } from '../../../services/admin.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { PaymentConfirmationDialogComponent, PaymentArtist } from './payment-confirmation-dialog.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-balance-summary-tab',
    imports: [CommonModule, FormsModule, PaginatedTableComponent, PaymentConfirmationDialogComponent, InPageNavComponent, IconComponent],
    templateUrl: './balance-summary-tab.component.html'
})
export class BalanceSummaryTabComponent implements OnInit {
  activeSection: 'my-label' | 'sublabels' = 'my-label';

  get navTabs(): InPageNavTab[] {
    const tabs: InPageNavTab[] = [
      { id: 'my-label', label: 'My Label', icon: 'music' },
    ];
    if (this.childBrands.length > 0) {
      tabs.push({ id: 'sublabels', label: 'Sublabels', icon: 'users' });
    }
    return tabs;
  }

  onNavTabChange(tabId: string): void {
    this.activeSection = tabId as 'my-label' | 'sublabels';
  }

  // Artist balances data (own brand)
  artistBalances: ArtistBalance[] = [];
  balancePagination: PaginationInfo | null = null;
  balanceLoading: boolean = false;
  balanceFilters: SearchFilters = {};
  balanceSort: SortInfo | null = null;
  balanceSummary: any = {};

  walletBalance: number = 0;
  hasWallet: boolean = false;

  // Payment confirmation dialog
  showPaymentDialog: boolean = false;
  paymentArtists: PaymentArtist[] = [];
  isProcessingPayment: boolean = false;
  activePaymentChildBrandId: number | null = null;

  // Sublabel artist balances (parent view)
  childBrands: ChildBrand[] = [];
  selectedChildBrandId: number | null = null;
  sublabelBalances: ArtistBalance[] = [];
  sublabelPagination: PaginationInfo | null = null;
  sublabelLoading: boolean = false;
  sublabelFilters: SearchFilters = {};
  sublabelSort: SortInfo | null = null;
  sublabelSummary: any = {};

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

  // Sublabel balance table columns (parent-payable view, no payout point/due/paused)
  sublabelBalanceColumns: TableColumn[] = [
    { key: 'name', label: 'Artist', type: 'text', searchable: true, sortable: true },
    { key: 'total_royalties', label: 'Parent-payable royalties (₱)', type: 'number', searchable: false, sortable: true },
    { key: 'total_payments', label: 'Payments made (₱)', type: 'number', searchable: false, sortable: true },
    { key: 'total_balance', label: 'Remaining balance (₱)', type: 'number', searchable: false, sortable: true },
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadBalanceData();
    this.loadWalletBalance();
    this.loadChildBrands();
  }

  private loadChildBrands(): void {
    this.adminService.getSublabels().subscribe({
      next: (brands) => {
        this.childBrands = brands;
      },
      error: () => {
        // Not a parent brand or no child brands — ignore silently
      }
    });
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

  private loadSublabelBalanceData(): void {
    if (!this.selectedChildBrandId) return;
    this.sublabelLoading = true;

    const page = this.sublabelPagination?.current_page || 1;
    const limit = this.sublabelPagination?.per_page || 10;
    const sortBy = this.sublabelSort?.column;
    const sortDirection = this.sublabelSort?.direction;

    this.adminService.getArtistBalances(page, limit, this.sublabelFilters, sortBy, sortDirection, this.selectedChildBrandId).subscribe({
      next: (response) => {
        this.sublabelBalances = response.data;
        this.sublabelPagination = response.pagination;
        this.sublabelSummary = response.summary;
        this.sublabelLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading sublabel artist balances');
        this.sublabelLoading = false;
      }
    });
  }

  private loadWalletBalance(): void {
    this.adminService.getWalletBalance().subscribe({
      next: (balance) => {
        this.walletBalance = balance;
        this.hasWallet = true;
      },
      error: (error) => {
        // Not all brands have a Paymongo wallet — silently default to 0
        this.hasWallet = false;
        this.walletBalance = 0;
        console.error('Error loading wallet balance:', error);
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
      this.balanceSort.direction = this.balanceSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.balanceSort = { column, direction: 'asc' };
    }
    this.loadBalanceData();
  }

  // Sublabel balance table event handlers
  onChildBrandChange(): void {
    this.sublabelBalances = [];
    this.sublabelPagination = null;
    this.sublabelFilters = {};
    this.sublabelSort = null;
    this.sublabelSummary = {};
    if (this.selectedChildBrandId) {
      this.loadSublabelBalanceData();
    }
  }

  onSublabelPageChange(page: number): void {
    if (this.sublabelPagination) {
      this.sublabelPagination.current_page = page;
    }
    this.loadSublabelBalanceData();
  }

  onSublabelFiltersChange(filters: SearchFilters): void {
    this.sublabelFilters = filters;
    if (this.sublabelPagination) {
      this.sublabelPagination.current_page = 1;
    }
    this.loadSublabelBalanceData();
  }

  onSublabelSortToggle(column: string): void {
    if (this.sublabelSort?.column === column) {
      this.sublabelSort.direction = this.sublabelSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sublabelSort = { column, direction: 'asc' };
    }
    this.loadSublabelBalanceData();
  }

  // Payment methods
  payAllBalances(): void {
    this.activePaymentChildBrandId = null;
    this.adminService.getArtistsReadyForPayment().subscribe({
      next: (response) => {
        if (response.artists && response.artists.length > 0) {
          this.paymentArtists = response.artists;
          this.showPaymentDialog = true;
        } else {
          this.notificationService.showInfo('No artists are ready for payment at this time');
        }
      },
      error: () => {
        this.notificationService.showError('Error loading payment details');
      }
    });
  }

  payAllSublabelBalances(): void {
    if (!this.selectedChildBrandId) return;
    this.activePaymentChildBrandId = this.selectedChildBrandId;
    this.adminService.getArtistsReadyForPayment(this.selectedChildBrandId).subscribe({
      next: (response) => {
        if (response.artists && response.artists.length > 0) {
          this.paymentArtists = response.artists;
          this.showPaymentDialog = true;
        } else {
          this.notificationService.showInfo('No artists are ready for payment at this time');
        }
      },
      error: () => {
        this.notificationService.showError('Error loading payment details');
      }
    });
  }

  onConfirmPayment(): void {
    this.isProcessingPayment = true;

    this.adminService.payAllBalances(this.activePaymentChildBrandId ?? undefined).subscribe({
      next: (response) => {
        this.isProcessingPayment = false;
        this.showPaymentDialog = false;
        if (this.activePaymentChildBrandId) {
          this.loadSublabelBalanceData();
        } else {
          this.loadBalanceData();
        }
        this.loadWalletBalance();
        this.notificationService.showSuccess(response.message || 'All balances paid successfully');
      },
      error: () => {
        this.isProcessingPayment = false;
        this.notificationService.showError('Error paying balances');
      }
    });
  }

  onCancelPayment(): void {
    this.showPaymentDialog = false;
    this.paymentArtists = [];
    this.isProcessingPayment = false;
    this.activePaymentChildBrandId = null;
  }

  getInitials(name: string): string {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  getProfilePhotoUrl(profilePhoto: string | undefined): string | null {
    if (!profilePhoto || !profilePhoto.startsWith('http')) return null;
    return profilePhoto;
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

}
