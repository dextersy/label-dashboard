import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

export interface SublabelPayment {
  id: number;
  description?: string;
  amount: number;
  date_paid: string;
  payment_processing_fee?: number;
  reference_number?: string;

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
    imports: [CommonModule],
    templateUrl: './sublabel-payments-modal.component.html',
    styleUrls: ['./sublabel-payments-modal.component.scss']
})
export class SublabelPaymentsModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() brandId: number | null = null;
  @Input() brandName: string = '';
  @Output() close = new EventEmitter<void>();

  payments: SublabelPayment[] = [];
  loading: boolean = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Load payments when modal is opened and brandId is set
    if (changes['show'] && this.show && this.brandId) {
      this.loadPayments();
    }
  }

  loadPayments(): void {
    if (!this.brandId) {
      return;
    }

    this.loading = true;
    this.adminService.getSublabelPayments(this.brandId).subscribe({
      next: (response) => {
        // API returns { payments: [...], pagination: {...} }
        this.payments = response.payments || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sublabel payments:', error);
        this.notificationService.showError('Failed to load payments');
        this.loading = false;
      }
    });
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
    // Use new payment method if available
    if (payment.paymentMethod) {
      return `${payment.paymentMethod.type} - ${payment.paymentMethod.account_name}`;
    }

    // Fall back to legacy fields
    if (payment.paid_thru_type) {
      const accountName = payment.paid_thru_account_name || '';
      return payment.paid_thru_type + (accountName ? ` - ${accountName}` : '');
    }

    return 'N/A';
  }

  getTotalPayments(): number {
    return this.payments.reduce((total, payment) => {
      const amount = this.parseAmount(payment.amount);
      return total + amount;
    }, 0);
  }

  getTotalProcessingFees(): number {
    return this.payments.reduce((total, payment) => {
      const fee = this.parseAmount(payment.payment_processing_fee || 0);
      return total + fee;
    }, 0);
  }

  parseAmount(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      // Remove any formatting and parse as float
      const cleaned = value.replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
