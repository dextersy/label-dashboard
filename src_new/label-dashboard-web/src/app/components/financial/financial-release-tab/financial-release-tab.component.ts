import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReleaseInfo } from '../../../pages/financial/financial.component';
import { ReleaseExpensesDialogComponent } from '../release-expenses-dialog/release-expenses-dialog.component';

@Component({
  selector: 'app-financial-release-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReleaseExpensesDialogComponent],
  templateUrl: './financial-release-tab.component.html',
  styleUrl: './financial-release-tab.component.scss'
})
export class FinancialReleaseTabComponent {
  @Input() releases: ReleaseInfo[] = [];
  @Input() isAdmin: boolean = false;
  @Input() editingRoyalties: boolean = false;
  @Input() updatingRoyalties: boolean = false;
  @Input() addingExpense: boolean = false;
  @Input() expenseForm: any = {};
  @Input() toggleEditRoyalties: () => void = () => {};
  @Input() onUpdateRoyalties: () => Promise<void> = async () => {};
  @Input() openAddExpenseForm: (releaseId: number, releaseTitle: string) => void = () => {};
  @Input() closeAddExpenseForm: () => void = () => {};
  @Input() onAddExpense: () => Promise<void> = async () => {};

  expensesDialogVisible = false;
  selectedReleaseId = 0;
  selectedReleaseTitle = '';

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
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

  async addExpense(): Promise<void> {
    await this.onAddExpense();
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
}