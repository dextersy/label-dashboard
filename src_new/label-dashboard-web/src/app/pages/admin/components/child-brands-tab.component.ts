import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, ChildBrand } from '../../../services/admin.service';
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
export class ChildBrandsTabComponent implements OnInit {
  loading: boolean = false;
  childBrands: ChildBrand[] = [];
  sortedChildBrands: ChildBrand[] = [];
  startDate: string = '';
  endDate: string = '';
  sortInfo: SortInfo | null = null;
  showAddSublabelModal: boolean = false;

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
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadChildBrands();
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
    this.showAddSublabelModal = true;
  }

  closeAddSublabelModal(): void {
    this.showAddSublabelModal = false;
  }

  onCreateSublabel(data: { brandName: string, subdomainName: string }): void {
    this.adminService.createSublabel(data.brandName, '', data.subdomainName).subscribe({
      next: (response) => {
        const message = response.message || 'Sublabel created successfully';
        this.notificationService.showSuccess(message);
        // Reset form fields after successful creation
        if (this.addSublabelModal) {
          this.addSublabelModal.resetFormAfterSuccess();
        }
        this.closeAddSublabelModal();
        this.loadChildBrands(); // Refresh the list
      },
      error: (error) => {
        console.error('Error creating sublabel:', error);
        const errorMessage = error.error?.error || 'Failed to create sublabel';
        this.notificationService.showError(errorMessage);
        // Reset the modal's submitting state to allow retry
        if (this.addSublabelModal) {
          this.addSublabelModal.resetSubmittingState();
        }
      }
    });
  }
}