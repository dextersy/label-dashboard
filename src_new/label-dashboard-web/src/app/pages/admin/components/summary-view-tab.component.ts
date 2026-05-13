import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService, EarningsSummary } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-summary-view-tab',
    imports: [CommonModule, FormsModule, DateRangeFilterComponent, PaginatedTableComponent, IconComponent, MatTooltipModule],
    templateUrl: './summary-view-tab.component.html',
    styleUrls: ['./summary-view-tab.component.scss']
})
export class SummaryViewTabComponent implements OnInit {
  loading: boolean = false;
  startDate: string = '';
  endDate: string = '';
  earningsSummary: EarningsSummary | null = null;

  // Earnings list state
  earnings: any[] = [];
  earningsPagination: PaginationInfo | null = null;
  earningsLoading: boolean = false;
  earningsFilters: SearchFilters = {};
  earningsSort: SortInfo | null = null;

  earningsColumns: TableColumn[] = [
    { key: 'date_recorded', label: 'Date', type: 'text', searchable: false, sortable: true, mobileClass: 'mobile-narrow' },
    { key: 'release_title', label: 'Release', type: 'text', searchable: true, sortable: false, renderHtml: true, formatter: (item: any) => this.formatReleaseCell(item) },
    { key: 'description', label: 'Description', type: 'text', searchable: true, sortable: false },
    { key: 'type', label: 'Type', type: 'text', searchable: true, sortable: true, mobileClass: 'mobile-hide' },
    { key: 'amount', label: 'Amount (₱)', type: 'number', searchable: false, sortable: true, align: 'right', formatter: (item: any) => this.formatCurrency(item.amount) }
  ];

  formatReleaseCell(item: any): any {
    const title = item.release_title || '(None)';
    const src = item.cover_art || this.coverArtPlaceholder;
    const html = `<span style="display:inline-flex;align-items:center;gap:8px"><img src="${src}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0">${title}</span>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  readonly coverArtPlaceholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#e5e7eb" rx="4"/><text x="20" y="28" font-size="18" text-anchor="middle" fill="#9ca3af">♪</text></svg>')}`;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadSummaryData();
  }

  private loadSummaryData(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.loading = true;

    this.adminService.getEarningsSummary(this.startDate, this.endDate).subscribe({
      next: (summary) => {
        this.earningsSummary = summary;
        this.loading = false;
        this.loadEarningsList();
      },
      error: (error) => {
        this.notificationService.showError('Error loading earnings summary');
        this.loading = false;
      }
    });
  }

  private loadEarningsList(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.earningsLoading = true;
    const page = this.earningsPagination?.current_page || 1;
    const limit = this.earningsPagination?.per_page || 10;
    const sortBy = this.earningsSort?.column;
    const sortDirection = this.earningsSort?.direction;

    this.adminService.getAdminEarningsList(this.startDate, this.endDate, page, limit, this.earningsFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.earnings = response.earnings;
        this.earningsPagination = response.pagination;
        this.earningsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading earnings list');
        this.earningsLoading = false;
      }
    });
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
    if (this.earningsPagination) {
      this.earningsPagination.current_page = 1;
    }
    this.loadSummaryData();
  }

  onEarningsPageChange(page: number): void {
    if (this.earningsPagination) {
      this.earningsPagination.current_page = page;
    }
    this.loadEarningsList();
  }

  onEarningsFiltersChange(filters: SearchFilters): void {
    this.earningsFilters = filters;
    if (this.earningsPagination) {
      this.earningsPagination.current_page = 1;
    }
    this.loadEarningsList();
  }

  onEarningsSortChange(sort: SortInfo | null): void {
    this.earningsSort = sort;
    this.loadEarningsList();
  }

  onRefresh(): void {
    this.loadSummaryData();
  }

  onExport(format: string): void {
    this.notificationService.showInfo(`Export as ${format.toUpperCase()} - Feature coming soon!`);
  }

  onComparisonToggle(enabled: boolean): void {
    if (enabled) {
      this.notificationService.showInfo('Comparison feature - Coming soon!');
    }
  }

  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}
