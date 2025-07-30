import { Component, OnInit, ViewChild } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';

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

export interface Document {
  id: number;
  title: string;
  filename: string;
  upload_date: string;
  url: string;
}

export interface ReleaseInfo {
  id: number;
  title: string;
  catalog_no: string;
  release_date: string;
  sync_royalty_percentage: number;
  sync_royalty_type: string;
  streaming_royalty_percentage: number;
  streaming_royalty_type: string;
  download_royalty_percentage: number;
  download_royalty_type: string;
  physical_royalty_percentage: number;
  physical_royalty_type: string;
  recuperable_expense_balance: number;
  total_earnings: number;
  total_royalties: number;
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
  @ViewChild('newPaymentFormComponent') newPaymentFormComponent?: NewPaymentFormComponent;
  
  private static getTodaysDate(): string {
    return new Date().toISOString().split('T')[0];
  }
  
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
  documents: Document[] = [];
  releases: ReleaseInfo[] = [];
  walletBalance: number = 0;

  // Pagination data
  paymentsPagination: any = null;
  paymentsLoading = false;
  paymentsFilters: any = {};
  paymentsSort: { column: string; direction: 'asc' | 'desc' } | null = null;

  // Latest data for summary view
  latestEarnings: Earning[] = [];
  latestRoyalties: Royalty[] = [];

