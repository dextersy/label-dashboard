import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SortInfo, HeaderAction } from '../../../components/shared/paginated-table/paginated-table.component';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';

@Component({
  selector: 'app-merch-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BreadcrumbComponent, InPageNavComponent, PaginatedTableComponent, DateRangeFilterComponent],
  templateUrl: './merch-sales.component.html',
})
export class MerchSalesComponent implements OnInit {
  loading = true;
  isAdmin = false;

  activeSubTab: 'earnings' | 'expenses' = 'earnings';
  subTabs: InPageNavTab[] = [
    { id: 'earnings', label: 'Earnings', icon: 'coins' },
    { id: 'expenses', label: 'Recuperable Expenses', icon: 'receipt' },
  ];

  private readonly PAGE_SIZE = 10;

  // Earnings
  earnings: any[] = [];
  filteredEarnings: any[] = [];
  earningsPagination: PaginationInfo | null = null;
  earningsSort: SortInfo = { column: 'date_recorded', direction: 'desc' };
  earningsPage = 1;
  totalEarnings = 0;
  showEarningForm = false;
  submittingEarning = false;
  earningForm = {
    amount: 0,
    description: '',
    date_recorded: new Date().toISOString().split('T')[0],
    calculate_royalties: true,
  };
  selectedProductId: number | null = null;
  products: any[] = [];

  // Expenses
  expenses: any[] = [];
  filteredExpenses: any[] = [];
  expensesPagination: PaginationInfo | null = null;
  expensesSort: SortInfo = { column: 'date_recorded', direction: 'desc' };
  expensesPage = 1;
  totalExpenses = 0;
  showExpenseForm = false;
  submittingExpense = false;
  expenseForm = {
    expense_description: '',
    expense_amount: '',
    date_recorded: new Date().toISOString().split('T')[0],
  };
  selectedExpenseProductId: number | null = null;

  // Date range filter state
  private currentDateRange: DateRangeSelection | null = null;
  // Text search filters from table
  private earningsSearchFilters: { [key: string]: string } = {};
  private expensesSearchFilters: { [key: string]: string } = {};

  earningsColumns: TableColumn[] = [];
  expensesColumns: TableColumn[] = [];
  earningsHeaderActions: HeaderAction[] = [];
  expensesHeaderActions: HeaderAction[] = [];

  constructor(
    private productService: ProductService,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.buildColumns();
    this.buildHeaderActions();
    this.loadData();
    if (this.isAdmin) this.loadProducts();
  }

  private buildHeaderActions(): void {
    if (!this.isAdmin) return;
    this.earningsHeaderActions = [{
      icon: () => this.showEarningForm ? 'x' : 'plus',
      label: () => this.showEarningForm ? 'Cancel' : 'Add Earning',
      handler: () => this.toggleEarningForm(),
      type: 'primary',
    }];
    this.expensesHeaderActions = [{
      icon: () => this.showExpenseForm ? 'x' : 'plus',
      label: () => this.showExpenseForm ? 'Cancel' : 'Add Expense',
      handler: () => this.toggleExpenseForm(),
      type: 'primary',
    }];
  }

  readonly productPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#e5e7eb" rx="3"/><text x="14" y="20" font-size="14" text-anchor="middle" fill="#9ca3af">♦</text></svg>')}`;

  private buildColumns(): void {
    const productCol: TableColumn = {
      key: 'product',
      label: 'Product',
      mobileGroup: 'summary',
      mobileClass: 'mobile-text',
      renderHtml: true,
      formatter: (item: any) => this.renderProductCell(item.product),
    };
    const descriptionCol: TableColumn = {
      key: 'description',
      label: 'Description',
      searchable: true,
      sortable: true,
      mobileGroup: 'summary',
      mobileGroupMain: true,
      mobileClass: '',
    };
    const expDescCol: TableColumn = {
      key: 'expense_description',
      label: 'Description',
      searchable: true,
      sortable: true,
      mobileGroup: 'summary',
      mobileGroupMain: true,
      mobileClass: '',
    };
    const dateCol: TableColumn = {
      key: 'date_recorded',
      label: 'Date',
      type: 'date',
      sortable: true,
      mobileGroup: 'summary',
      mobileClass: 'mobile-narrow',
    };

    this.earningsColumns = [
      dateCol,
      productCol,
      descriptionCol,
      { key: 'amount', label: 'Amount', type: 'number', sortable: true, align: 'right', mobileClass: 'mobile-narrow mobile-number' },
    ];

    this.expensesColumns = [
      dateCol,
      productCol,
      expDescCol,
      { key: 'expense_amount', label: 'Amount', type: 'number', sortable: true, align: 'right', mobileClass: 'mobile-narrow mobile-number' },
    ];
  }

