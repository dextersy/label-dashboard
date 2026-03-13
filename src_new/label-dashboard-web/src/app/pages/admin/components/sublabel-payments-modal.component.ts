import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, TableAction, SearchFilters } from '../../../components/shared/paginated-table/paginated-table.component';

export interface SublabelPayment {
  id: number;
  description?: string;
  amount: number;
  date_paid: string;
  payment_processing_fee?: number;
  reference_number?: string;
  status?: string;

  // Legacy fields
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;

  // New fields
  payment_method_id?: number;
  paymentMethod?: {
    id: number;
    type: string;
    account_name: string;
    account_number_or_email: string;
  };
}

@Component({
    selector: 'app-sublabel-payments-modal',
    imports: [CommonModule, PaginatedTableComponent],
    templateUrl: './sublabel-payments-modal.component.html',
    styleUrls: ['./sublabel-payments-modal.component.scss']
})
export class SublabelPaymentsModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() brandId: number | null = null;
  @Input() brandName: string = '';
  @Output() close = new EventEmitter<void>();

  payments: SublabelPayment[] = [];
  pagination: PaginationInfo | null = null;
  loading: boolean = false;
  sortInfo: { column: string; direction: 'asc' | 'desc' } | null = null;
  totalAmount: number = 0;
  totalProcessingFees: number = 0;

  columns: TableColumn[] = [
    { key: 'date_paid', label: 'Date', type: 'date', sortable: true, searchable: false },
    { key: 'description', label: 'Description', type: 'text', sortable: true, searchable: false },
    {
      key: 'paid_thru_type',
      label: 'Method',
      type: 'text',
      sortable: false,
      searchable: false,
      formatter: (payment: SublabelPayment) => this.getPaymentMethodDisplay(payment)
    },
    { key: 'amount', label: 'Amount', type: 'number', sortable: true, searchable: false, align: 'right' },
    { key: 'payment_processing_fee', label: 'Fee', type: 'number', sortable: true, searchable: false, align: 'right' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'succeeded', label: 'Succeeded' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' }
      ],
      sortable: true,
      searchable: false,
      renderHtml: true,
      formatter: (payment: SublabelPayment) => this.formatStatus(payment.status)
    }
  ];

  rowActions: TableAction[] = [
    {
      icon: 'fas fa-check-circle',
      label: 'Mark as succeeded',
      type: 'secondary',
      hidden: (payment: SublabelPayment) => payment.status === 'succeeded',
      handler: (payment: SublabelPayment) => this.updateStatus(payment, 'succeeded')
    },
    {
      icon: 'fas fa-ban',
      label: 'Void payment',
      type: 'danger',
      hidden: (payment: SublabelPayment) => payment.status === 'failed',
      handler: (payment: SublabelPayment) => this.updateStatus(payment, 'failed')
    }
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.brandId) {
      this.loadPayments(1);
    }
    if (changes['show'] && !this.show) {
      this.payments = [];
      this.pagination = null;
      this.sortInfo = null;
      this.totalAmount = 0;
      this.totalProcessingFees = 0;
    }
  }

  async loadPayments(page: number = 1): Promise<void> {
    if (!this.brandId) return;

    this.loading = true;
    try {
      const response = await firstValueFrom(
        this.adminService.getSublabelPayments(
          this.brandId, page, 10,
          this.sortInfo?.column,
          this.sortInfo?.direction
        )
      );
      this.payments = response.payments || [];
      this.pagination = response.pagination || null;
      this.totalAmount = response.totalAmount || 0;
      this.totalProcessingFees = response.totalProcessingFees || 0;
    } catch {
      this.notificationService.showError('Failed to load payments');
    } finally {
      this.loading = false;
    }
  }

  async onSortChange(sort: { column: string; direction: 'asc' | 'desc' } | null): Promise<void> {
    this.sortInfo = sort;
    await this.loadPayments(1);
  }

  async updateStatus(payment: SublabelPayment, status: 'succeeded' | 'failed'): Promise<void> {
    if (!this.brandId) return;
    try {
      await firstValueFrom(this.adminService.updateSublabelPaymentStatus(this.brandId, payment.id, status));
      this.notificationService.showSuccess(status === 'succeeded' ? 'Payment marked as succeeded' : 'Payment voided');
      await this.loadPayments(this.pagination?.current_page ?? 1);
    } catch {
      this.notificationService.showError('Failed to update payment status');
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getPaymentMethodDisplay(payment: SublabelPayment): string {
    if (payment.paymentMethod) {
      return `${payment.paymentMethod.type} - ${payment.paymentMethod.account_name}`;
    }
    if (payment.paid_thru_type) {
      const accountName = payment.paid_thru_account_name || '';
      return payment.paid_thru_type + (accountName ? ` - ${accountName}` : '');
    }
    return 'N/A';
  }

  formatStatus(status: string | undefined): string {
    switch (status) {
      case 'pending': return '<span class="badge bg-warning text-dark">Pending</span>';
      case 'failed': return '<span class="badge bg-danger">Failed</span>';
      case 'succeeded':
      default: return '<span class="badge bg-success">Succeeded</span>';
    }
  }
}
