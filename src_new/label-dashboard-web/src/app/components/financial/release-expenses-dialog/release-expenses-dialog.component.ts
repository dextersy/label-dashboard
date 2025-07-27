import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo } from '../../shared/paginated-table/paginated-table.component';
import { ExpensesTableComponent } from '../expenses-table/expenses-table.component';

export interface ReleaseExpense {
  id: number;
  date_recorded: string;
  expense_description: string;
  expense_amount: number;
}

@Component({
  selector: 'app-release-expenses-dialog',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent, ExpensesTableComponent],
  templateUrl: './release-expenses-dialog.component.html',
  styleUrl: './release-expenses-dialog.component.scss'
})
export class ReleaseExpensesDialogComponent implements OnInit {
  @Input() releaseId: number = 0;
  @Input() releaseTitle: string = '';
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  expenses: ReleaseExpense[] = [];
  pagination: PaginationInfo | null = null;
  loading = false;
  
  constructor(
    private financialService: FinancialService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.isVisible && this.releaseId) {
      this.loadExpenses();
    }
  }

  ngOnChanges(): void {
    if (this.isVisible && this.releaseId) {
      this.loadExpenses(1);
    }
  }

  async loadExpenses(page: number = 1): Promise<void> {
    if (!this.releaseId) return;

    this.loading = true;
    
    try {
      const result = await this.financialService.getReleaseExpenses(this.releaseId, page, 10);
      this.expenses = result.expenses.map(expense => ({
        id: expense.id,
        date_recorded: expense.date_recorded,
        expense_description: expense.expense_description,
        expense_amount: expense.expense_amount
      }));
      this.pagination = result.pagination;
    } catch (error) {
      console.error('Error loading release expenses:', error);
      this.notificationService.showError('Failed to load expenses');
    } finally {
      this.loading = false;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onPageChange(page: number): void {
    this.loadExpenses(page);
  }
}