  private renderProductCell(product: any): SafeHtml {
    if (!product) return this.sanitizer.bypassSecurityTrustHtml('<span style="color:#9ca3af">—</span>');
    const name = product.sku ? `${product.sku}: ${product.name}` : product.name;
    const src = product.images?.[0]?.path || this.productPlaceholder;
    return this.sanitizer.bypassSecurityTrustHtml(
      `<span style="display:inline-flex;align-items:center;gap:8px"><img src="${src}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0">${name}</span>`
    );
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      earningsResult: this.productService.getMerchEarnings(),
      expensesResult: this.productService.getMerchExpenses(),
    }).subscribe({
      next: ({ earningsResult, expensesResult }) => {
        this.earnings = earningsResult.earnings;
        this.totalEarnings = earningsResult.total_earnings;
        this.expenses = expensesResult.expenses;
        this.totalExpenses = expensesResult.total_expenses;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notificationService.showError('Failed to load sales data');
      },
    });
  }

  loadProducts(): void {
    this.productService.getProducts({ limit: 100 }).subscribe({
      next: (result) => { this.products = result.products; },
    });
  }

  onSubTabChange(tabId: string): void {
    this.activeSubTab = tabId as 'earnings' | 'expenses';
  }

  onDateRangeChange(range: DateRangeSelection): void {
    this.currentDateRange = range;
    this.earningsPage = 1;
    this.expensesPage = 1;
    this.applyFilters();
  }

  onEarningsFiltersChange(filters: { [key: string]: string }): void {
    this.earningsSearchFilters = filters;
    this.earningsPage = 1;
    this.applyFilters();
  }

  onExpensesFiltersChange(filters: { [key: string]: string }): void {
    this.expensesSearchFilters = filters;
    this.expensesPage = 1;
    this.applyFilters();
  }

  private applyFilters(): void {
    const { startDate, endDate } = this.getDateBounds();

    const allEarnings = this.earnings
      .filter(e => this.matchesDateRange(e.date_recorded, startDate, endDate)
                && this.matchesTextFilters(e, this.earningsSearchFilters, ['description']));
    this.sortItems(allEarnings, this.earningsSort);
    this.earningsPagination = this.buildPagination(allEarnings.length, this.earningsPage);
    this.filteredEarnings = allEarnings.slice(
      (this.earningsPage - 1) * this.PAGE_SIZE,
      this.earningsPage * this.PAGE_SIZE
    );

    const allExpenses = this.expenses
      .filter(e => this.matchesDateRange(e.date_recorded, startDate, endDate)
                && this.matchesTextFilters(e, this.expensesSearchFilters, ['expense_description']));
    this.sortItems(allExpenses, this.expensesSort);
    this.expensesPagination = this.buildPagination(allExpenses.length, this.expensesPage);
    this.filteredExpenses = allExpenses.slice(
      (this.expensesPage - 1) * this.PAGE_SIZE,
      this.expensesPage * this.PAGE_SIZE
    );
  }

  private sortItems(items: any[], sort: SortInfo): void {
    items.sort((a, b) => {
      const aVal = a[sort.column] ?? '';
      const bVal = b[sort.column] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }

  private buildPagination(total: number, page: number): PaginationInfo {
    const totalPages = Math.max(1, Math.ceil(total / this.PAGE_SIZE));
    return {
      current_page: page,
      total_pages: totalPages,
      total_count: total,
      per_page: this.PAGE_SIZE,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }

  onEarningsPageChange(page: number): void {
    this.earningsPage = page;
    this.applyFilters();
  }

  onExpensesPageChange(page: number): void {
    this.expensesPage = page;
    this.applyFilters();
  }

  onEarningsSortChange(sort: SortInfo | null): void {
    this.earningsSort = sort ?? { column: 'date_recorded', direction: 'desc' };
    this.earningsPage = 1;
    this.applyFilters();
  }

  onExpensesSortChange(sort: SortInfo | null): void {
    this.expensesSort = sort ?? { column: 'date_recorded', direction: 'desc' };
    this.expensesPage = 1;
    this.applyFilters();
  }

  private getDateBounds(): { startDate: string | null; endDate: string | null } {
    if (!this.currentDateRange || this.currentDateRange.preset === 'alltime') {
      return { startDate: null, endDate: null };
    }
    return { startDate: this.currentDateRange.startDate, endDate: this.currentDateRange.endDate };
  }

  private matchesDateRange(dateStr: string, startDate: string | null, endDate: string | null): boolean {
    if (!startDate || !endDate) return true;
    const d = dateStr.substring(0, 10);
    return d >= startDate && d <= endDate;
  }

  private matchesTextFilters(item: any, filters: { [key: string]: string }, searchableKeys: string[]): boolean {
    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      const q = val.toLowerCase();
      if (key === '_search') {
        const matches = searchableKeys.some(k => (item[k] || '').toLowerCase().includes(q));
        // Also match product name
        const productMatch = (item.product?.name || '').toLowerCase().includes(q) || (item.product?.sku || '').toLowerCase().includes(q);
        if (!matches && !productMatch) return false;
      } else if ((item[key] || '').toString().toLowerCase().includes(q) === false) {
        return false;
      }
    }
    return true;
  }

  get filteredTotalEarnings(): number {
    return this.filteredEarnings.reduce((sum, e) => sum + parseFloat((e.amount || 0).toString()), 0);
  }

  get filteredTotalExpenses(): number {
    return this.filteredExpenses.reduce((sum, e) => sum + parseFloat((e.expense_amount || 0).toString()), 0);
  }

  // ── Earnings ──────────────────────────────────────────

  toggleEarningForm(): void {
    this.showEarningForm = !this.showEarningForm;
    if (!this.showEarningForm) this.resetEarningForm();
  }

  async onSubmitEarning(): Promise<void> {
    if (!this.selectedProductId || this.submittingEarning) return;
    this.submittingEarning = true;
    try {
      await this.financialService.createProductEarning(this.selectedProductId, this.earningForm);
      this.notificationService.showSuccess('Earning added successfully');
      this.resetEarningForm();
      this.showEarningForm = false;
      this.productService.getMerchEarnings().subscribe(r => {
        this.earnings = r.earnings;
        this.totalEarnings = r.total_earnings;
        this.applyFilters();
      });
    } catch {
      this.notificationService.showError('Failed to add earning');
    } finally {
      this.submittingEarning = false;
    }
  }

  private resetEarningForm(): void {
    this.selectedProductId = null;
    this.earningForm = { amount: 0, description: '', date_recorded: new Date().toISOString().split('T')[0], calculate_royalties: true };
  }

  get isEarningFormValid(): boolean {
    return !!this.selectedProductId && this.earningForm.amount > 0 && !!this.earningForm.description;
  }

  // ── Expenses ──────────────────────────────────────────

  toggleExpenseForm(): void {
    this.showExpenseForm = !this.showExpenseForm;
    if (!this.showExpenseForm) this.resetExpenseForm();
  }

  async onSubmitExpense(): Promise<void> {
    if (!this.selectedExpenseProductId || this.submittingExpense) return;
    this.submittingExpense = true;
    try {
      await this.financialService.addProductExpense(this.selectedExpenseProductId, this.expenseForm);
      this.notificationService.showSuccess('Expense added successfully');
      this.resetExpenseForm();
      this.showExpenseForm = false;
      this.productService.getMerchExpenses().subscribe(r => {
        this.expenses = r.expenses;
        this.totalExpenses = r.total_expenses;
        this.applyFilters();
      });
    } catch {
      this.notificationService.showError('Failed to add expense');
    } finally {
      this.submittingExpense = false;
    }
  }

  private resetExpenseForm(): void {
    this.selectedExpenseProductId = null;
    this.expenseForm = { expense_description: '', expense_amount: '', date_recorded: new Date().toISOString().split('T')[0] };
  }

  get isExpenseFormValid(): boolean {
    return !!this.selectedExpenseProductId && !!this.expenseForm.expense_description && !!this.expenseForm.expense_amount;
  }

  // ── Shared ────────────────────────────────────────────

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  productLabel(p: any): string {
    return p.sku ? `${p.sku} : ${p.name}` : p.name;
  }
}
