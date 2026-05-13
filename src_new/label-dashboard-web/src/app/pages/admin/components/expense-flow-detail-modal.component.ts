import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn } from '../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-expense-flow-detail-modal',
    imports: [CommonModule, PaginatedTableComponent, IconComponent],
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

  columns: TableColumn[] = [
    {
      key: 'date_recorded', label: 'Date', type: 'date',
      mobileGroup: 'summary',
      mobileClass: 'mobile-narrow'
    },
    {
      key: 'expense_description', label: 'Description', type: 'text',
      mobileGroup: 'summary', mobileGroupMain: true,
      mobileClass: 'mobile-text'
    },
    {
      key: 'expense_amount', label: 'Amount', type: 'number',
      align: 'right',
      renderHtml: true,
      formatter: (item) => {
        const cls = item.expense_amount < 0 ? 'tw-text-danger' : 'tw-text-success';
        const prefix = item.expense_amount < 0 ? '-' : '';
        return `<span class="${cls}">${prefix}${this.formatCurrency(item.expense_amount)}</span>`;
      },
      mobileClass: 'mobile-narrow mobile-number'
    }
  ];

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

}
