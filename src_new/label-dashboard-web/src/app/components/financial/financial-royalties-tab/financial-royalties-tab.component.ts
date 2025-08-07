import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RoyaltiesTableComponent } from '../royalties-table/royalties-table.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';
import { DateRangeFilterComponent, DateRangeSelection } from '../../shared/date-range-filter/date-range-filter.component';
import { Royalty } from '../../../pages/financial/financial.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-financial-royalties-tab',
  standalone: true,
  imports: [CommonModule, RoyaltiesTableComponent, PaginatedTableComponent, DateRangeFilterComponent],
  templateUrl: './financial-royalties-tab.component.html',
  styleUrl: './financial-royalties-tab.component.scss'
})
export class FinancialRoyaltiesTabComponent {
  @Input() royalties: Royalty[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() royaltiesSort: SortInfo | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<SortInfo | null>();
  @Output() dateRangeChange = new EventEmitter<DateRangeSelection>();
  @Output() refresh = new EventEmitter<void>();

  isAdmin = false;

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.isAdmin = user ? user.is_admin : false;
    });
  }

  // Define table columns for search and sort functionality
  royaltiesColumns: TableColumn[] = [
    { key: 'date_recorded', label: 'Date Recorded', type: 'date', searchable: false, sortable: true },
    { key: 'release_title', label: 'For Release', type: 'text', searchable: true, sortable: true },
    { key: 'description', label: 'Description', type: 'text', searchable: true, sortable: true },
    { key: 'amount', label: 'Amount', type: 'number', searchable: true, sortable: true }
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

  navigateToNewRoyalty(): void {
    this.router.navigate(['/financial/royalties/new']);
  }
}