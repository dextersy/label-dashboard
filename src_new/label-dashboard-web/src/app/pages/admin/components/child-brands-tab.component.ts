import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService, ChildBrand, CreateSublabelResponse, SublabelCreationState, SublabelCompletionEvent } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { AddSublabelModalComponent } from '../../../components/shared/add-sublabel-modal/add-sublabel-modal.component';

@Component({
  selector: 'app-child-brands-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe, DateRangeFilterComponent, PaginatedTableComponent, AddSublabelModalComponent],
  templateUrl: './child-brands-tab.component.html',
  styleUrls: ['./child-brands-tab.component.scss']
})
export class ChildBrandsTabComponent implements OnInit, OnDestroy {
  loading: boolean = false;
  childBrands: ChildBrand[] = [];
  sortedChildBrands: ChildBrand[] = [];
  startDate: string = '';
  endDate: string = '';
  sortInfo: SortInfo | null = null;
  showAddSublabelModal: boolean = false;
  sublabelCreationState: SublabelCreationState = { inProgress: false, pendingName: '', pollCount: 0, maxPollCount: 60 };
  private subscriptions: Subscription[] = [];

  @ViewChild(AddSublabelModalComponent) addSublabelModal!: AddSublabelModalComponent;
  
  // Commission rates - matching PHP implementation
  readonly MUSIC_COMMISSION = 0.2; // 20%
  readonly EVENT_COMMISSION = 0.025; // 2.5%

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
      align: 'left'
    },
    { 
      key: 'music_earnings', 
      label: 'Net Music Earnings', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.music_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      key: 'event_earnings', 
      label: 'Net Event Earnings', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.event_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      key: 'commission', 
      label: 'Commission', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      key: 'payments', 
      label: 'Payments Made', 
      type: 'number',
      sortable: true,
      align: 'right',
      formatter: (item: ChildBrand) => `₱${item.payments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    private router: Router
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
    
    // Subscribe to sublabel completion events to refresh the list
    const completionSubscription = this.adminService.sublabelCompletion$.subscribe(
      (event: SublabelCompletionEvent | null) => {
        if (event) {
          // Refresh the child brands list to show the new sublabel
          this.loadChildBrands();
        }
      }
    );
    this.subscriptions.push(completionSubscription);
    
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
    return this.childBrands.reduce((total, brand) => total + brand.music_earnings, 0);
  }

  getTotalEventEarnings(): number {
    return this.childBrands.reduce((total, brand) => total + brand.event_earnings, 0);
  }

  getTotalCommission(): number {
    return this.childBrands.reduce((total, brand) => total + brand.commission, 0);
  }

  getTotalPayments(): number {
    return this.childBrands.reduce((total, brand) => total + brand.payments, 0);
  }

  // Superadmin check
  isSuperAdmin(): boolean {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.is_superadmin || false;
  }

  // Modal handlers
  openAddSublabelModal(): void {
    // Don't open modal if sublabel creation is in progress
    if (this.sublabelCreationState.inProgress) {
      return;
    }
    this.showAddSublabelModal = true;
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

    // First, try to find a verified domain
    const verifiedDomain = childBrand.domains.find(domain => domain.status === 'verified');
    if (verifiedDomain) {
      return verifiedDomain.domain_name;
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

}