import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AdminService, ChildBrand, CreateSublabelResponse, SublabelCreationState, SublabelCompletionEvent, DomainVerificationState } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { PaginatedTableComponent, TableColumn, TableAction, HeaderAction, PaginationInfo, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { AddSublabelModalComponent } from '../../admin/components/add-sublabel-modal/add-sublabel-modal.component';
import { FeeSettingsModalComponent } from '../../admin/components/fee-settings-modal/fee-settings-modal.component';
import { FeatureTogglesModalComponent } from '../../admin/components/feature-toggles-modal/feature-toggles-modal.component';
import { SublabelPayoutModalComponent, SubLabelPayoutData } from '../../admin/components/sublabel-payout-modal/sublabel-payout-modal.component';
import { EarningsBreakdownModalComponent, AggregatedTotals } from '../../admin/components/earnings-breakdown-modal.component';
import { SublabelPaymentsModalComponent } from '../../admin/components/sublabel-payments-modal.component';
import { FeeSettings } from '../../../services/admin.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-labels-sublabels',
    imports: [CommonModule, FormsModule, DateRangeFilterComponent, PaginatedTableComponent, AddSublabelModalComponent, FeeSettingsModalComponent, FeatureTogglesModalComponent, SublabelPayoutModalComponent, EarningsBreakdownModalComponent, SublabelPaymentsModalComponent, BreadcrumbComponent, IconComponent],
    templateUrl: './sublabels.component.html',
    styleUrls: ['./sublabels.component.scss']
})
export class LabelsSubLabelsComponent implements OnInit, OnDestroy {
  loading: boolean = false;
  childBrands: ChildBrand[] = [];
  sortedChildBrands: ChildBrand[] = [];
  startDate: string = '';
  endDate: string = '';
  sortInfo: SortInfo | null = null;
  showAddSublabelModal: boolean = false;
  showFeeSettingsModal: boolean = false;
  selectedSublabelForFees: ChildBrand | null = null;
  showFeatureTogglesModal: boolean = false;
  selectedSublabelForToggles: ChildBrand | null = null;
  showPayoutModal: boolean = false;
  selectedSublabelForPayout: ChildBrand | null = null;
  showEarningsBreakdownModal: boolean = false;
  selectedSublabelForBreakdown: ChildBrand | null = null;
  aggregatedTotalsForBreakdown: AggregatedTotals | null = null;
  earningsBreakdownType: 'music' | 'event' | 'fundraiser' | 'platform_fees' | 'total_event' | 'total_platform_fees' = 'music';
  showPaymentsModal: boolean = false;
  selectedSublabelForPayments: ChildBrand | null = null;
  sublabelCreationState: SublabelCreationState = { inProgress: false, pendingName: '', pollCount: 0, maxPollCount: 60 };
  domainVerificationState: DomainVerificationState = { inProgress: false, pendingDomain: '', pollCount: 0, maxPollCount: 60 };
  private subscriptions: Subscription[] = [];

  @ViewChild(AddSublabelModalComponent) addSublabelModal!: AddSublabelModalComponent;
  @ViewChild('payoutModal') payoutModal!: SublabelPayoutModalComponent;

