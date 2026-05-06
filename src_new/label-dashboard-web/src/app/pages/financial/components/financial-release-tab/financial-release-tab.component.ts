import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReleaseInfo } from '../../financial.component';
import { ReleaseExpensesDialogComponent } from '../release-expenses-dialog/release-expenses-dialog.component';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-financial-release-tab',
    imports: [CommonModule, FormsModule, ReleaseExpensesDialogComponent, AddExpenseDialogComponent, IconComponent],
    templateUrl: './financial-release-tab.component.html',
    styleUrl: './financial-release-tab.component.scss'
})
export class FinancialReleaseTabComponent {
  constructor(private router: Router) {}
  @Input() releases: ReleaseInfo[] = [];
  @Input() isAdmin: boolean = false;
  @Input() editingRoyalties: boolean = false;
  @Input() updatingRoyalties: boolean = false;
  @Input() toggleEditRoyalties: () => void = () => {};
  @Input() onUpdateRoyalties: () => Promise<void> = async () => {};
  @Input() onAddExpense: (expenseData: any) => Promise<void> = async () => {};

  // Dialog state (unchanged)
  expensesDialogVisible = false;
  selectedReleaseId = 0;
  selectedReleaseTitle = '';
  addExpenseDialogVisible = false;
  addExpenseReleaseId = 0;
  addExpenseReleaseTitle = '';
  isSubmittingExpense = false;

  // Per-row expand / edit state
  expandedRow: number | null = null;
  editingRow: number | null = null;
  isSavingRow = false;

  // Mobile card expand state
  openMobileCard: number | null = null;
  mobileEditingCard: number | null = null;
  isSavingMobileCard = false;

  // ── Summary stats ──────────────────────────────────────────────
  get totalEarnings(): number {
    return this.releases.reduce((s, r) => s + (r.total_earnings || 0), 0);
  }
  get totalRoyalties(): number {
    return this.releases.reduce((s, r) => s + (r.total_royalties || 0), 0);
  }
  get totalExpenses(): number {
    return this.releases.reduce((s, r) => s + (r.recuperable_expense_balance || 0), 0);
  }

  // ── Formatters (unchanged) ────────────────────────────────────
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
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

  // ── Desktop row interactions ──────────────────────────────────
  toggleRow(i: number): void {
    if (this.editingRow === i) return;
    this.expandedRow = this.expandedRow === i ? null : i;
    if (this.expandedRow !== i) this.editingRow = null;
  }

  startEditRow(i: number, event: Event): void {
    event.stopPropagation();
    this.expandedRow = i;
    this.editingRow = i;
  }

  async saveRowEdit(i: number, event: Event): Promise<void> {
    event.stopPropagation();
    this.isSavingRow = true;
    try {
      await this.onUpdateRoyalties();
      this.editingRow = null;
    } finally {
      this.isSavingRow = false;
    }
  }

  cancelRowEdit(i: number, event: Event): void {
    event.stopPropagation();
    this.editingRow = null;
  }

  // ── Mobile card interactions ──────────────────────────────────
  toggleMobileCard(i: number): void {
    if (this.mobileEditingCard === i) return;
    this.openMobileCard = this.openMobileCard === i ? null : i;
  }

  startMobileEdit(i: number, event: Event): void {
    event.stopPropagation();
    this.openMobileCard = i;
    this.mobileEditingCard = i;
  }

  async saveMobileEdit(event: Event): Promise<void> {
    event.stopPropagation();
    this.isSavingMobileCard = true;
    try {
      await this.onUpdateRoyalties();
      this.mobileEditingCard = null;
    } finally {
      this.isSavingMobileCard = false;
    }
  }

  cancelMobileEdit(event: Event): void {
    event.stopPropagation();
    this.mobileEditingCard = null;
  }

  // ── Navigation ───────────────────────────────────────────────
  goToEarnings(event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/financial/earnings']);
  }

  goToRoyalties(event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/financial/royalties']);
  }

  // ── Dialogs (unchanged) ───────────────────────────────────────
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

  // Legacy — kept so parent toggleEditRoyalties input still works if called
  async updateRoyalties(): Promise<void> {
    await this.onUpdateRoyalties();
  }
}
