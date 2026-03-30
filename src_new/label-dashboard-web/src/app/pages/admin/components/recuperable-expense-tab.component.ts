import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, TableAction, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { ExpenseFlowDetailModalComponent } from './expense-flow-detail-modal.component';

export type RecuperableExpenseSection = 'balance' | 'flow';

@Component({
  selector: 'app-recuperable-expense-tab',
  standalone: true,
  imports: [CommonModule, DateRangeFilterComponent, PaginatedTableComponent, InPageNavComponent, ExpenseFlowDetailModalComponent],
  templateUrl: './recuperable-expense-tab.component.html',
  styleUrls: ['./recuperable-expense-tab.component.scss']
})
export class RecuperableExpenseTabComponent implements OnInit {
  activeSection: RecuperableExpenseSection = 'balance';

  navTabs: InPageNavTab[] = [
    { id: 'balance', label: 'Balance', icon: 'fas fa-scale-balanced' },
    { id: 'flow', label: 'Expense Flow', icon: 'fas fa-arrows-rotate' },
  ];

  // ── Balance section ───────────────────────────────────────────────────────
  totalRecuperableExpense: number = 0;

  balanceExpenses: any[] = [];
  balancePagination: PaginationInfo | null = null;
  balanceLoading: boolean = false;
  balanceFilters: SearchFilters = {};
  balanceSort: SortInfo | null = null;

  balanceColumns: TableColumn[] = [
    { key: 'catalog_no', label: 'Catalog No.', type: 'text', searchable: true, sortable: true, mobileGroup: 'release' },
    { key: 'title', label: 'Release', type: 'text', searchable: true, sortable: true, mobileGroup: 'release', mobileGroupMain: true },
    { key: 'artist_name', label: 'Artist', type: 'text', searchable: true, sortable: true, mobileGroup: 'release' },
    {
      key: 'remaining_expense', label: 'Remaining Expense (₱)', type: 'number',
      searchable: true, sortable: true, align: 'right',
      formatter: (item) => this.formatCurrency(item.remaining_expense),
      mobileClass: 'mobile-narrow mobile-number', tabletClass: ''
    }
  ];

  // ── Flow section ──────────────────────────────────────────────────────────
  flowLoading: boolean = false;
  flowStartDate: string = '';
  flowEndDate: string = '';
  totalNewExpense: number = 0;
  totalRecuperatedExpense: number = 0;

  flowExpenses: any[] = [];
  flowPagination: PaginationInfo | null = null;
  flowTableLoading: boolean = false;
  flowFilters: SearchFilters = {};
  flowSort: SortInfo | null = null;

  flowActions: TableAction[] = [
    {
      icon: 'fa-solid fa-eye',
      label: 'View Details',
      handler: (item: any) => this.openFlowDetailModal(item)
    }
  ];

  // Flow detail modal state
  showFlowDetailModal: boolean = false;
  selectedFlowReleaseId: number = 0;
  selectedFlowReleaseTitle: string = '';

  flowColumns: TableColumn[] = [
    { key: 'catalog_no', label: 'Catalog No.', type: 'text', searchable: true, sortable: true, mobileGroup: 'release' },
    { key: 'title', label: 'Release', type: 'text', searchable: true, sortable: true, mobileGroup: 'release', mobileGroupMain: true },
    { key: 'artist_name', label: 'Artist', type: 'text', searchable: true, sortable: true, mobileGroup: 'release' },
    {
      key: 'new_expense', label: 'New Expenses (₱)', type: 'number',
      searchable: false, sortable: true, align: 'right',
      formatter: (item) => this.formatCurrency(item.new_expense),
      mobileGroup: 'amounts',
      mobileClass: 'mobile-narrow mobile-number', tabletClass: ''
    },
    {
      key: 'recuperated_expense', label: 'Recuperated (₱)', type: 'number',
      searchable: false, sortable: true, align: 'right',
      formatter: (item) => '-' + this.formatCurrency(item.recuperated_expense),
      mobileGroup: 'amounts',
      mobileClass: 'mobile-narrow mobile-number', tabletClass: ''
    },
    {
      key: 'net_change', label: 'Net Flow (₱)', type: 'number',
      searchable: false, sortable: true, align: 'right',
      renderHtml: true,
      formatter: (item) => `<strong>${this.formatCurrency(item.net_change)}</strong>`,
      mobileGroup: 'amounts', mobileGroupMain: true,
      mobileClass: 'mobile-narrow mobile-number', tabletClass: ''
    }
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadBalance();
  }

