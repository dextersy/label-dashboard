import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EarningsTableComponent } from '../earnings-table/earnings-table.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';
import { DateRangeFilterComponent, DateRangeSelection } from '../../shared/date-range-filter/date-range-filter.component';
import { Earning } from '../../../pages/financial/financial.component';
import { AuthService } from '../../../services/auth.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { ArtistStateService } from '../../../services/artist-state.service';

@Component({
  selector: 'app-financial-earnings-tab',
  standalone: true,
  imports: [CommonModule, EarningsTableComponent, PaginatedTableComponent, DateRangeFilterComponent],
  templateUrl: './financial-earnings-tab.component.html',
  styleUrl: './financial-earnings-tab.component.scss'
})
export class FinancialEarningsTabComponent {
  @Input() earnings: Earning[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() earningsSort: SortInfo | null = null;
  @Input() currentFilters: SearchFilters = {};
  @Input() currentDateRange: DateRangeSelection | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<SortInfo | null>();
  @Output() dateRangeChange = new EventEmitter<DateRangeSelection>();
  @Output() refresh = new EventEmitter<void>();

  isAdmin = false;
  selectedArtist: any = null;
  downloadingCSV = false;

  constructor(
    private router: Router, 
    private authService: AuthService,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.isAdmin = user ? user.is_admin : false;
    });

    // Subscribe to selected artist changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
    });
  }

  // Define table columns for search and sort functionality
  earningsColumns: TableColumn[] = [
    { 
      key: 'date_recorded', 
      label: 'Date', 
      type: 'date', 
      searchable: false, 
      sortable: true,
      mobileClass: 'mobile-narrow',
      tabletClass: ''
    },
    { 
      key: 'release_title', 
      label: 'Release', 
      type: 'text', 
      searchable: true, 
      sortable: true,
      mobileClass: 'mobile-text',
      tabletClass: ''
    },
    { 
      key: 'description', 
      label: 'Description', 
      type: 'text', 
      searchable: true, 
      sortable: true,
      mobileClass: '',
      tabletClass: 'tablet-hide'
    },
    { 
      key: 'amount', 
      label: 'Amount', 
      type: 'number', 
      searchable: true, 
      sortable: true, 
      align: 'right',
      mobileClass: 'mobile-narrow mobile-number',
      tabletClass: ''
    }
  ];

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.dateRangeChange.emit(dateRange);
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  navigateToNewEarning(): void {
    this.router.navigate(['/financial/earnings/new']);
  }

  async downloadCSV(): Promise<void> {
    if (!this.selectedArtist || this.downloadingCSV) return;

    this.downloadingCSV = true;
    try {
      await this.financialService.downloadEarningsCSV(
        this.selectedArtist.id,
        this.currentFilters,
        this.earningsSort?.column,
        this.earningsSort?.direction,
        this.currentDateRange?.startDate,
        this.currentDateRange?.endDate
      );
      this.notificationService.showSuccess('Earnings CSV downloaded successfully');
    } catch (error) {
      console.error('Error downloading earnings CSV:', error);
      this.notificationService.showError('Failed to download earnings CSV');
    } finally {
      this.downloadingCSV = false;
    }
  }
}