  // Pagination data
  earningsPagination: any = null;
  royaltiesPagination: any = null;
  earningsLoading = false;
  royaltiesLoading = false;
  earningsFilters: any = {};
  royaltiesFilters: any = {};
  earningsSort: { column: string; direction: 'asc' | 'desc' } | null = null;
  royaltiesSort: { column: string; direction: 'asc' | 'desc' } | null = null;

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
    payment_method_id: null,
    reference_number: '',
    manualPayment: '0',
    date_paid: ''  // Will be set in ngOnInit
  };

  newEarningForm = {
    release_id: '',
    description: '',
    amount: 0,
    date_recorded: new Date().toISOString().split('T')[0],
    calculate_royalties: false
  };

  // Add payment method form
  addPaymentMethodForm = {
    bank_selection: '',
    account_name: '',
    account_number_or_email: ''
  };
  
  addingPaymentMethod = false;
  
  // Document upload form
  uploadingDocument = false;
  documentUploadForm = {
    title: '',
    file: null as File | null
  };

  // Release information form
  editingRoyalties = false;
  updatingRoyalties = false;

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
    { id: 'summary' as FinancialTabType, label: 'Summary', icon: 'fa-solid fa-info' },
    { id: 'documents' as FinancialTabType, label: 'Documents', icon: 'fa-solid fa-file' },
    { id: 'earnings' as FinancialTabType, label: 'Earnings', icon: 'fa-solid fa-dollar-sign' },
    { id: 'royalties' as FinancialTabType, label: 'Royalties', icon: 'fa-solid fa-star' },
    { id: 'payments' as FinancialTabType, label: 'Payments and Advances', icon: 'fa-solid fa-credit-card' },
    { id: 'release' as FinancialTabType, label: 'Release Information', icon: 'fa-solid fa-play' },
    { id: 'new-royalty' as FinancialTabType, label: 'New Royalty', icon: 'fa-solid fa-lock', adminOnly: true },
    { id: 'new-payment' as FinancialTabType, label: 'New Payment', icon: 'fa-solid fa-lock', adminOnly: true },
    { id: 'new-earning' as FinancialTabType, label: 'New Earning', icon: 'fa-solid fa-lock', adminOnly: true }
  ];

  constructor(
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private artistStateService: ArtistStateService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    this.isAdmin = this.authService.isAdmin();

    // Initialize payment form with today's date only if not already set
    if (!this.newPaymentForm.date_paid) {
      this.newPaymentForm.date_paid = FinancialComponent.getTodaysDate();
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
    } else if (tab === 'documents' && this.selectedArtist) {
      this.loadDocuments();
    } else if (tab === 'release' && this.selectedArtist) {
      this.loadReleases();
    } else if (tab === 'new-payment' && this.isAdmin) {
      this.loadWalletBalance();
      // Don't initialize form here - it would clear user input
      // Form should only be initialized on first load and after successful submission
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
      
      // Load first page of payments
      await this.loadPaymentsPage(1, this.paymentsFilters, this.paymentsSort);
      
      // Load first page of earnings and royalties for summary view
      const earningsResult = await this.financialService.getEarnings(this.selectedArtist.id, 1, 5);
      const royaltiesResult = await this.financialService.getRoyalties(this.selectedArtist.id, 1, 5);
      
      this.latestEarnings = earningsResult.earnings;
      this.latestRoyalties = royaltiesResult.royalties;
      
      // Initialize earnings and royalties data for tabs
      await this.loadEarningsPage(1, this.earningsFilters, this.earningsSort);
      await this.loadRoyaltiesPage(1, this.royaltiesFilters, this.royaltiesSort);
      
      // Load documents
      await this.loadDocuments();
      
      // Load releases
      await this.loadReleases();
      
      // Load payment methods and payout settings
      await this.loadPaymentMethods();
      await this.loadPayoutSettings();

    } catch (error) {
      console.error('Error loading financial data:', error);
      this.notificationService.showError('Failed to load financial data');
    } finally {
      this.loading = false;
    }
  }

  async loadEarningsPage(page: number, filters: any = {}, sort: { column: string; direction: 'asc' | 'desc' } | null = null): Promise<void> {
    if (!this.selectedArtist) return;
    this.earningsLoading = true;
    try {
      const result = await this.financialService.getEarnings(
        this.selectedArtist.id, 
        page, 
        20, 
        filters,
        sort?.column,
        sort?.direction
      );
      this.earnings = result.earnings;
      this.earningsPagination = result.pagination;
    } catch (error) {
      console.error('Error loading earnings page:', error);
      this.notificationService.showError('Failed to load earnings');
    } finally {
      this.earningsLoading = false;
    }
  }

  async loadRoyaltiesPage(page: number, filters: any = {}, sort: { column: string; direction: 'asc' | 'desc' } | null = null): Promise<void> {
    if (!this.selectedArtist) return;
    this.royaltiesLoading = true;
    try {
      const result = await this.financialService.getRoyalties(
        this.selectedArtist.id, 
        page, 
        20, 
        filters,
        sort?.column,
        sort?.direction
      );
      this.royalties = result.royalties;
      this.royaltiesPagination = result.pagination;
    } catch (error) {
      console.error('Error loading royalties page:', error);
      this.notificationService.showError('Failed to load royalties');
    } finally {
      this.royaltiesLoading = false;
    }
  }

  async loadPaymentsPage(page: number, filters: any = {}, sort: { column: string; direction: 'asc' | 'desc' } | null = null): Promise<void> {
    if (!this.selectedArtist) return;
    this.paymentsLoading = true;
    try {
      const result = await this.financialService.getPayments(
        this.selectedArtist.id, 
        page, 
        10, 
        filters,
        sort?.column,
        sort?.direction
      );
      this.payments = result.payments;
      this.paymentsPagination = result.pagination;
    } catch (error) {
      console.error('Error loading payments page:', error);
      this.notificationService.showError('Failed to load payments');
    } finally {
      this.paymentsLoading = false;
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

  private async loadDocuments(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      this.documents = await this.financialService.getDocuments(this.selectedArtist.id);
    } catch (error) {
      console.error('Error loading documents:', error);
      // Don't show error notification here since loadFinancialData will handle it
      // Only show specific error if called directly from setActiveTab
      if (this.activeTab === 'documents') {
        this.notificationService.showError('Failed to load documents');
      }
    }
  }

  async onPayNow(): Promise<void> {
    if (!this.selectedArtist || !this.summary || this.summary.currentBalance <= 0) return;
    
    this.setActiveTab('new-payment');
    // Pre-fill form with royalty payout details
    this.newPaymentForm.description = 'Royalty payout';
    this.newPaymentForm.amount = this.summary.currentBalance;
    this.newPaymentForm.date_paid = FinancialComponent.getTodaysDate(); // Ensure today's date
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
    // Update existing object properties instead of replacing the entire object to maintain reference binding
    this.newPaymentForm.description = '';
    this.newPaymentForm.amount = 0;
    this.newPaymentForm.payment_processing_fee = 0;
    this.newPaymentForm.paid_thru_type = '';
    this.newPaymentForm.paid_thru_account_name = '';
    this.newPaymentForm.paid_thru_account_number = '';
    this.newPaymentForm.payment_method_id = null;
    this.newPaymentForm.reference_number = '';
    this.newPaymentForm.manualPayment = '0';
    this.newPaymentForm.date_paid = FinancialComponent.getTodaysDate();
    
    // Reset the payment method selection to default
    if (this.newPaymentFormComponent) {
      this.newPaymentFormComponent.resetToDefault();
    }
  }

  private resetEarningForm(): void {
    this.newEarningForm = {
      release_id: '',
      description: '',
      amount: 0,
      date_recorded: new Date().toISOString().split('T')[0],
      calculate_royalties: false
    };
  }

  private resetPaymentMethodForm(): void {
    this.addPaymentMethodForm = {
      bank_selection: '',
      account_name: '',
      account_number_or_email: ''
    };
  }

  async onUploadDocument(): Promise<void> {
    if (!this.selectedArtist || this.uploadingDocument) return;

    if (!this.documentUploadForm.file) {
      this.notificationService.showError('Please select a file to upload');
      return;
    }

    if (!this.documentUploadForm.title.trim()) {
      this.notificationService.showError('Please enter a document title');
      return;
    }

    this.uploadingDocument = true;
    try {
      await this.financialService.uploadDocument(
        this.selectedArtist.id,
        this.documentUploadForm.file,
        this.documentUploadForm.title.trim()
      );

      this.notificationService.showSuccess('Document uploaded successfully');
      this.resetDocumentUploadForm();
      this.loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      this.notificationService.showError('Failed to upload document');
    } finally {
      this.uploadingDocument = false;
    }
  }

  async onDeleteDocument(documentId: number): Promise<void> {
    if (!this.selectedArtist) return;

    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await this.financialService.deleteDocument(this.selectedArtist.id, documentId);
      this.notificationService.showSuccess('Document deleted successfully');
      this.loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      this.notificationService.showError('Failed to delete document');
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.documentUploadForm.file = file;
    }
  }

  private resetDocumentUploadForm(): void {
    this.documentUploadForm = {
      title: '',
      file: null
    };
    // Reset file input
    const fileInput = document.getElementById('documentFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  private async loadReleases(): Promise<void> {
    if (!this.selectedArtist) return;

    try {
      const response = await this.financialService.getReleaseInformation(this.selectedArtist.id);
      this.releases = response.releases || [];
    } catch (error) {
      console.error('Error loading releases:', error);
      if (this.activeTab === 'release') {
        this.notificationService.showError('Failed to load release information');
      }
    }
  }

  private async loadWalletBalance(): Promise<void> {
    if (!this.isAdmin) return;

    try {
      this.walletBalance = await this.financialService.getWalletBalance();
    } catch (error) {
      console.error('Error loading wallet balance:', error);
      this.walletBalance = 0;
    }
  }

  private initializeNewPaymentForm(resetPaymentMethod: boolean = true): void {
    // Update existing object properties instead of replacing the entire object to maintain reference binding
    this.newPaymentForm.description = '';
    this.newPaymentForm.amount = 0;
    this.newPaymentForm.payment_processing_fee = 0;
    this.newPaymentForm.paid_thru_type = '';
    this.newPaymentForm.paid_thru_account_name = '';
    this.newPaymentForm.paid_thru_account_number = '';
    this.newPaymentForm.payment_method_id = null;
    this.newPaymentForm.reference_number = '';
    this.newPaymentForm.manualPayment = '0';
    this.newPaymentForm.date_paid = FinancialComponent.getTodaysDate();
    
    // Reset the payment method selection to default if requested and component is ready
    if (resetPaymentMethod) {
      setTimeout(() => {
        if (this.newPaymentFormComponent) {
          this.newPaymentFormComponent.resetToDefault();
        }
      }, 100); // Slightly longer delay to ensure component is fully ready
    }
  }

  toggleEditRoyalties(): void {
    this.editingRoyalties = !this.editingRoyalties;
  }

  async onUpdateRoyalties(): Promise<void> {
    if (!this.selectedArtist || this.updatingRoyalties) return;

    this.updatingRoyalties = true;
    try {
      const releases = this.releases.map(release => ({
        release_id: release.id,
        sync_royalty_percentage: release.sync_royalty_percentage * 100,
        streaming_royalty_percentage: release.streaming_royalty_percentage * 100,
        download_royalty_percentage: release.download_royalty_percentage * 100,
        physical_royalty_percentage: release.physical_royalty_percentage * 100
      }));

      await this.financialService.updateRoyalties(this.selectedArtist.id, releases);
      this.notificationService.showSuccess('Royalties updated successfully');
      this.editingRoyalties = false;
      this.loadReleases();
    } catch (error) {
      console.error('Error updating royalties:', error);
      this.notificationService.showError('Failed to update royalties');
    } finally {
      this.updatingRoyalties = false;
    }
  }

  async onAddExpense(expenseData: any): Promise<void> {
    if (!this.selectedArtist) {
      this.notificationService.showError('No artist selected');
      return;
    }

    try {
      await this.financialService.addRecuperableExpense(expenseData.release_id, {
        expense_description: expenseData.expense_description,
        expense_amount: parseFloat(expenseData.expense_amount),
        date_recorded: expenseData.date_recorded
      });

      this.notificationService.showSuccess('Recuperable expense added successfully');
      this.loadReleases();
    } catch (error) {
      console.error('Error adding expense:', error);
      this.notificationService.showError('Failed to add expense');
      throw error; // Re-throw to allow dialog to handle loading state
    }
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

  // Handle payments filter changes
  async onPaymentsFiltersChange(filters: any): Promise<void> {
    this.paymentsFilters = filters;
    await this.loadPaymentsPage(1, this.paymentsFilters, this.paymentsSort);
  }

  // Handle payments page changes (preserve current filters and sort)
  async onPaymentsPageChange(page: number): Promise<void> {
    await this.loadPaymentsPage(page, this.paymentsFilters, this.paymentsSort);
  }

  // Handle payments sort changes
  async onPaymentsSortChange(sortInfo: { column: string; direction: 'asc' | 'desc' } | null): Promise<void> {
    this.paymentsSort = sortInfo;
    await this.loadPaymentsPage(1, this.paymentsFilters, this.paymentsSort);
  }

  // Handle earnings filter changes
  async onEarningsFiltersChange(filters: any): Promise<void> {
    this.earningsFilters = filters;
    await this.loadEarningsPage(1, this.earningsFilters, this.earningsSort);
  }

  // Handle earnings page changes
  async onEarningsPageChange(page: number): Promise<void> {
    await this.loadEarningsPage(page, this.earningsFilters, this.earningsSort);
  }

  // Handle earnings sort changes
  async onEarningsSortChange(sortInfo: { column: string; direction: 'asc' | 'desc' } | null): Promise<void> {
    this.earningsSort = sortInfo;
    await this.loadEarningsPage(1, this.earningsFilters, this.earningsSort);
  }

  // Handle royalties filter changes
  async onRoyaltiesFiltersChange(filters: any): Promise<void> {
    this.royaltiesFilters = filters;
    await this.loadRoyaltiesPage(1, this.royaltiesFilters, this.royaltiesSort);
  }

  // Handle royalties page changes
  async onRoyaltiesPageChange(page: number): Promise<void> {
    await this.loadRoyaltiesPage(page, this.royaltiesFilters, this.royaltiesSort);
  }

  // Handle royalties sort changes
  async onRoyaltiesSortChange(sortInfo: { column: string; direction: 'asc' | 'desc' } | null): Promise<void> {
    this.royaltiesSort = sortInfo;
    await this.loadRoyaltiesPage(1, this.royaltiesFilters, this.royaltiesSort);
  }
}
