import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Payment, PaymentMethod, PayoutSettings } from '../../financial.component';
import { PaymentsTableComponent } from '../payments-table/payments-table.component';
import { PaginationInfo, SearchFilters } from '../../../../components/shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../../services/auth.service';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-financial-payments-tab',
    imports: [CommonModule, FormsModule, PaymentsTableComponent, IconComponent],
    templateUrl: './financial-payments-tab.component.html',
    styleUrl: './financial-payments-tab.component.scss'
})
export class FinancialPaymentsTabComponent {
  @Input() payments: Payment[] = [];
  @Input() paymentsPagination: PaginationInfo | null = null;
  @Input() paymentsLoading: boolean = false;
  @Input() paymentsSort: { column: string; direction: 'asc' | 'desc' } | null = null;
  @Input() paymentMethods: PaymentMethod[] = [];
  @Output() paymentsPageChange = new EventEmitter<number>();
  @Output() paymentsFiltersChange = new EventEmitter<SearchFilters>();
  @Output() paymentsSortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' } | null>();
  @Output() paymentsRefresh = new EventEmitter<void>();
  @Input() payoutSettings: PayoutSettings | null = null;
  @Input() supportedBanks: { bank_code: string; bank_name: string }[] = [];
  @Input() addPaymentMethodForm: any = {};
  @Input() addingPaymentMethod: boolean = false;
  @Input() onSubmitPaymentMethod: () => Promise<void> = async () => {};
  @Input() onUpdatePayoutSettings: () => Promise<void> = async () => {};
  @Input() onDeletePaymentMethod: (paymentMethodId: number) => Promise<void> = async () => {};
  @Input() onSetDefaultPaymentMethod: (paymentMethodId: number) => Promise<void> = async () => {};

  isAdmin = false;
  isAddPaymentMethodCollapsed = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.isAdmin = user ? user.is_admin : false;
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  async deletePaymentMethod(paymentMethodId: number): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Payment Method',
      message: 'Are you sure you want to delete this payment method?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    await this.onDeletePaymentMethod(paymentMethodId);
  }

  async setDefaultPaymentMethod(paymentMethodId: number): Promise<void> {
    await this.onSetDefaultPaymentMethod(paymentMethodId);
  }

  navigateToNewPayment(): void {
    this.router.navigate(['/financial/payments/new']);
  }

  toggleAddPaymentMethodCollapse(): void {
    this.isAddPaymentMethodCollapsed = !this.isAddPaymentMethodCollapsed;
  }

  getBankInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  getBankColor(name: string): string {
    const palette = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#06b6d4', '#f97316', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

}