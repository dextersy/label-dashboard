import { Component, Input, Output, EventEmitter, OnInit, TemplateRef, ContentChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}

@Component({
  selector: 'app-paginated-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paginated-table.component.html',
  styleUrl: './paginated-table.component.scss'
})
export class PaginatedTableComponent implements OnInit {
  @Input() title: string = '';
  @Input() data: any[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Output() pageChange = new EventEmitter<number>();

  @ContentChild('tableContent', { static: false }) tableContent!: TemplateRef<any>;

  // Expose Math to template
  Math = Math;

  ngOnInit() {
    // Initial load is handled by parent component
  }

  loadPage(page: number): void {
    this.pageChange.emit(page);
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