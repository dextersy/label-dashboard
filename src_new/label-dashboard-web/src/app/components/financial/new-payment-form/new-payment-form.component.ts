import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-payment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-payment-form.component.html',
  styleUrl: './new-payment-form.component.scss'
})
export class NewPaymentFormComponent implements OnInit, OnChanges {
  @Input() newPaymentForm: any = {};
  @Input() paymentMethods: any[] = [];
  @Input() walletBalance: number = 0;
  @Input() onSubmitPayment: () => Promise<void> = async () => {};

  isManualPayment = false;
  selectedPaymentMethodId: string = '';

  ngOnInit(): void {
    this.ensureDateIsToday();
    this.initializeDefaultPaymentMethod();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['newPaymentForm'] && this.newPaymentForm) {
      this.ensureDateIsToday();
    }
    if (changes['paymentMethods'] && this.paymentMethods?.length > 0) {
      this.initializeDefaultPaymentMethod();
    }
  }

  ensureDateIsToday(): void {
    if (!this.newPaymentForm || !this.newPaymentForm.date_paid) {
      if (this.newPaymentForm) {
        this.newPaymentForm.date_paid = new Date().toISOString().split('T')[0];
      }
    }
  }

  initializeDefaultPaymentMethod(): void {
    if (!this.paymentMethods || this.paymentMethods.length === 0) {
      // No payment methods available, default to non-cash
      this.selectedPaymentMethodId = '-1';
      this.onPaymentMethodChange({ target: { value: '-1' } });
      return;
    }

    // Look for default payment method
    const defaultMethod = this.paymentMethods.find(pm => pm.is_default_for_artist);
    
    if (defaultMethod) {
      // Use the default payment method
      this.selectedPaymentMethodId = defaultMethod.id.toString();
      this.onPaymentMethodChange({ target: { value: defaultMethod.id.toString() } });
    } else {
      // No default set, use non-cash
      this.selectedPaymentMethodId = '-1';
      this.onPaymentMethodChange({ target: { value: '-1' } });
    }
  }

  onPaymentMethodChange(event: any): void {
    const selectedValue = event.target.value;
    this.selectedPaymentMethodId = selectedValue;
    
    if (selectedValue === '-1') {
      // Manual/Non-cash payment - force offline payment
      this.newPaymentForm.paid_thru_type = ''; // Leave blank for non-cash payments
      this.newPaymentForm.paid_thru_account_name = '';
      this.newPaymentForm.paid_thru_account_number = '';
      this.newPaymentForm.payment_method_id = null;
      this.isManualPayment = true; // Force enable offline payment
    } else if (selectedValue) {
      // Find selected payment method and populate fields
      const selectedMethod = this.paymentMethods.find(pm => pm.id == selectedValue);
      if (selectedMethod) {
        this.newPaymentForm.paid_thru_type = selectedMethod.type;
        this.newPaymentForm.paid_thru_account_name = selectedMethod.account_name;
        this.newPaymentForm.paid_thru_account_number = selectedMethod.account_number_or_email;
        this.newPaymentForm.payment_method_id = selectedMethod.id;
      }
      // Don't change isManualPayment when selecting real payment methods
    } else {
      // Clear all fields when no selection
      this.newPaymentForm.paid_thru_type = '';
      this.newPaymentForm.paid_thru_account_name = '';
      this.newPaymentForm.paid_thru_account_number = '';
      this.newPaymentForm.payment_method_id = null;
      // Don't change isManualPayment when clearing selection
    }
    
    // Update manual payment flag based on offline checkbox and selection
    this.updateManualPaymentFlag();
  }

  toggleManualPayment(): void {
    this.updateManualPaymentFlag();
  }

  updateManualPaymentFlag(): void {
    // Manual payment is true if:
    // 1. Offline payment checkbox is checked, OR
    // 2. Non-cash/adjustment is selected
    const isNonCashSelected = this.selectedPaymentMethodId === '-1';
    this.newPaymentForm.manualPayment = (this.isManualPayment || isNonCashSelected) ? '1' : '0';
  }

  shouldShowWalletBalance(): boolean {
    // Show wallet balance only when:
    // 1. Not an offline payment (checkbox unchecked), AND
    // 2. A real payment method is selected (not non-cash), AND
    // 3. Payment method ID exists
    return !this.isManualPayment && this.newPaymentForm.payment_method_id && this.newPaymentForm.payment_method_id !== null;
  }

  isInsufficientBalance(): boolean {
    return this.shouldShowWalletBalance() && this.newPaymentForm.amount > this.walletBalance;
  }

  shouldShowOfflineCheckbox(): boolean {
    // Hide the offline checkbox when non-cash is selected (it's forced enabled)
    return this.selectedPaymentMethodId !== '-1';
  }

  isNonCashSelected(): boolean {
    return this.selectedPaymentMethodId === '-1';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  resetToDefault(): void {
    this.initializeDefaultPaymentMethod();
  }
}