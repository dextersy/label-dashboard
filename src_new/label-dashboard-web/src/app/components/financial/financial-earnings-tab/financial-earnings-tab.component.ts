import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarningsTableComponent } from '../earnings-table/earnings-table.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';
import { Earning } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-earnings-tab',
  standalone: true,
  imports: [CommonModule, EarningsTableComponent, PaginatedTableComponent],
  templateUrl: './financial-earnings-tab.component.html',
  styleUrl: './financial-earnings-tab.component.scss'
})
export class FinancialEarningsTabComponent {
  @Input() earnings: Earning[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() earningsSort: SortInfo | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<SortInfo | null>();

  // Define table columns for search and sort functionality
  earningsColumns: TableColumn[] = [
    { key: 'date_recorded', label: 'Date Recorded', type: 'date', searchable: true, sortable: true },
    { key: 'release_title', label: 'For Release', type: 'text', searchable: true, sortable: true },
    { key: 'description', label: 'Description', type: 'text', searchable: true, sortable: true },
    { key: 'amount', label: 'Amount', type: 'number', searchable: true, sortable: true }
  ];

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }
}