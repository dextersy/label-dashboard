import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { FinancialSummaryTabComponent } from '../../components/financial/financial-summary-tab/financial-summary-tab.component';
import { FinancialDocumentsTabComponent } from '../../components/financial/financial-documents-tab/financial-documents-tab.component';
import { FinancialEarningsTabComponent } from '../../components/financial/financial-earnings-tab/financial-earnings-tab.component';
import { FinancialRoyaltiesTabComponent } from '../../components/financial/financial-royalties-tab/financial-royalties-tab.component';
import { FinancialPaymentsTabComponent } from '../../components/financial/financial-payments-tab/financial-payments-tab.component';
import { FinancialReleaseTabComponent } from '../../components/financial/financial-release-tab/financial-release-tab.component';
import { NewRoyaltyFormComponent } from '../../components/financial/new-royalty-form/new-royalty-form.component';
import { NewPaymentFormComponent } from '../../components/financial/new-payment-form/new-payment-form.component';
import { NewEarningFormComponent } from '../../components/financial/new-earning-form/new-earning-form.component';
import { FinancialService } from '../../services/financial.service';
import { NotificationService } from '../../services/notification.service';
import { ArtistStateService } from '../../services/artist-state.service';

export type FinancialTabType = 'summary' | 'documents' | 'earnings' | 'royalties' | 'payments' | 'release' | 'new-royalty' | 'new-payment' | 'new-earning';

export interface FinancialSummary {
  currentBalance: number;
  totalEarnings: number;
  totalRoyalties: number;
  totalPayments: number;
}

export interface Earning {
  id: number;
  date_recorded: string;
  release_title: string;
  description: string;
  amount: number;
}

export interface Royalty {
  id: number;
  date_recorded: string;
  release_title: string;
  description: string;
  amount: number;
}

export interface Payment {
  id: number;
  date_paid: string;
  description: string;
  paid_thru_type: string;
  paid_thru_account_name: string;
  paid_thru_account_number: string;
  amount: number;
  payment_processing_fee: number;
}

export interface PaymentMethod {
  id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  is_default_for_artist: boolean;
}

export interface PayoutSettings {
  payout_point: number;
  hold_payouts: boolean;
}

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    FinancialSummaryTabComponent,
    FinancialDocumentsTabComponent,
    FinancialEarningsTabComponent,
    FinancialRoyaltiesTabComponent,
    FinancialPaymentsTabComponent,
    FinancialReleaseTabComponent,
    NewRoyaltyFormComponent,
    NewPaymentFormComponent,
    NewEarningFormComponent
  ],
  templateUrl: './financial.component.html',
  styleUrl: './financial.component.scss'
})
export class FinancialComponent implements OnInit {
  selectedArtist: Artist | null = null;
  activeTab: FinancialTabType = 'summary';
  isAdmin = false;
  loading = false;

  // Financial data
  summary: FinancialSummary | null = null;
  earnings: Earning[] = [];
  royalties: Royalty[] = [];
  payments: Payment[] = [];
  paymentMethods: PaymentMethod[] = [];
  payoutSettings: PayoutSettings | null = null;

  // Latest data for summary view
  latestEarnings: Earning[] = [];
  latestRoyalties: Royalty[] = [];

  // Pagination data
  earningsPagination: any = null;
  royaltiesPagination: any = null;
  earningsLoading = false;
  royaltiesLoading = false;

  // Form data for new entries
  newRoyaltyForm = {
    release_id: '',
    description: '',
    amount: 0,
    date_recorded: new Date().toISOString().split('T')[0]
  };

  newPaymentForm = {
    description: '',
    amount: 0,
    payment_processing_fee: 0,
    paid_thru_type: '',
    paid_thru_account_name: '',
    paid_thru_account_number: '',
    date_paid: new Date().toISOString().split('T')[0]
  };

  newEarningForm = {
    release_id: '',
    description: '',
    amount: 0,
    date_recorded: new Date().toISOString().split('T')[0]
  };

  // Add payment method form
  addPaymentMethodForm = {
    bank_selection: '',
    account_name: '',
    account_number_or_email: ''
  };
  
  addingPaymentMethod = false;

  supportedBanks = [
    { bank_code: 'BPI', bank_name: 'Bank of the Philippine Islands' },
    { bank_code: 'BDO', bank_name: 'Banco de Oro' },
    { bank_code: 'METRO', bank_name: 'Metropolitan Bank' },
    { bank_code: 'PNB', bank_name: 'Philippine National Bank' },
    { bank_code: 'UNION', bank_name: 'Union Bank' },
    { bank_code: 'GCASH', bank_name: 'GCash' },
    { bank_code: 'PAYMAYA', bank_name: 'PayMaya' }
  ];

