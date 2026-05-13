import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FundraiserService, Fundraiser, Donation, DonationSummary } from '../../../../services/fundraiser.service';
import { AdminService, FeeSettings } from '../../../../services/admin.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SearchFilters, SortInfo } from '../../../../components/shared/paginated-table/paginated-table.component';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../../components/shared/date-range-filter/date-range-filter.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-fundraiser-donations-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatedTableComponent, DateRangeFilterComponent, IconComponent],
  templateUrl: './fundraiser-donations-tab.component.html',
  styleUrl: './fundraiser-donations-tab.component.scss'
})
export class FundraiserDonationsTabComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedFundraiser: Fundraiser | null = null;
  @Input() isAdmin = false;

  @Output() alertMessage = new EventEmitter<{ type: string; text: string }>();

  donations: Donation[] = [];
  summary: DonationSummary = {
    totalDonations: 0,
    totalRaised: 0,
    totalProcessingFees: 0,
    netAmount: 0
  };

  loading = false;
  statusFilter = 'paid';

  // Pagination properties
  pagination: PaginationInfo | null = null;
  currentSort: SortInfo | null = { column: 'createdAt', direction: 'desc' };
  currentFilters: SearchFilters = {};
  currentDateRange: DateRangeSelection | null = null;

  // Table configuration
  tableColumns: TableColumn[] = [];

  // Fee settings to determine column label
  hasPlatformFees = false;

  private subscriptions = new Subscription();

  constructor(
    private fundraiserService: FundraiserService,
    private adminService: AdminService
  ) {
    this.initializeTableColumns();
  }

  private initializeTableColumns(): void {
    this.tableColumns = [
      { key: 'name', label: 'Donor', searchable: true, sortable: true, renderHtml: true, formatter: (item) => this.getDisplayName(item), cardHeader: true },
      { key: 'email', label: 'Email', searchable: true, sortable: true, formatter: (item) => item.anonymous ? 'Hidden' : item.email },
      { key: 'amount', label: 'Amount', searchable: false, sortable: true, type: 'number', align: 'right' },
      {
        key: 'fee',
        label: this.hasPlatformFees ? 'Platform Fee' : 'Processing Fee',
        searchable: false,
        sortable: false,
        type: 'number',
        align: 'right',
        formatter: (item) => this.formatCurrency(this.hasPlatformFees ? item.platform_fee : item.processing_fee)
      },
      { key: 'status', label: 'Status', searchable: false, sortable: true, type: 'select', renderHtml: true, options: [
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' },
        { value: 'refunded', label: 'Refunded' }
      ], formatter: (item) => this.getStatusHtml(item.payment_status) },
      { key: 'createdAt', label: 'Date', searchable: false, sortable: true, type: 'date' }
    ];
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.fundraiserService.dataRefresh$.subscribe(() => {
        if (this.selectedFundraiser) {
          this.loadDonations();
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedFundraiser'] && this.selectedFundraiser) {
      this.loadFeeSettings();
      this.loadDonations();
    }
  }

  private loadFeeSettings(): void {
    if (!this.selectedFundraiser) return;

    this.adminService.getFeeSettings(this.selectedFundraiser.brand_id).subscribe({
      next: (settings: FeeSettings) => {
        // Check if fundraiser fees are configured (not 0)
        const hasFixedFee = (settings.fundraiser?.transaction_fixed_fee || 0) > 0;
        const hasPercentageFee = (settings.fundraiser?.revenue_percentage_fee || 0) > 0;
        this.hasPlatformFees = hasFixedFee || hasPercentageFee;
        // Reinitialize table columns with updated label
        this.initializeTableColumns();
      },
      error: (error) => {
        console.error('Failed to load fee settings:', error);
        // Default to processing fee if we can't load settings
        this.hasPlatformFees = false;
        this.initializeTableColumns();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDonations(page: number = 1): void {
    if (!this.selectedFundraiser) return;

    this.loading = true;

    this.subscriptions.add(
      this.fundraiserService.getDonations({
        fundraiser_id: this.selectedFundraiser.id,
        page,
        limit: 20,
        status_filter: this.statusFilter,
        sort_field: this.currentSort?.column,
        sort_order: this.currentSort?.direction?.toUpperCase(),
        start_date: this.currentDateRange?.startDate,
        end_date: this.currentDateRange?.endDate,
        filters: this.currentFilters
      }).subscribe({
        next: (response) => {
          this.donations = response.donations;
          this.pagination = {
            current_page: response.pagination.page,
            total_pages: response.pagination.totalPages,
            total_count: response.pagination.total,
            per_page: response.pagination.limit,
            has_next: response.pagination.page < response.pagination.totalPages,
            has_prev: response.pagination.page > 1
          };
          this.summary = response.summary;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load donations:', error);
          this.alertMessage.emit({ type: 'error', text: 'Failed to load donations' });
          this.loading = false;
        }
      })
    );
  }

  // Pagination event handlers
  onPageChange(page: number): void {
    this.loadDonations(page);
  }

  onFiltersChange(filters: SearchFilters): void {
    this.currentFilters = filters;
    // Check if status filter changed
    if (filters['status'] !== undefined) {
      this.statusFilter = filters['status'] || 'all';
    }
    this.loadDonations(1);
  }

  onSortChange(sortInfo: SortInfo | null): void {
    this.currentSort = sortInfo;
    this.loadDonations(1);
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.currentDateRange = dateRange;
    this.loadDonations(1);
  }

  onRefresh(): void {
    this.loadDonations(this.pagination?.current_page || 1);
  }

  getDisplayName(donation: Donation): string {
    if (donation.anonymous) {
      return `<span class="avatar-chip"><span class="avatar-chip__circle avatar-chip__circle--anon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Anonymous</span>`;
    }
    const initials = this.getInitials(donation.name);
    const idx = this.getAvatarColorIndex(donation.name);
    return `<span class="avatar-chip"><span class="avatar-chip__circle ac-${idx}">${initials}</span>${donation.name}</span>`;
  }

  getStatusHtml(status: string): string {
    const badgeClass = this.getStatusBadgeClass(status);
    return `<span class="${badgeClass}">${status}</span>`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'paid':     return 'status-badge status-success';
      case 'pending':  return 'status-badge status-warning';
      case 'failed':   return 'status-badge status-danger';
      case 'refunded': return 'status-badge status-secondary';
      default:         return 'status-badge status-secondary';
    }
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) {
      return '-';
    }
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  private readonly avatarColors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarColorIndex(name: string): number {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % this.avatarColors.length;
  }

  getAvatarColor(name: string): string {
    return this.avatarColors[this.getAvatarColorIndex(name)];
  }
}
