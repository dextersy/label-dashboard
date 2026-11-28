import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-product-expenses-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './product-expenses-tab.component.html',
})
export class ProductExpensesTabComponent implements OnInit {
  productId: number | null = null;
  expenses: any[] = [];
  totalExpenses = 0;
  loading = true;
  isAdmin = false;

  showAddForm = false;
  submitting = false;
  form = {
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
      this.loadExpenses();
    }
  }

  loadExpenses(): void {
    if (!this.productId) return;
    this.loading = true;
    this.productService.getProductExpenses(this.productId).subscribe({
      next: (result) => {
        this.expenses = result.expenses;
        this.totalExpenses = result.total_expenses;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notificationService.showError('Failed to load expenses');
      },
    });
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) this.resetForm();
  }

  async onSubmit(): Promise<void> {
    if (!this.productId || this.submitting) return;
    this.submitting = true;
    try {
      await this.financialService.addProductExpense(this.productId, this.form);
      this.notificationService.showSuccess('Expense added successfully');
      this.resetForm();
      this.showAddForm = false;
      this.loadExpenses();
    } catch {
      this.notificationService.showError('Failed to add expense');
    } finally {
      this.submitting = false;
    }
  }

  private resetForm(): void {
    this.form = {
      expense_description: '',
      expense_amount: '',
      date_recorded: new Date().toISOString().split('T')[0],
    };
  }

  get isFormValid(): boolean {
    return !!this.form.expense_description && !!this.form.expense_amount;
  }

  formatCurrency(amount: number | string): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(parseFloat(amount as string));
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  getAmountClass(amount: number | string): string {
    return parseFloat(amount as string) < 0 ? 'tw-text-danger' : '';
  }
}
