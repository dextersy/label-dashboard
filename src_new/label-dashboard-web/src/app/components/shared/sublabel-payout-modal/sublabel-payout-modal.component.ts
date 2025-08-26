import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

export interface SubLabelPayoutData {
  amount: number;
  description: string;
  date_paid: string;
  payment_method_id?: number;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
  reference_number?: string;
  payment_processing_fee?: number;
}

export interface LabelPaymentMethod {
  id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  is_default_for_brand: boolean;
  bank_code: string;
}

export interface ChildBrand {
  brand_id: number;
  brand_name: string;
  balance: number;
  music_earnings: number;
  event_earnings: number;
  payments: number;
}

@Component({
  selector: 'app-sublabel-payout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sublabel-payout-modal.component.html',
  styleUrls: ['./sublabel-payout-modal.component.scss']
})
export class SublabelPayoutModalComponent implements OnInit, OnChanges {
  @Input() show: boolean = false;
  @Input() sublabel: ChildBrand | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<SubLabelPayoutData>();

  submitting: boolean = false;
  loadingPaymentMethods: boolean = false;
  paymentMethods: LabelPaymentMethod[] = [];

  // Form data
  payoutData: SubLabelPayoutData = {
    amount: 0,
    description: '',
    date_paid: new Date().toISOString().split('T')[0],
    payment_method_id: undefined,
    paid_thru_type: '',
    paid_thru_account_name: '',
    paid_thru_account_number: '',
    reference_number: '',
    payment_processing_fee: 0
  };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadPaymentMethods();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.resetForm();
      this.loadPaymentMethods();
      
      // Set amount to sublabel balance if available
      if (this.sublabel) {
        this.payoutData.amount = this.sublabel.balance;
        this.payoutData.description = `Payout for ${this.sublabel.brand_name}`;
      }
    }

    if (changes['sublabel'] && this.sublabel) {
      this.payoutData.amount = this.sublabel.balance;
      this.payoutData.description = `Payout for ${this.sublabel.brand_name}`;
    }
  }

  loadPaymentMethods(): void {
    this.loadingPaymentMethods = true;
    
    this.adminService.getLabelPaymentMethods().subscribe({
      next: (response: any) => {
        this.paymentMethods = response.paymentMethods || [];
        
        // Set default payment method if available
        const defaultMethod = this.paymentMethods.find(method => method.is_default_for_brand);
        if (defaultMethod) {
          this.payoutData.payment_method_id = defaultMethod.id;
        }
        
        this.loadingPaymentMethods = false;
      },
      error: (error) => {
        console.error('Error loading payment methods:', error);
        this.loadingPaymentMethods = false;
        // Don't show error notification as this is not critical
      }
    });
  }

  resetForm(): void {
    this.payoutData = {
      amount: 0,
      description: '',
      date_paid: new Date().toISOString().split('T')[0],
      payment_method_id: undefined,
      paid_thru_type: '',
      paid_thru_account_name: '',
      paid_thru_account_number: '',
      reference_number: '',
      payment_processing_fee: 0
    };
    this.submitting = false;
  }

  resetSubmittingState(): void {
    this.submitting = false;
  }

  onClose(): void {
    if (!this.submitting) {
      this.close.emit();
    }
  }

  onSubmit(): void {
    if (this.submitting) return;

    // Validate required fields
    if (!this.payoutData.amount || this.payoutData.amount <= 0) {
      this.notificationService.showError('Amount is required and must be greater than 0');
      return;
    }

    if (!this.payoutData.date_paid) {
      this.notificationService.showError('Date paid is required');
      return;
    }

    // Validate payment method or manual payment details
    if (!this.payoutData.payment_method_id || this.payoutData.payment_method_id === -1) {
      // Manual payment - require manual payment details
      if (!this.payoutData.paid_thru_type) {
        this.notificationService.showError('Payment type is required for manual payments');
        return;
      }
      if (!this.payoutData.paid_thru_account_name) {
        this.notificationService.showError('Account name is required for manual payments');
        return;
      }
      if (!this.payoutData.paid_thru_account_number) {
        this.notificationService.showError('Account number is required for manual payments');
        return;
      }
    }

    this.submitting = true;
    this.submit.emit({ ...this.payoutData });
  }

  isUsingPaymentMethod(): boolean {
    return !!(this.payoutData.payment_method_id && this.payoutData.payment_method_id !== -1);
  }

  onPaymentMethodChange(): void {
    // Clear manual payment fields when switching to payment method
    if (this.isUsingPaymentMethod()) {
      this.payoutData.paid_thru_type = '';
      this.payoutData.paid_thru_account_name = '';
      this.payoutData.paid_thru_account_number = '';
    }
  }
}