  tabs = [
    { id: 'summary' as FinancialTabType, label: 'Summary', icon: 'fa-info' },
    { id: 'documents' as FinancialTabType, label: 'Documents', icon: 'fa-file' },
    { id: 'earnings' as FinancialTabType, label: 'Earnings', icon: 'fa-dollar' },
    { id: 'royalties' as FinancialTabType, label: 'Royalties', icon: 'fa-star' },
    { id: 'payments' as FinancialTabType, label: 'Payments and Advances', icon: 'fa-credit-card' },
    { id: 'release' as FinancialTabType, label: 'Release Information', icon: 'fa-play' },
    { id: 'new-royalty' as FinancialTabType, label: 'New Royalty', icon: 'fa-lock', adminOnly: true },
    { id: 'new-payment' as FinancialTabType, label: 'New Payment', icon: 'fa-lock', adminOnly: true },
    { id: 'new-earning' as FinancialTabType, label: 'New Earning', icon: 'fa-lock', adminOnly: true }
  ];

  constructor(
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.isAdmin = user.isAdmin || false;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    // Subscribe to artist state changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
      if (artist) {
        this.loadFinancialData();
      }
    });
  }


  onAlertMessage(alert: { type: 'success' | 'error', message: string }): void {
    if (alert.type === 'success') {
      this.notificationService.showSuccess(alert.message);
    } else {
      this.notificationService.showError(alert.message);
    }
  }

  setActiveTab(tab: FinancialTabType): void {
    this.activeTab = tab;
    
    // Load specific data when switching to certain tabs
    if (tab === 'payments' && this.selectedArtist) {
      this.loadPaymentMethods();
      this.loadPayoutSettings();
    }
  }

  shouldShowTab(tab: any): boolean {
    if (tab.adminOnly && !this.isAdmin) {
      return false;
    }
    return true;
  }

  getTabClass(tabId: FinancialTabType): string {
    return this.activeTab === tabId ? 'active' : '';
  }

  private async loadFinancialData(): Promise<void> {
    if (!this.selectedArtist) return;

    this.loading = true;
    try {
      // Load summary data
      this.summary = await this.financialService.getFinancialSummary(this.selectedArtist.id);
      
      // Load payments (still not paginated)
      this.payments = await this.financialService.getPayments(this.selectedArtist.id);
      
      // Load first page of earnings and royalties for summary view
      const earningsResult = await this.financialService.getEarnings(this.selectedArtist.id, 1, 5);
      const royaltiesResult = await this.financialService.getRoyalties(this.selectedArtist.id, 1, 5);
      
      this.latestEarnings = earningsResult.earnings;
      this.latestRoyalties = royaltiesResult.royalties;
      
      // Initialize earnings and royalties data for tabs
      await this.loadEarningsPage(1);
      await this.loadRoyaltiesPage(1);

    } catch (error) {
      console.error('Error loading financial data:', error);
      this.notificationService.showError('Failed to load financial data');
    } finally {
      this.loading = false;
    }
  }

  async loadEarningsPage(page: number): Promise<void> {
    if (!this.selectedArtist) return;
    this.earningsLoading = true;
    try {
      const result = await this.financialService.getEarnings(this.selectedArtist.id, page, 20);
      this.earnings = result.earnings;
      this.earningsPagination = result.pagination;
    } catch (error) {
      console.error('Error loading earnings page:', error);
      this.notificationService.showError('Failed to load earnings');
    } finally {
      this.earningsLoading = false;
    }
  }

  async loadRoyaltiesPage(page: number): Promise<void> {
    if (!this.selectedArtist) return;
    this.royaltiesLoading = true;
    try {
      const result = await this.financialService.getRoyalties(this.selectedArtist.id, page, 20);
      this.royalties = result.royalties;
      this.royaltiesPagination = result.pagination;
    } catch (error) {
      console.error('Error loading royalties page:', error);
      this.notificationService.showError('Failed to load royalties');
    } finally {
      this.royaltiesLoading = false;
    }
  }

  private async loadPaymentMethods(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      this.paymentMethods = await this.financialService.getPaymentMethods(this.selectedArtist.id);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  }

  private async loadPayoutSettings(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      this.payoutSettings = await this.financialService.getPayoutSettings(this.selectedArtist.id);
    } catch (error) {
      console.error('Error loading payout settings:', error);
    }
  }

  async onPayNow(): Promise<void> {
    if (!this.selectedArtist || !this.summary || this.summary.currentBalance <= 0) return;
    
    this.setActiveTab('new-payment');
    this.newPaymentForm.description = 'Royalty payout';
    this.newPaymentForm.amount = this.summary.currentBalance;
  }

  async onSubmitRoyalty(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      await this.financialService.createRoyalty(this.selectedArtist.id, this.newRoyaltyForm);
      this.notificationService.showSuccess('Royalty added successfully');
      this.resetRoyaltyForm();
      this.loadFinancialData();
      this.setActiveTab('royalties');
    } catch (error) {
      console.error('Error creating royalty:', error);
      this.notificationService.showError('Failed to add royalty');
    }
  }

  async onSubmitPayment(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      await this.financialService.createPayment(this.selectedArtist.id, this.newPaymentForm);
      this.notificationService.showSuccess('Payment added successfully');
      this.resetPaymentForm();
      this.loadFinancialData();
      this.setActiveTab('payments');
    } catch (error) {
      console.error('Error creating payment:', error);
      this.notificationService.showError('Failed to add payment');
    }
  }

  async onSubmitEarning(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      await this.financialService.createEarning(this.selectedArtist.id, this.newEarningForm);
      this.notificationService.showSuccess('Earning added successfully');
      this.resetEarningForm();
      this.loadFinancialData();
      this.setActiveTab('earnings');
    } catch (error) {
      console.error('Error creating earning:', error);
      this.notificationService.showError('Failed to add earning');
    }
  }

  async onSubmitPaymentMethod(): Promise<void> {
    if (!this.selectedArtist || this.addingPaymentMethod) return;

    this.addingPaymentMethod = true;
    try {
      const [bankCode, bankName] = this.addPaymentMethodForm.bank_selection.split(',');
      const paymentMethodData = {
        type: bankName,
        account_name: this.addPaymentMethodForm.account_name,
        account_number_or_email: this.addPaymentMethodForm.account_number_or_email
      };

      await this.financialService.addPaymentMethod(this.selectedArtist.id, paymentMethodData);
      this.notificationService.showSuccess('Payment method added successfully');
      this.resetPaymentMethodForm();
      this.loadPaymentMethods();
    } catch (error) {
      console.error('Error adding payment method:', error);
      this.notificationService.showError('Failed to add payment method');
    } finally {
      this.addingPaymentMethod = false;
    }
  }

  async onUpdatePayoutSettings(): Promise<void> {
    if (!this.selectedArtist || !this.payoutSettings) return;

    try {
      await this.financialService.updatePayoutSettings(this.selectedArtist.id, this.payoutSettings);
      this.notificationService.showSuccess('Payout settings updated successfully');
    } catch (error) {
      console.error('Error updating payout settings:', error);
      this.notificationService.showError('Failed to update payout settings');
    }
  }

  async onDeletePaymentMethod(paymentMethodId: number): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      await this.financialService.deletePaymentMethod(this.selectedArtist.id, paymentMethodId);
      this.notificationService.showSuccess('Payment method deleted successfully');
      this.loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      this.notificationService.showError('Failed to delete payment method');
    }
  }

  async onSetDefaultPaymentMethod(paymentMethodId: number): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      await this.financialService.setDefaultPaymentMethod(this.selectedArtist.id, paymentMethodId);
      this.notificationService.showSuccess('Default payment method updated successfully');
      this.loadPaymentMethods();
    } catch (error) {
      console.error('Error setting default payment method:', error);
      this.notificationService.showError('Failed to set default payment method');
    }
  }

  private resetRoyaltyForm(): void {
    this.newRoyaltyForm = {
      release_id: '',
      description: '',
      amount: 0,
      date_recorded: new Date().toISOString().split('T')[0]
    };
  }

  private resetPaymentForm(): void {
    this.newPaymentForm = {
      description: '',
      amount: 0,
      payment_processing_fee: 0,
      paid_thru_type: '',
      paid_thru_account_name: '',
      paid_thru_account_number: '',
      date_paid: new Date().toISOString().split('T')[0]
    };
  }

  private resetEarningForm(): void {
    this.newEarningForm = {
      release_id: '',
      description: '',
      amount: 0,
      date_recorded: new Date().toISOString().split('T')[0]
    };
  }

  private resetPaymentMethodForm(): void {
    this.addPaymentMethodForm = {
      bank_selection: '',
      account_name: '',
      account_number_or_email: ''
    };
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
}
