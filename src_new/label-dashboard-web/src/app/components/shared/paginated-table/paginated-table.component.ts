import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, TemplateRef, ContentChild, HostListener } from '@angular/core';
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

export interface TableAction {
  icon: string;                          // Full FA class e.g. 'fa-solid fa-trash'
  label: string;
  handler: (item: any) => void;
  type?: 'primary' | 'secondary' | 'danger';
  hidden?: (item: any) => boolean;       // Return true to hide for a given row
}

export interface HeaderAction {
  icon: string | (() => string);         // FA class, or function for dynamic icons (e.g. spinner)
  label: string | (() => string);        // Button label, or function for dynamic text
  handler: () => void;
  type?: 'primary' | 'secondary' | 'danger';
  disabled?: () => boolean;
  hidden?: () => boolean;
  title?: string | (() => string);
}

export interface TableColumn {
  key: string;
  label: string;
  searchable?: boolean;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[]; // For select type
  formatter?: (item: any) => string; // Custom formatter function
  align?: 'left' | 'center' | 'right'; // Column alignment
  mobileClass?: string; // CSS classes for mobile responsiveness
  tabletClass?: string; // CSS classes for tablet responsiveness
  showBreakdownButton?: boolean; // Show breakdown button for earnings columns
  renderHtml?: boolean; // Render formatter output as HTML instead of text
  cardHeader?: boolean; // Use this column as the card title in mobile view
  hideDataLabel?: boolean; // Hide the data-label prefix in mobile card view
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
    imports: [CommonModule, FormsModule],
    templateUrl: './paginated-table.component.html',
    styleUrl: './paginated-table.component.scss'
})
export class PaginatedTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() title: string = '';
  @Input() data: any[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Input() columns: TableColumn[] = [];
  @Input() showSearch: boolean = true;
  @Input() showSortableHeaders: boolean = false;
  @Input() sortInfo: SortInfo | null = null;
  @Input() showActionsColumn: boolean = false;
  @Input() actions: TableAction[] = [];  // Structured actions rendered as a list in the kebab menu
  @Input() responsiveMode: 'card' | 'financial' = 'card'; // Choose responsive behavior
  @Input() enableBulkOperations: boolean = false; // Enable bulk operations functionality
  @Input() bulkOperationsLoading: boolean = false; // Loading state for all operations (single and bulk)
  @Input() rowClassGetter?: (item: any) => string; // Function to get CSS classes for each row
  @Input() headerActions: HeaderAction[] = []; // Action buttons rendered above the table
  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() sortChange = new EventEmitter<SortInfo | null>();
  @Output() selectedItemsChange = new EventEmitter<any[]>(); // Emit selected items for bulk operations
  @Output() breakdownButtonClick = new EventEmitter<{item: any, columnKey: string}>();

  @ContentChild('tableContent', { static: false }) tableContent!: TemplateRef<any>;
  @ContentChild('actionsContent', { static: false }) actionsContent!: TemplateRef<any>;
  @ContentChild('customButtons', { static: false }) customButtons!: TemplateRef<any>;
  @ContentChild('bulkOperationsContent', { static: false }) bulkOperationsContent!: TemplateRef<any>;

  searchFilters: SearchFilters = {};
  private searchTimeout: any;
  showSearchFilters: boolean = false;
  
  // Bulk operations state
  selectedItems: Set<any> = new Set();
  selectAllChecked: boolean = false;
  selectAllIndeterminate: boolean = false;

  // Expose Math to template
  Math = Math;

  // Kebab menu state
  openKebabItem: any = null;
  dropdownPosition: { top: number; right: number } | null = null;

  // Mobile actions dropdown state
  mobileActionsOpen: boolean = false;
  mobileActionsPosition: { top: number; right: number } | null = null;

  // Close dropdown on any scroll (capture phase catches scrolling within nested containers too)
  private readonly scrollCloseHandler = () => this.closeAllKebabs();

  @HostListener('document:click')
  closeAllKebabs(): void {
    this.openKebabItem = null;
    this.dropdownPosition = null;
    this.mobileActionsOpen = false;
    this.mobileActionsPosition = null;
  }

  toggleMobileActions(event: Event): void {
    event.stopPropagation();
    if (this.mobileActionsOpen) {
      this.mobileActionsOpen = false;
      this.mobileActionsPosition = null;
    } else {
      const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.mobileActionsOpen = true;
      this.mobileActionsPosition = {
        top: rect.bottom + 2,
        right: document.documentElement.clientWidth - rect.right
      };
    }
  }

  toggleKebab(item: any, event: Event): void {
    event.stopPropagation();
    if (this.openKebabItem === item) {
      this.openKebabItem = null;
      this.dropdownPosition = null;
    } else {
      const btn = (event.target as HTMLElement).closest('.kebab-btn') as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.openKebabItem = item;
      this.dropdownPosition = {
        top: rect.bottom + 2,
        right: document.documentElement.clientWidth - rect.right
      };
    }
  }

  isKebabOpen(item: any): boolean {
    return this.openKebabItem === item;
  }

  resolveHeaderActionIcon(action: HeaderAction): string {
    return typeof action.icon === 'function' ? action.icon() : action.icon;
  }

  resolveHeaderActionLabel(action: HeaderAction): string {
    return typeof action.label === 'function' ? action.label() : action.label;
  }

  resolveHeaderActionTitle(action: HeaderAction): string {
    if (!action.title) return this.resolveHeaderActionLabel(action);
    return typeof action.title === 'function' ? action.title() : action.title;
  }

  isHeaderActionHidden(action: HeaderAction): boolean {
    return action.hidden ? action.hidden() : false;
  }

  isHeaderActionDisabled(action: HeaderAction): boolean {
    return action.disabled ? action.disabled() : false;
  }

  hasActionsColumn(): boolean {
    return this.showActionsColumn || this.actions.length > 0;
  }

  getVisibleActions(item: any): TableAction[] {
    return this.actions.filter(a => !a.hidden || !a.hidden(item));
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.scrollCloseHandler, true);
  }

  ngOnInit() {
    document.addEventListener('scroll', this.scrollCloseHandler, true);
    // Initialize search filters for searchable columns
    this.columns.forEach(column => {
      if (column.searchable !== false) {
        this.searchFilters[column.key] = '';
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Clear selection when data changes (e.g., after refresh, filter, or bulk operations)
    if (changes['data'] && !changes['data'].firstChange) {
      this.clearSelection();
    }
  }
  
  // Bulk operations methods
  onSelectAll(checked: boolean): void {
    if (checked) {
      this.data.forEach(item => this.selectedItems.add(item));
    } else {
      this.selectedItems.clear();
    }
    this.updateSelectAllState();
    this.selectedItemsChange.emit(Array.from(this.selectedItems));
  }
  
  onSelectItem(item: any, checked: boolean): void {
    if (checked) {
      this.selectedItems.add(item);
    } else {
      this.selectedItems.delete(item);
    }
    this.updateSelectAllState();
    this.selectedItemsChange.emit(Array.from(this.selectedItems));
  }
  
  isItemSelected(item: any): boolean {
    return this.selectedItems.has(item);
  }
  
  private updateSelectAllState(): void {
    const selectedCount = this.selectedItems.size;
    const totalCount = this.data.length;
    
    this.selectAllChecked = selectedCount === totalCount && totalCount > 0;
    this.selectAllIndeterminate = selectedCount > 0 && selectedCount < totalCount;
  }
  
  getSelectedCount(): number {
    return this.selectedItems.size;
  }
  
  clearSelection(): void {
    this.selectedItems.clear();
    this.updateSelectAllState();
    this.selectedItemsChange.emit([]);
  }
  
  isAnyOperationLoading(): boolean {
    return this.bulkOperationsLoading || this.loading;
  }
  
  getSelectedItemsArray(): any[] {
    return Array.from(this.selectedItems);
  }
  
  isOperationsDisabled(): boolean {
    return this.isAnyOperationLoading();
  }

  loadPage(page: number): void {
    // Clear selection when changing pages
    this.clearSelection();
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
      this.clearSelection();
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
    this.clearSelection();
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

    this.clearSelection();
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
        // For financial responsive mode, show only date without time
        if (this.responsiveMode === 'financial') {
          return date.toLocaleDateString('en-US');
        }
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

  getTableClasses(): string {
    const baseClass = 'table';
    if (this.responsiveMode === 'financial') {
      return `${baseClass} table-financial`;
    }
    return baseClass;
  }

  getColumnClasses(column: TableColumn): string {
    const classes: string[] = [];
    
    if (column.mobileClass) {
      classes.push(column.mobileClass);
    }
    
    if (column.tabletClass) {
      classes.push(column.tabletClass);
    }
    
    return classes.join(' ');
  }

  onBreakdownButtonClick(item: any, columnKey: string): void {
    this.breakdownButtonClick.emit({ item, columnKey });
  }

  getAmountClass(value: any): string {
    if (value === undefined || value === null) return '';
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    return !isNaN(numValue) && numValue < 0 ? 'text-danger' : '';
  }
}