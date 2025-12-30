import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReleaseInfo } from '../../../pages/financial/financial.component';
import { ReleaseExpensesDialogComponent } from '../release-expenses-dialog/release-expenses-dialog.component';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';

@Component({
    selector: 'app-financial-release-tab',
    imports: [CommonModule, FormsModule, ReleaseExpensesDialogComponent, AddExpenseDialogComponent],
    templateUrl: './financial-release-tab.component.html',
    styleUrl: './financial-release-tab.component.scss'
})
export class FinancialReleaseTabComponent {
  @Input() releases: ReleaseInfo[] = [];
  @Input() isAdmin: boolean = false;
  @Input() editingRoyalties: boolean = false;
  @Input() updatingRoyalties: boolean = false;
  @Input() toggleEditRoyalties: () => void = () => {};
  @Input() onUpdateRoyalties: () => Promise<void> = async () => {};
  @Input() onAddExpense: (expenseData: any) => Promise<void> = async () => {};

  expensesDialogVisible = false;
  selectedReleaseId = 0;
  selectedReleaseTitle = '';
  addExpenseDialogVisible = false;
  addExpenseReleaseId = 0;
  addExpenseReleaseTitle = '';
  isSubmittingExpense = false;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  formatPercentage(value: number): number {
    return Math.round(value * 100);
  }

  onPercentageChange(release: ReleaseInfo, field: string, event: any): void {
    const value = parseFloat(event.target.value) / 100;
    (release as any)[field] = value;
  }

  async updateRoyalties(): Promise<void> {
    await this.onUpdateRoyalties();
  }

  openExpensesDialog(releaseId: number, releaseTitle: string): void {
    this.selectedReleaseId = releaseId;
    this.selectedReleaseTitle = releaseTitle;
    this.expensesDialogVisible = true;
  }

  closeExpensesDialog(): void {
    this.expensesDialogVisible = false;
    this.selectedReleaseId = 0;
    this.selectedReleaseTitle = '';
  }

  openAddExpenseDialog(releaseId: number, releaseTitle: string): void {
    this.addExpenseReleaseId = releaseId;
    this.addExpenseReleaseTitle = releaseTitle;
    this.addExpenseDialogVisible = true;
  }

  closeAddExpenseDialog(): void {
    this.addExpenseDialogVisible = false;
    this.addExpenseReleaseId = 0;
    this.addExpenseReleaseTitle = '';
    this.isSubmittingExpense = false;
  }

  async onSubmitExpense(expenseData: any): Promise<void> {
    this.isSubmittingExpense = true;
    try {
      await this.onAddExpense(expenseData);
      this.closeAddExpenseDialog();
    } catch (error) {
      this.isSubmittingExpense = false;
    }
  }
}