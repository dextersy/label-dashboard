import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
    selector: 'app-expense-flow-detail-modal',
    imports: [CommonModule, PaginatedTableComponent],
    templateUrl: './expense-flow-detail-modal.component.html',
    styleUrl: './expense-flow-detail-modal.component.scss'
})
export class ExpenseFlowDetailModalComponent implements OnChanges {
  @Input() releaseId: number = 0;
  @Input() releaseTitle: string = '';
  @Input() startDate: string = '';
  @Input() endDate: string = '';
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  expenses: any[] = [];
  pagination: PaginationInfo | null = null;
  loading = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        document.body.classList.add('modal-open');
        if (this.releaseId) {
          this.loadExpenses(1);
        }
      } else {
        document.body.classList.remove('modal-open');
      }
    }
  }

  loadExpenses(page: number = 1): void {
    if (!this.releaseId || !this.startDate || !this.endDate) return;

    this.loading = true;

    this.adminService.getRecuperableExpenseFlowDetails(this.releaseId, this.startDate, this.endDate, page, 10).subscribe({
      next: (response) => {
        this.expenses = response.data;
        this.pagination = response.pagination;
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load expense details');
        this.loading = false;
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onPageChange(page: number): void {
    this.loadExpenses(page);
  }

  formatCurrency(amount: number): string {
    return '₱' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
