import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-payments-royalties-tab',
  standalone: true,
  imports: [CommonModule, DateRangeFilterComponent, PaginatedTableComponent],
  templateUrl: './payments-royalties-tab.component.html',
  styleUrls: ['./payments-royalties-tab.component.scss']
})
export class PaymentsRoyaltiesTabComponent implements OnInit {
  loading: boolean = false;
  startDate: string = '';
  endDate: string = '';

  artists: any[] = [];
  artistsPagination: PaginationInfo | null = null;
  artistsLoading: boolean = false;
  artistsFilters: SearchFilters = {};
  artistsSort: SortInfo | null = null;

  overallTotalPayments: number = 0;
  overallTotalRoyalties: number = 0;

  artistColumns: TableColumn[] = [
    { key: 'artist_name', label: 'Artist', type: 'text', searchable: true, sortable: true },
    { key: 'total_payments', label: 'Payments (₱)', type: 'number', searchable: false, sortable: true, align: 'right', formatter: (item) => this.formatCurrency(item.total_payments) },
    { key: 'total_royalties', label: 'Royalties (₱)', type: 'number', searchable: false, sortable: true, align: 'right', formatter: (item) => this.formatCurrency(item.total_royalties) }
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {}

  private loadData(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.artistsLoading = true;

    const page = this.artistsPagination?.current_page || 1;
    const limit = this.artistsPagination?.per_page || 10;
    const sortBy = this.artistsSort?.column;
    const sortDirection = this.artistsSort?.direction;

    this.adminService.getAdminPaymentsRoyaltiesArtists(this.startDate, this.endDate, page, limit, this.artistsFilters, sortBy, sortDirection).subscribe({
      next: (response) => {
        this.artists = response.artists;
        this.artistsPagination = response.pagination;
        this.overallTotalPayments = response.overall_total_payments;
        this.overallTotalRoyalties = response.overall_total_royalties;
        this.loading = false;
        this.artistsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading payments and royalties');
        this.loading = false;
        this.artistsLoading = false;
      }
    });
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
    this.loading = true;
    if (this.artistsPagination) {
      this.artistsPagination.current_page = 1;
    }
    this.loadData();
  }

  onArtistsPageChange(page: number): void {
    if (this.artistsPagination) {
      this.artistsPagination.current_page = page;
    }
    this.loadData();
  }

  onArtistsFiltersChange(filters: SearchFilters): void {
    this.artistsFilters = filters;
    if (this.artistsPagination) {
      this.artistsPagination.current_page = 1;
    }
    this.loadData();
  }

  onArtistsSortChange(sort: SortInfo | null): void {
    this.artistsSort = sort;
    this.loadData();
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
