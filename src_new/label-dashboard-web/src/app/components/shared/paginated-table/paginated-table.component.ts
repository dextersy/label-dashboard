import { Component, Input, Output, EventEmitter, OnInit, TemplateRef, ContentChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface TableColumn {
  key: string;
  label: string;
  searchable?: boolean;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[]; // For select type
  formatter?: (item: any) => string; // Custom formatter function
}

export interface SearchFilters {
  [key: string]: string;
}

export interface SortInfo {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-paginated-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paginated-table.component.html',
  styleUrl: './paginated-table.component.scss'
})
export class PaginatedTableComponent implements OnInit {
  @Input() title: string = '';
  @Input() data: any[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() columns: TableColumn[] = [];
  @Input() showSearch: boolean = true;
  @Input() showSortableHeaders: boolean = false;
  @Input() sortInfo: SortInfo | null = null;
  @Input() showActionsColumn: boolean = false;
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<SortInfo | null>();

  @ContentChild('tableContent', { static: false }) tableContent!: TemplateRef<any>;
  @ContentChild('actionsContent', { static: false }) actionsContent!: TemplateRef<any>;

  searchFilters: SearchFilters = {};
  private searchTimeout: any;
  showSearchFilters: boolean = false;

  // Expose Math to template
  Math = Math;

  ngOnInit() {
    // Initialize search filters for searchable columns
    this.columns.forEach(column => {
      if (column.searchable !== false) {
        this.searchFilters[column.key] = '';
      }
    });
  }

  loadPage(page: number): void {
    this.pageChange.emit(page);
  }

  onFilterChange(columnKey: string, value: string): void {
    this.searchFilters[columnKey] = value;
    
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Debounce search to avoid too many API calls
    this.searchTimeout = setTimeout(() => {
      this.filtersChange.emit({ ...this.searchFilters });
    }, 500);
  }

  clearFilters(): void {
    this.searchFilters = {};
    this.columns.forEach(column => {
      if (column.searchable !== false) {
        this.searchFilters[column.key] = '';
      }
    });
    this.filtersChange.emit({ ...this.searchFilters });
  }

  hasActiveFilters(): boolean {
    return Object.values(this.searchFilters).some(value => value && value.trim() !== '');
  }

  toggleSearchFilters(): void {
    this.showSearchFilters = !this.showSearchFilters;
  }

  onSort(column: TableColumn): void {
    if (!column.sortable) return;

    let newSortInfo: SortInfo | null = null;
    
    // If already sorting by this column, cycle through: asc → desc → no sort
    if (this.sortInfo && this.sortInfo.column === column.key) {
      if (this.sortInfo.direction === 'asc') {
        newSortInfo = { column: column.key, direction: 'desc' };
      } else if (this.sortInfo.direction === 'desc') {
        // Remove sort (no sort state)
        newSortInfo = null;
      }
    } else {
      // For new column, start with ascending
      newSortInfo = { column: column.key, direction: 'asc' };
    }

    this.sortChange.emit(newSortInfo);
  }

  getSortIcon(column: TableColumn): string {
    if (!column.sortable) return '';
    
    if (!this.sortInfo || this.sortInfo.column !== column.key) {
      return 'fa-sort text-muted';
    }
    
    return this.sortInfo.direction === 'asc' ? 'fa-sort-up text-primary' : 'fa-sort-down text-primary';
  }

  getColumnValue(item: any, column: TableColumn): any {
    // Use custom formatter if provided
    if (column.formatter) {
      return column.formatter(item);
    }
    
    const value = item[column.key];
    
    if (value === null || value === undefined) {
      return '';
    }
    
    // Format based on column type and key
    switch (column.type) {
      case 'date':
        if (!value) return 'Never';
        const date = new Date(value);
        return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
      case 'number':
        // Special formatting for currency columns
        if (column.key === 'amount' || column.key === 'payment_processing_fee') {
          return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
          }).format(typeof value === 'number' ? value : parseFloat(value) || 0);
        }
        return typeof value === 'number' ? value.toLocaleString() : value.toString();
      default:
        // Special handling for boolean columns
        if (column.key === 'is_admin') {
          return value ? '✔️' : '';
        }
        return value.toString();
    }
  }

  getPageNumbers(): number[] {
    if (!this.pagination) return [];
    
    const pages: number[] = [];
    const totalPages = this.pagination.total_pages;
    const currentPage = this.pagination.current_page;
    
    // Show up to 5 pages around current page
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}