import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { ModalToBodyDirective } from '../../../directives/modal-to-body.directive';

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
  manualPayment?: string;
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
  platform_fees: number;
}

@Component({
  selector: 'app-sublabel-payout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalToBodyDirective],
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
  isOfflinePayment: boolean = false;
  selectedPaymentMethodId: string = '';
  walletBalance: number = 0;
  loadingWalletBalance: boolean = false;

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
    payment_processing_fee: 0,
    manualPayment: '0'
  };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.loadWalletBalance();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.resetForm();
      this.loadPaymentMethods();
      this.loadWalletBalance();
      
      // Set amount to sublabel balance if available
      if (this.sublabel) {
        this.payoutData.amount = Math.round(this.sublabel.balance * 100) / 100;
        this.payoutData.description = `Payout for ${this.sublabel.brand_name}`;
      }
    }

    if (changes['sublabel'] && this.sublabel) {
      this.payoutData.amount = Math.round(this.sublabel.balance * 100) / 100;
      this.payoutData.description = `Payout for ${this.sublabel.brand_name}`;
    }
  }

  loadPaymentMethods(): void {
    if (!this.sublabel) {
      return;
    }

    this.loadingPaymentMethods = true;

    // Load payment methods for the sublabel (not the parent label)
    this.adminService.getPaymentMethodsForBrand(this.sublabel.brand_id).subscribe({
      next: (response: any) => {
        this.paymentMethods = response.paymentMethods || [];

        // Set default payment method if available
        const defaultMethod = this.paymentMethods.find(method => method.is_default_for_brand);
        if (defaultMethod) {
          this.payoutData.payment_method_id = defaultMethod.id;
          this.selectedPaymentMethodId = defaultMethod.id.toString();
        } else {
          // Default to manual payment if no default method
          this.selectedPaymentMethodId = '-1';
        }

        this.onPaymentMethodChange();

        this.loadingPaymentMethods = false;
      },
      error: (error) => {
        console.error('Error loading payment methods for sublabel:', error);
        this.loadingPaymentMethods = false;
        // Don't show error notification as this is not critical
      }
    });
  }

  loadWalletBalance(): void {
    this.loadingWalletBalance = true;
    
    this.adminService.getWalletBalance().subscribe({
      next: (balance: number) => {
        this.walletBalance = balance;
        this.loadingWalletBalance = false;
        // Update offline payment state based on wallet balance
        this.updateOfflinePaymentBasedOnBalance();
      },
      error: (error) => {
        console.error('Error loading wallet balance:', error);
        this.walletBalance = 0;
        this.loadingWalletBalance = false;
        // Force offline payment when wallet balance cannot be loaded
        this.updateOfflinePaymentBasedOnBalance();
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
      payment_processing_fee: 0,
      manualPayment: '0'
    };
    this.submitting = false;
    this.isOfflinePayment = false;
    this.selectedPaymentMethodId = '';
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

    // Round amount to nearest hundredths
    this.payoutData.amount = Math.round(this.payoutData.amount * 100) / 100;
    
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
    if (this.selectedPaymentMethodId === '-1') {
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

    // Set the payment_method_id based on selection
    const finalPayoutData = { ...this.payoutData };
    if (this.selectedPaymentMethodId && this.selectedPaymentMethodId !== '') {
      if (this.selectedPaymentMethodId === '-1') {
        finalPayoutData.payment_method_id = undefined;
      } else {
        finalPayoutData.payment_method_id = parseInt(this.selectedPaymentMethodId);
      }
    }

    this.submitting = true;
    this.submit.emit(finalPayoutData);
  }

  isUsingPaymentMethod(): boolean {
    return this.selectedPaymentMethodId !== '' && this.selectedPaymentMethodId !== '-1';
  }

  onPaymentMethodChange(): void {
    if (this.selectedPaymentMethodId === '-1') {
      // Manual payment - force offline payment
      this.payoutData.paid_thru_type = '';
      this.payoutData.paid_thru_account_name = '';
      this.payoutData.paid_thru_account_number = '';
      this.payoutData.payment_method_id = undefined;
      this.isOfflinePayment = true; // Force enable offline payment
    } else if (this.selectedPaymentMethodId && this.selectedPaymentMethodId !== '') {
      // Find selected payment method and populate fields
      const selectedMethod = this.paymentMethods.find(method => method.id.toString() === this.selectedPaymentMethodId);
      if (selectedMethod) {
        this.payoutData.paid_thru_type = selectedMethod.type;
        this.payoutData.paid_thru_account_name = selectedMethod.account_name;
        this.payoutData.paid_thru_account_number = selectedMethod.account_number_or_email;
        this.payoutData.payment_method_id = selectedMethod.id;
      }
    } else {
      // Clear all fields when no selection
      this.payoutData.paid_thru_type = '';
      this.payoutData.paid_thru_account_name = '';
      this.payoutData.paid_thru_account_number = '';
      this.payoutData.payment_method_id = undefined;
    }
    
    this.updateManualPaymentFlag();
    this.updateOfflinePaymentBasedOnBalance();
  }

  toggleOfflinePayment(): void {
    this.updateManualPaymentFlag();
  }

  updateManualPaymentFlag(): void {
    // Manual payment is true if:
    // 1. Offline payment checkbox is checked, OR
    // 2. Manual payment is selected
    const isManualSelected = this.selectedPaymentMethodId === '-1';
    this.payoutData.manualPayment = (this.isOfflinePayment || isManualSelected) ? '1' : '0';
  }

  shouldShowOfflineCheckbox(): boolean {
    // Hide the offline checkbox when manual payment is selected (it's forced enabled)
    return this.selectedPaymentMethodId !== '-1';
  }

  isManualSelected(): boolean {
    return this.selectedPaymentMethodId === '-1';
  }

  shouldShowReferenceAndFee(): boolean {
    // Show reference number and processing fee only when offline payment is ON
    return this.payoutData.manualPayment === '1';
  }

  hasEnoughWalletBalance(): boolean {
    return this.walletBalance >= (this.payoutData.amount || 0);
  }

  updateOfflinePaymentBasedOnBalance(): void {
    // Force offline payment if wallet balance is insufficient and not using manual payment
    if (!this.hasEnoughWalletBalance() && this.selectedPaymentMethodId !== '-1' && this.selectedPaymentMethodId !== '') {
      this.isOfflinePayment = true;
      this.updateManualPaymentFlag();
    }
  }

  shouldDisableOfflineToggle(): boolean {
    // Disable offline toggle when there's insufficient wallet balance
    return !this.hasEnoughWalletBalance() && this.selectedPaymentMethodId !== '-1';
  }

  getInsufficientBalanceTooltip(): string {
    return "You can only do offline payments as you do not have enough balance in your wallet.";
  }

  onAmountChange(): void {
    // Update offline payment state when amount changes
    this.updateOfflinePaymentBasedOnBalance();
  }
}