  // Table configuration
  tableColumns: TableColumn[] = [
    { 
      key: 'brand_id', 
      label: 'Brand ID', 
      type: 'number',
      searchable: true,
      sortable: true,
      align: 'left'
    },
    {
      key: 'brand_name',
      label: 'Brand Name',
      type: 'text',
      searchable: true,
      sortable: true,
      align: 'left',
      cardHeader: true,
      renderHtml: true,
      formatter: (item: ChildBrand): SafeHtml => {
        const logoUrl = this.getBrandLogoUrl(item.logo_url);
        const bg = item.brand_color || this.getAvatarColor(item.brand_name);
        const circle = logoUrl
          ? `<span class="avatar-chip__circle avatar-chip__circle--img" style="background:${bg}"><img src="${logoUrl}" alt=""></span>`
          : `<span class="avatar-chip__circle" style="background:${bg}">${this.getInitials(item.brand_name)}</span>`;
        return this.sanitizer.bypassSecurityTrustHtml(`<span class="avatar-chip">${circle}${item.brand_name}</span>`);
      }
    },
    {
      key: 'status',
      label: 'Status',
      type: 'text',
      searchable: true,
      sortable: true,
      align: 'center',
      renderHtml: true,
      formatter: (item: ChildBrand) => {
        const status = item.status || 'Unknown';
        switch (status) {
          case 'OK':         return '<span class="status-badge status-success" title="All the domains are connected and SSL certified.">OK</span>';
          case 'Pending':    return '<span class="status-badge status-info" title="Working on it. Please check again in a few minutes.">Pending</span>';
          case 'Warning':    return '<span class="status-badge status-warning" title="Some domains are unverified or have SSL issues">Warning</span>';
          case 'Unverified': return '<span class="status-badge status-danger" title="You don\'t have any verified domains for this sublabel.">Unverified</span>';
          case 'No domains': return '<span class="status-badge status-secondary">No domains</span>';
          default:           return '<span class="status-badge status-secondary">Unknown</span>';
        }
      }
    },
    {
      key: 'music_earnings',
      label: 'Net Music Earnings + Royalties',
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${(item.music_earnings + item.total_royalties).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showBreakdownButton: true
    },
    {
      key: 'event_earnings',
      label: 'Net Event Earnings',
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.event_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showBreakdownButton: true
    },
    {
      key: 'fundraiser_earnings',
      label: 'Net Fundraiser Earnings',
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${(item.fundraiser_earnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showBreakdownButton: true
    },
    {
      key: 'payments',
      label: 'Payouts Made',
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.payments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showBreakdownButton: true
    },
    { 
      key: 'platform_fees', 
      label: 'Platform Fees', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.platform_fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showBreakdownButton: true
    },
    { 
      key: 'balance', 
      label: 'Payable Balance', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  ];

  get headerActions(): HeaderAction[] {
    return [{
      icon: () => this.isAnyPollingInProgress() ? 'spinner' : 'plus',
      label: () => {
        if (this.sublabelCreationState.inProgress) return `Creating ${this.sublabelCreationState.pendingName}...`;
        if (this.domainVerificationState.inProgress) return `Verifying ${this.domainVerificationState.pendingDomain}...`;
        return 'Add';
      },
      handler: () => this.openAddSublabelModal(),
      type: 'primary',
      disabled: () => this.loading || this.isAnyPollingInProgress(),
      hidden: () => !this.isSuperAdmin(),
      title: () => this.getAddSublabelButtonTooltip(),
    }];
  }

  sublabelActions: TableAction[] = [
    {
      icon: 'external-link',
      label: 'Go to Dashboard',
      hidden: (item) => !this.hasDomains(item),
      handler: (item) => this.openSublabelDashboard(item)
    },
    {
      icon: 'shield',
      label: 'Verify Domains',
      hidden: (item) => !this.canVerifyDomains(item),
      handler: (item) => this.verifyDomains(item)
    },
    {
      icon: 'currency',
      label: 'Fee Settings',
      handler: (item) => this.openFeeSettingsModal(item)
    },
    {
      icon: 'toggle',
      label: 'Toggle Features',
      handler: (item) => this.openFeatureTogglesModal(item)
    },
    {
      icon: 'currency',
      label: 'Pay Out',
      handler: (item) => this.openPayoutModal(item)
    }
  ];

  // Pagination (not actually used for server-side pagination, but required for component)
  pagination: PaginationInfo = {
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 999,
    has_next: false,
    has_prev: false
  };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadChildBrands();
    
    // Subscribe to global sublabel creation state
    const stateSubscription = this.adminService.sublabelCreationState$.subscribe(
      (state) => {
        this.sublabelCreationState = state;
      }
    );
    this.subscriptions.push(stateSubscription);
    
    // Subscribe to domain verification state
    const domainVerificationSubscription = this.adminService.domainVerificationState$.subscribe(
      (state) => {
        this.domainVerificationState = state;
      }
    );
    this.subscriptions.push(domainVerificationSubscription);
    
    // Subscribe to sublabel completion events to refresh the list
    const completionSubscription = this.adminService.sublabelCompletion$.subscribe(
      (event: SublabelCompletionEvent | null) => {
        if (event) {
          console.log('[ChildBrands] Sublabel creation completed, refreshing table:', event);
          // Refresh the child brands list to show the new sublabel
          this.loadChildBrands();
        }
      }
    );
    this.subscriptions.push(completionSubscription);
    
    // Subscribe to domain verification completion events to refresh the list
    const domainVerificationCompletionSubscription = this.adminService.domainVerificationCompletion$.subscribe(
      (event: any) => {
        if (event) {
          console.log('[ChildBrands] Domain verification completed, refreshing table:', event);
          // Refresh the child brands list to show updated domain statuses
          this.loadChildBrands();
        }
      }
    );
    this.subscriptions.push(domainVerificationCompletionSubscription);
    
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadChildBrands(): void {
    this.loading = true;
    
    this.adminService.getSublabels(
      this.startDate || undefined, 
      this.endDate || undefined
    ).subscribe({
      next: (brands) => {
        
        this.childBrands = brands;
        this.applySorting();
        this.pagination.total_count = brands.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading child brands:', error);
        this.notificationService.showError('Failed to load sublabels');
        this.loading = false;
      }
    });
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    if (dateRange.preset === 'alltime') {
      this.startDate = '';
      this.endDate = '';
    } else {
      this.startDate = dateRange.startDate;
      this.endDate = dateRange.endDate;
    }
    this.loadChildBrands();
  }

  onRefreshData(): void {
    this.loadChildBrands();
  }

  onSortChange(sortInfo: SortInfo | null): void {
    this.sortInfo = sortInfo;
    this.applySorting();
  }

  private applySorting(): void {
    if (!this.sortInfo) {
      this.sortedChildBrands = [...this.childBrands];
      return;
    }

    this.sortedChildBrands = [...this.childBrands].sort((a, b) => {
      const key = this.sortInfo!.column as keyof ChildBrand;
      let aValue = a[key];
      let bValue = b[key];

      // Handle null/undefined values
      if (aValue == null) aValue = 0 as any;
      if (bValue == null) bValue = 0 as any;

      let comparison = 0;

      // Type-specific comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return this.sortInfo!.direction === 'asc' ? comparison : -comparison;
    });
  }

  getTotalBalance(): number {
    return this.childBrands.reduce((total, brand) => total + brand.balance, 0);
  }

  getTotalMusicEarnings(): number {
    return this.childBrands.reduce((total, brand) => total + brand.music_earnings + brand.total_royalties, 0);
  }

  getTotalEventEarnings(): number {
    return this.childBrands.reduce((total, brand) => total + brand.event_earnings, 0);
  }

  getTotalFundraiserEarnings(): number {
    return this.childBrands.reduce((total, brand) => total + (brand.fundraiser_earnings || 0), 0);
  }

  getTotalPayments(): number {
    return this.childBrands.reduce((total, brand) => total + brand.payments, 0);
  }

  getTotalPlatformFees(): number {
    return this.childBrands.reduce((total, brand) => total + brand.platform_fees, 0);
  }

  // Calculate aggregated totals for event earnings
  getAggregatedEventTotals(): AggregatedTotals {
    return {
      event_sales: this.childBrands.reduce((total, brand) => total + (brand.event_sales || 0), 0),
      event_platform_fees: this.childBrands.reduce((total, brand) => total + (brand.event_platform_fees || 0), 0),
      event_processing_fees: this.childBrands.reduce((total, brand) => total + (brand.event_processing_fees || 0), 0),
      event_estimated_tax: this.childBrands.reduce((total, brand) => total + (brand.event_estimated_tax || 0), 0),
      event_earnings: this.childBrands.reduce((total, brand) => total + (brand.event_earnings || 0), 0)
    };
  }

  // Calculate aggregated totals for platform fees
  getAggregatedPlatformFeesTotals(): AggregatedTotals {
    return {
      event_sales: 0,
      event_platform_fees: 0,
      event_processing_fees: 0,
      event_estimated_tax: 0,
      event_earnings: 0,
      music_platform_fees: this.childBrands.reduce((total, brand) => total + (brand.music_platform_fees || 0), 0),
      aggregated_event_platform_fees: this.childBrands.reduce((total, brand) => total + (brand.event_platform_fees || 0), 0),
      total_platform_fees: this.childBrands.reduce((total, brand) => total + (brand.platform_fees || 0), 0)
    };
  }

  // Open Total Platform Fees breakdown modal
  openTotalPlatformFeesBreakdown(): void {
    this.aggregatedTotalsForBreakdown = this.getAggregatedPlatformFeesTotals();
    this.selectedSublabelForBreakdown = null;
    this.earningsBreakdownType = 'total_platform_fees';
    this.showEarningsBreakdownModal = true;
  }

  // Superadmin check
  isSuperAdmin(): boolean {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.is_superadmin || false;
  }

  // Modal handlers
  openAddSublabelModal(): void {
    // Don't open modal if any polling operation is in progress
    if (this.isAnyPollingInProgress()) {
      return;
    }
    this.showAddSublabelModal = true;
  }
  
  isAnyPollingInProgress(): boolean {
    return this.sublabelCreationState.inProgress || this.domainVerificationState.inProgress;
  }
  
  getAddSublabelButtonTooltip(): string {
    if (this.sublabelCreationState.inProgress) {
      return `Please wait - sublabel creation in progress for "${this.sublabelCreationState.pendingName}"`;
    }
    if (this.domainVerificationState.inProgress) {
      return `Please wait - domain verification in progress for "${this.domainVerificationState.pendingDomain}"`;
    }
    return 'Create a new sublabel';
  }

  closeAddSublabelModal(): void {
    this.showAddSublabelModal = false;
  }

  onCreateSublabel(data: { brandName: string, subdomainName: string }): void {
    this.adminService.createSublabel(data.brandName, '', data.subdomainName).subscribe({
      next: (response: CreateSublabelResponse) => {
        console.log('[Sublabel Creation] API Response:', response);
        
        // Check if this is an async operation
        if (response.status === 'processing') {
          // Start tracking through global service
          const sublabelName = response.brand_name || data.brandName;
          this.adminService.startSublabelCreationTracking(sublabelName);
          
          console.log(`[Sublabel Creation] Starting async creation for "${sublabelName}"`);
          
          // Show initial async notification
          this.notificationService.showInfo(
            `We are building your new sublabel! This may take a few minutes. We'll notify you when it's ready!`
          );
          
          // Reset form and close modal immediately
          if (this.addSublabelModal) {
            this.addSublabelModal.resetFormAfterSuccess();
          }
          this.closeAddSublabelModal();
          
          return;
        }
        
        // Handle legacy synchronous response
        const message = response.message || 'Sublabel created successfully';
        this.notificationService.showSuccess(message);
        
        // Check SSL configuration status and show warning if needed
        if (response.sublabel?.ssl_configured === false && response.sublabel?.ssl_message) {
          const sslMessage = response.sublabel.ssl_message;
          // Check if this is a DNS success but SSL failure scenario
          if (sslMessage.includes('DNS configured successfully, but SSL certificate')) {
            this.notificationService.showWarning(
              `SSL Configuration Required: ${sslMessage}`
            );
          }
        }
        
        // Reset form fields after successful creation
        if (this.addSublabelModal) {
          this.addSublabelModal.resetFormAfterSuccess();
        }
        this.closeAddSublabelModal();
        this.loadChildBrands(); // Refresh the list
      },
      error: (error) => {
        console.error('[Sublabel Creation] Error response:', error);
        console.error('[Sublabel Creation] Error status:', error.status);
        console.error('[Sublabel Creation] Error body:', error.error);
        
        const errorMessage = error.error?.error || 'Failed to create sublabel';
        this.notificationService.showError(errorMessage);
        // Reset the modal's submitting state to allow retry
        if (this.addSublabelModal) {
          this.addSublabelModal.resetSubmittingState();
        }
      }
    });
  }

  // Get the best domain for a sublabel (prioritize verified domains)
  getBestDomainForSublabel(childBrand: ChildBrand): string | null {
    if (!childBrand.domains || childBrand.domains.length === 0) {
      return null;
    }

    // First, try to find a connected domain
    const connectedDomain = childBrand.domains.find(domain => domain.status === 'Connected');
    if (connectedDomain) {
      return connectedDomain.domain_name;
    }

    // Next, try to find a domain with SSL issues but working DNS
    const noSslDomain = childBrand.domains.find(domain => domain.status === 'No SSL');
    if (noSslDomain) {
      return noSslDomain.domain_name;
    }

    // If no verified domain, use the first available domain
    return childBrand.domains[0].domain_name;
  }

  // Open sublabel dashboard in new tab
  openSublabelDashboard(childBrand: ChildBrand): void {
    const domain = this.getBestDomainForSublabel(childBrand);
    if (domain) {
      const url = `https://${domain}`;
      window.open(url, '_blank');
    } else {
      this.notificationService.showError('No domain found for this sublabel');
    }
  }

  // Check if a sublabel has any domains configured
  hasDomains(childBrand: ChildBrand): boolean {
    return !!(childBrand.domains && childBrand.domains.length > 0);
  }

  // Show "Verify Domains" only for Unverified/Warning sublabels that have verifiable domains
  canVerifyDomains(childBrand: ChildBrand): boolean {
    if (childBrand.status !== 'Unverified' && childBrand.status !== 'Warning') {
      return false;
    }
    return !!(childBrand.domains?.some(d => d.status !== 'Connected' && d.status !== 'Pending'));
  }

  verifyDomains(childBrand: ChildBrand): void {
    const domainsToVerify = childBrand.domains?.filter(
      d => d.status !== 'Connected' && d.status !== 'Pending'
    ) || [];

    if (domainsToVerify.length === 0) return;

    let callsRemaining = domainsToVerify.length;
    let hasError = false;

    const onComplete = () => {
      callsRemaining--;
      if (callsRemaining === 0) {
        if (!hasError) {
          this.notificationService.showInfo(
            `Domain verification started for ${childBrand.brand_name}. Status will update in a few minutes.`
          );
        }
        this.loadChildBrands();
      }
    };

    domainsToVerify.forEach(domain => {
      this.adminService.verifyDomainForBrand(childBrand.brand_id, domain.domain_name).subscribe({
        next: () => onComplete(),
        error: (error) => {
          hasError = true;
          const msg = error.error?.error || 'Failed to start domain verification';
          this.notificationService.showError(msg);
          onComplete();
        }
      });
    });
  }

  // Fee Settings Modal handlers
  openFeeSettingsModal(childBrand: ChildBrand): void {
    this.selectedSublabelForFees = childBrand;
    this.showFeeSettingsModal = true;
  }

  closeFeeSettingsModal(): void {
    this.showFeeSettingsModal = false;
    this.selectedSublabelForFees = null;
  }

  onFeeSettingsSaved(feeSettings: FeeSettings): void {
    this.notificationService.showSuccess(`Fee settings updated for ${this.selectedSublabelForFees?.brand_name}`);
    this.closeFeeSettingsModal();
    // Optionally refresh the data if needed
    // this.loadChildBrands();
  }

  // Feature Toggles Modal handlers
  openFeatureTogglesModal(childBrand: ChildBrand): void {
    this.selectedSublabelForToggles = childBrand;
    this.showFeatureTogglesModal = true;
  }

  closeFeatureTogglesModal(): void {
    this.showFeatureTogglesModal = false;
    this.selectedSublabelForToggles = null;
  }

  onFeatureTogglesSaved(): void {
    this.closeFeatureTogglesModal();
  }

  // Payout Modal handlers
  openPayoutModal(childBrand: ChildBrand): void {
    this.selectedSublabelForPayout = childBrand;
    this.showPayoutModal = true;
  }

  closePayoutModal(): void {
    this.showPayoutModal = false;
    this.selectedSublabelForPayout = null;
  }

  onPayoutSubmit(payoutData: SubLabelPayoutData): void {
    if (!this.selectedSublabelForPayout) {
      return;
    }

    const sublabelName = this.selectedSublabelForPayout.brand_name;
    const sublabelBrandId = this.selectedSublabelForPayout.brand_id; // Use the sublabel's brand ID
    
    this.adminService.createLabelPayment(sublabelBrandId, payoutData).subscribe({
      next: (response) => {
        this.notificationService.showSuccess(`Payment of ₱${payoutData.amount.toFixed(2)} created successfully for ${sublabelName}`);
        this.closePayoutModal();
        
        // Refresh the child brands list to show updated balances
        this.loadChildBrands();
      },
      error: (error) => {
        console.error('Error creating label payment:', error);
        const errorMessage = error.error?.error || 'Failed to create payment';
        this.notificationService.showError(errorMessage);
        
        // Reset the submitting state in the modal
        if (this.payoutModal) {
          this.payoutModal.resetSubmittingState();
        }
      }
    });
  }

  // Earnings Breakdown Modal handlers
  openMusicBreakdown(brandId: number): void {
    const childBrand = this.childBrands.find(b => b.brand_id === brandId);
    if (childBrand) {
      this.selectedSublabelForBreakdown = childBrand;
      this.earningsBreakdownType = 'music';
      this.showEarningsBreakdownModal = true;
    }
  }

  openEventBreakdown(brandId: number): void {
    const childBrand = this.childBrands.find(b => b.brand_id === brandId);
    if (childBrand) {
      this.selectedSublabelForBreakdown = childBrand;
      this.earningsBreakdownType = 'event';
      this.showEarningsBreakdownModal = true;
    }
  }

  closeEarningsBreakdownModal(): void {
    this.showEarningsBreakdownModal = false;
    this.selectedSublabelForBreakdown = null;
    this.aggregatedTotalsForBreakdown = null;
  }

  // Open Total Event Earnings breakdown modal
  openTotalEventBreakdown(): void {
    this.aggregatedTotalsForBreakdown = this.getAggregatedEventTotals();
    this.selectedSublabelForBreakdown = null; // No specific sublabel
    this.earningsBreakdownType = 'total_event';
    this.showEarningsBreakdownModal = true;
  }

  // Payments Modal handlers
  openPaymentsBreakdown(brandId: number): void {
    const childBrand = this.childBrands.find(b => b.brand_id === brandId);
    if (childBrand) {
      this.selectedSublabelForPayments = childBrand;
      this.showPaymentsModal = true;
    }
  }

  closePaymentsModal(): void {
    this.showPaymentsModal = false;
    this.selectedSublabelForPayments = null;
  }

  // Handle breakdown button clicks from the table
  onBreakdownButtonClick(event: {item: ChildBrand, columnKey: string}): void {
    if (event.columnKey === 'music_earnings') {
      this.openMusicBreakdown(event.item.brand_id);
    } else if (event.columnKey === 'event_earnings') {
      this.openEventBreakdown(event.item.brand_id);
    } else if (event.columnKey === 'fundraiser_earnings') {
      this.openFundraiserBreakdown(event.item.brand_id);
    } else if (event.columnKey === 'platform_fees') {
      this.openPlatformFeesBreakdown(event.item.brand_id);
    } else if (event.columnKey === 'payments') {
      this.openPaymentsBreakdown(event.item.brand_id);
    }
  }

  openFundraiserBreakdown(brandId: number): void {
    const childBrand = this.childBrands.find(b => b.brand_id === brandId);
    if (childBrand) {
      this.selectedSublabelForBreakdown = childBrand;
      this.earningsBreakdownType = 'fundraiser';
      this.showEarningsBreakdownModal = true;
    }
  }

  openPlatformFeesBreakdown(brandId: number): void {
    const childBrand = this.childBrands.find(b => b.brand_id === brandId);
    if (childBrand) {
      this.selectedSublabelForBreakdown = childBrand;
      this.earningsBreakdownType = 'platform_fees';
      this.showEarningsBreakdownModal = true;
    }
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  getBrandLogoUrl(logoUrl?: string | null): string {
    if (!logoUrl) return '';
    return logoUrl.startsWith('http') ? logoUrl : `/api/uploads/brands/${logoUrl}`;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColorIndex(name: string): number {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 8;
  }

  getAvatarColor(name: string): string {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];
    if (!name) return colors[0];
    return colors[this.getAvatarColorIndex(name)];
  }

  getStatusBadgeClass(status: string | undefined): string {
    switch (status) {
      case 'OK':         return 'status-badge status-success';
      case 'Pending':    return 'status-badge status-info';
      case 'Warning':    return 'status-badge status-warning';
      case 'Unverified': return 'status-badge status-danger';
      case 'No domains': return 'status-badge status-secondary';
      default:           return 'status-badge status-secondary';
    }
  }

}