  setActiveSection(section: RecuperableExpenseSection): void {
    this.activeSection = section;
  }

  onNavTabChange(id: string): void {
    this.setActiveSection(id as RecuperableExpenseSection);
  }

  // ── Balance methods ───────────────────────────────────────────────────────
  loadBalance(): void {
    this.balanceLoading = true;

    const page = this.balancePagination?.current_page || 1;
    const limit = this.balancePagination?.per_page || 5;
    const sortBy = this.balanceSort?.column;
    const sortDirection = this.balanceSort?.direction;

    this.adminService.getRecuperableExpenses(page, limit, this.balanceFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.balanceExpenses = response.data;
        this.balancePagination = response.pagination;
        this.totalRecuperableExpense = response.summary?.total_recuperable_expense || 0;
        this.balanceLoading = false;
      },
      error: () => {
        this.notificationService.showError('Error loading recuperable expenses');
        this.balanceLoading = false;
      }
    });
  }

  onBalancePageChange(page: number): void {
    if (this.balancePagination) this.balancePagination.current_page = page;
    this.loadBalance();
  }

  onBalanceFiltersChange(filters: SearchFilters): void {
    this.balanceFilters = filters;
    if (this.balancePagination) this.balancePagination.current_page = 1;
    this.loadBalance();
  }

  onBalanceSortChange(sort: SortInfo | null): void {
    this.balanceSort = sort;
    this.loadBalance();
  }

  // ── Flow methods ──────────────────────────────────────────────────────────
  private loadFlow(): void {
    if (!this.flowStartDate || !this.flowEndDate) return;

    this.flowTableLoading = true;

    const page = this.flowPagination?.current_page || 1;
    const limit = this.flowPagination?.per_page || 10;
    const sortBy = this.flowSort?.column;
    const sortDirection = this.flowSort?.direction;

    this.adminService.getAdminRecuperableExpenseFlow(this.flowStartDate, this.flowEndDate, page, limit, this.flowFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.flowExpenses = response.data;
        this.flowPagination = response.pagination;
        this.totalNewExpense = response.total_new_expense;
        this.totalRecuperatedExpense = response.total_recuperated_expense;
        this.flowLoading = false;
        this.flowTableLoading = false;
      },
      error: () => {
        this.notificationService.showError('Error loading recuperable expense flow');
        this.flowLoading = false;
        this.flowTableLoading = false;
      }
    });
  }

  onFlowDateRangeChange(dateRange: DateRangeSelection): void {
    this.flowStartDate = dateRange.startDate;
    this.flowEndDate = dateRange.endDate;
    this.flowLoading = true;
    if (this.flowPagination) this.flowPagination.current_page = 1;
    this.loadFlow();
  }

  onFlowPageChange(page: number): void {
    if (this.flowPagination) this.flowPagination.current_page = page;
    this.loadFlow();
  }

  onFlowFiltersChange(filters: SearchFilters): void {
    this.flowFilters = filters;
    if (this.flowPagination) this.flowPagination.current_page = 1;
    this.loadFlow();
  }

  onFlowSortChange(sort: SortInfo | null): void {
    this.flowSort = sort;
    this.loadFlow();
  }

  // ── Flow detail modal ────────────────────────────────────────────────────
  openFlowDetailModal(item: any): void {
    this.selectedFlowReleaseId = item.release_id;
    this.selectedFlowReleaseTitle = item.title;
    this.showFlowDetailModal = true;
  }

  closeFlowDetailModal(): void {
    this.showFlowDetailModal = false;
  }

  // ── Shared ────────────────────────────────────────────────────────────────
  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
