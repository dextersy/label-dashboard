import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { PaginatedTableComponent, TableColumn, TableAction, HeaderAction, PaginationInfo, SearchFilters } from '../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-product-list-tab',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent, IconComponent],
  template: `
    <div class="container-fluid tw-py-4">
      <div class="sm:tw-bg-white sm:tw-rounded-card sm:tw-shadow-card sm:tw-overflow-hidden tw-mb-6">
        <div class="sm:tw-px-card-pad sm:tw-pt-card-pad sm:tw-pb-4">
          <h3 class="tw-mb-2">
            <app-icon name="shopping-bag" class="tw-mr-2" />
            Products
          </h3>
          <p class="tw-mb-0 tw-text-muted">Manage your merchandise products.</p>
        </div>
      </div>

      <app-paginated-table
        title="Products"
        [data]="products"
        [pagination]="pagination"
        [loading]="loading"
        [columns]="columns"
        [showSearch]="true"
        [actions]="actions"
        [headerActions]="headerActions"
        (pageChange)="onPageChange($event)"
        (filtersChange)="onFiltersChange($event)"
      />
    </div>
  `
})
export class ProductListTabComponent implements OnInit {
  products: Product[] = [];
  loading = true;
  currentPage = 1;
  searchQuery = '';

  pagination: PaginationInfo = {
    current_page: 1,
    total_pages: 0,
    total_count: 0,
    per_page: 25,
    has_next: false,
    has_prev: false
  };

  columns: TableColumn[] = [
    {
      key: 'name',
      label: 'Product',
      searchable: true,
      sortable: true,
      cardHeader: true,
      formatter: (item: Product) => {
        const img = item.images?.[0]?.path;
        const imgHtml = img
          ? `<img src="${img}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;">`
          : '';
        return this.sanitizer.bypassSecurityTrustHtml(`${imgHtml}<span>${item.name}</span>`);
      },
      renderHtml: true,
    },
    { key: 'sku', label: 'SKU', searchable: true },
    {
      key: 'release_title',
      label: 'Release',
      formatter: (item: Product) => item.release?.title || '—'
    },
    {
      key: 'artist_name',
      label: 'Artist',
      formatter: (item: Product) => item.artist?.name || '—'
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      formatter: (item: Product) => item.price != null ? `${item.price.toFixed(2)}` : '—'
    },
    {
      key: 'status',
      label: 'Status',
      formatter: (item: Product) => {
        const color = item.status === 'active' ? '#16a34a' : '#9ca3af';
        return this.sanitizer.bypassSecurityTrustHtml(
          `<span style="color:${color};font-weight:500;text-transform:capitalize">${item.status}</span>`
        );
      },
      renderHtml: true,
    }
  ];

  actions: TableAction[] = [
    {
      icon: 'eye',
      label: 'View',
      handler: (item: Product) => this.router.navigate(['/merch/products', item.id]),
      primary: true,
    },
    {
      icon: 'pencil',
      label: 'Edit',
      handler: (item: Product) => this.router.navigate(['/merch/products', item.id, 'edit']),
    },
    {
      icon: 'trash',
      label: 'Delete',
      type: 'danger',
      handler: (item: Product) => this.deleteProduct(item),
    }
  ];

  headerActions: HeaderAction[] = [
    {
      icon: 'plus',
      label: 'New Product',
      type: 'primary',
      handler: () => this.router.navigate(['/merch/products/new']),
    }
  ];

  constructor(
    private productService: ProductService,
    private router: Router,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts({
      page: this.currentPage,
      limit: 25,
      search: this.searchQuery,
    }).subscribe({
      next: (res) => {
        this.products = res.products;
        this.pagination = {
          current_page: this.currentPage,
          total_pages: Math.ceil(res.total / 25),
          total_count: res.total,
          per_page: 25,
          has_next: this.currentPage < Math.ceil(res.total / 25),
          has_prev: this.currentPage > 1,
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProducts();
  }

  onFiltersChange(filters: SearchFilters): void {
    this.searchQuery = filters['name'] || '';
    this.currentPage = 1;
    this.loadProducts();
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete "${product.name}"?`)) return;
    this.productService.deleteProduct(product.id).subscribe({
      next: () => this.loadProducts()
    });
  }
}
