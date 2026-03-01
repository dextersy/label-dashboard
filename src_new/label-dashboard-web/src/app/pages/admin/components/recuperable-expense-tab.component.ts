import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-recuperable-expense-tab',
  standalone: true,
  imports: [CommonModule, DateRangeFilterComponent, PaginatedTableComponent],
  templateUrl: './recuperable-expense-tab.component.html',
  styleUrls: ['./recuperable-expense-tab.component.scss']
})
export class RecuperableExpenseTabComponent implements OnInit {
  loading: boolean = false;
  startDate: string = '';
  endDate: string = '';

  // Date-filtered stats
  expenseSummary: { total_new_recuperable_expense: number; total_recuperated_expense: number } | null = null;

  // All-time total from table
  totalRecuperableExpense: number = 0;

  // Paginated table
  recuperableExpenses: any[] = [];
  expensesPagination: PaginationInfo | null = null;
  expensesLoading: boolean = false;
  expensesFilters: SearchFilters = {};
  expensesSort: SortInfo | null = null;

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
      key: 'artist_name',
      label: 'Artist',
      type: 'text',
      searchable: true,
      sortable: true,
      mobileClass: 'mobile-hide',
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
    this.loadRecuperableExpenses();
  }

  loadExpenseSummary(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.adminService.getAdminRecuperableExpenseSummary(this.startDate, this.endDate).subscribe({
      next: (summary) => {
        this.expenseSummary = summary;
      },
      error: (error) => {
        this.notificationService.showError('Error loading expense summary');
      }
    });
  }

  loadRecuperableExpenses(): void {
    this.expensesLoading = true;

    const page = this.expensesPagination?.current_page || 1;
    const limit = this.expensesPagination?.per_page || 10;
    const sortBy = this.expensesSort?.column;
    const sortDirection = this.expensesSort?.direction;

    this.adminService.getRecuperableExpenses(page, limit, this.expensesFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.recuperableExpenses = response.data;
        this.expensesPagination = response.pagination;
        this.totalRecuperableExpense = response.summary?.total_recuperable_expense || 0;
        this.expensesLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading recuperable expenses');
        this.expensesLoading = false;
      }
    });
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
    this.loadExpenseSummary();
  }

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

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
