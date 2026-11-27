import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';

@Component({
  selector: 'app-merch-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, BreadcrumbComponent, InPageNavComponent],
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

  // Earnings
  earnings: any[] = [];
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
  productSearchQuery = '';

  // Expenses
  expenses: any[] = [];
  totalExpenses = 0;
  showExpenseForm = false;
  submittingExpense = false;
  expenseForm = {
    expense_description: '',
    expense_amount: '',
    date_recorded: new Date().toISOString().split('T')[0],
  };
  selectedExpenseProductId: number | null = null;

  constructor(
    private productService: ProductService,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadData();
    if (this.isAdmin) this.loadProducts();
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

  getAmountClass(amount: number): string {
    return amount < 0 ? 'tw-text-danger' : '';
  }

  productLabel(p: any): string {
    return p.sku ? `${p.sku} : ${p.name}` : p.name;
  }
}
