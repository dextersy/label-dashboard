import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';

@Component({
  selector: 'app-product-sales-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, InPageNavComponent],
  templateUrl: './product-sales-tab.component.html',
})
export class ProductSalesTabComponent implements OnInit {
  productId: number | null = null;
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

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.productId = parseInt(id as string, 10);
      this.loadData();
    }
  }

  loadData(): void {
    if (!this.productId) return;
    this.loading = true;
    forkJoin({
      earningsResult: this.productService.getProductEarnings(this.productId),
      expensesResult: this.productService.getProductExpenses(this.productId),
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

  onSubTabChange(tabId: string): void {
    this.activeSubTab = tabId as 'earnings' | 'expenses';
  }

  // ── Earnings ──────────────────────────────────────────

  toggleEarningForm(): void {
    this.showEarningForm = !this.showEarningForm;
    if (!this.showEarningForm) this.resetEarningForm();
  }

  async onSubmitEarning(): Promise<void> {
    if (!this.productId || this.submittingEarning) return;
    this.submittingEarning = true;
    try {
      await this.financialService.createProductEarning(this.productId, this.earningForm);
      this.notificationService.showSuccess('Earning added successfully');
      this.resetEarningForm();
      this.showEarningForm = false;
      this.reloadEarnings();
    } catch {
      this.notificationService.showError('Failed to add earning');
    } finally {
      this.submittingEarning = false;
    }
  }

  private resetEarningForm(): void {
    this.earningForm = {
      amount: 0,
      description: '',
      date_recorded: new Date().toISOString().split('T')[0],
      calculate_royalties: true,
    };
  }

  private reloadEarnings(): void {
    if (!this.productId) return;
    this.productService.getProductEarnings(this.productId).subscribe({
      next: (result) => {
        this.earnings = result.earnings;
        this.totalEarnings = result.total_earnings;
      },
    });
  }

  get isEarningFormValid(): boolean {
    return this.earningForm.amount > 0 && !!this.earningForm.description;
  }

  // ── Expenses ──────────────────────────────────────────

  toggleExpenseForm(): void {
    this.showExpenseForm = !this.showExpenseForm;
    if (!this.showExpenseForm) this.resetExpenseForm();
  }

  async onSubmitExpense(): Promise<void> {
    if (!this.productId || this.submittingExpense) return;
    this.submittingExpense = true;
    try {
      await this.financialService.addProductExpense(this.productId, this.expenseForm);
      this.notificationService.showSuccess('Expense added successfully');
      this.resetExpenseForm();
      this.showExpenseForm = false;
      this.reloadExpenses();
    } catch {
      this.notificationService.showError('Failed to add expense');
    } finally {
      this.submittingExpense = false;
    }
  }

  private resetExpenseForm(): void {
    this.expenseForm = {
      expense_description: '',
      expense_amount: '',
      date_recorded: new Date().toISOString().split('T')[0],
    };
  }

  private reloadExpenses(): void {
    if (!this.productId) return;
    this.productService.getProductExpenses(this.productId).subscribe({
      next: (result) => {
        this.expenses = result.expenses;
        this.totalExpenses = result.total_expenses;
      },
    });
  }

  get isExpenseFormValid(): boolean {
    return !!this.expenseForm.expense_description && !!this.expenseForm.expense_amount;
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
}
