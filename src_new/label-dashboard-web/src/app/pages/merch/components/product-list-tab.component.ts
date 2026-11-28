import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { PaginatedTableComponent, TableColumn, TableAction, HeaderAction, PaginationInfo, SearchFilters } from '../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConfirmationService } from '../../../services/confirmation.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-product-list-tab',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent, IconComponent],
  templateUrl: './product-list-tab.component.html',
  styleUrl: './product-list-tab.component.scss',
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
      minWidth: '200px',
      formatter: (item: Product) => {
        const img = item.images?.[0]?.path;
        const imgHtml = img
          ? `<img src="${img}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
          : `<div style="width:40px;height:40px;border-radius:6px;background:#f3f4f6;flex-shrink:0;"></div>`;
        const skuHtml = item.sku
          ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px;font-family:monospace;">${item.sku}</div>`
          : '';
        const chipsHtml = item.categories?.length
          ? item.categories.map(c => `<span class="category-chip" style="margin-left:6px;">${c.name}</span>`).join('')
          : '';
        return this.sanitizer.bypassSecurityTrustHtml(
          `<div style="display:flex;align-items:center;gap:10px;">
            ${imgHtml}
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0;">
                <span style="font-weight:600;color:#111827;">${item.name}</span>${chipsHtml}
              </div>
              ${skuHtml}
            </div>
          </div>`
        );
      },
      renderHtml: true,
    },
    { key: 'sku', label: 'SKU', searchable: true, hidden: true },
    {
      key: 'linked_to',
      label: 'Linked To',
      renderHtml: true,
      formatter: (item: Product) => {
        const thumbUrl = item.release?.cover_art || item.artist?.profile_photo || null;
        const thumbHtml = thumbUrl
          ? `<img src="${thumbUrl}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0;">`
          : '';
        const parts: string[] = [];
        if (item.release?.title) parts.push(item.release.title);
        if (item.artist?.name) parts.push(item.artist.name);
        if (!parts.length) return '—';
        return this.sanitizer.bypassSecurityTrustHtml(
          `<div style="display:flex;align-items:center;gap:8px;">
            ${thumbHtml}
            <span>${parts.join(' · ')}</span>
          </div>`
        );
      }
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      formatter: (item: Product) => item.price != null ? `₱${item.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'
    },
    {
      key: 'status',
      label: 'Status',
      formatter: (item: Product) => item.status === 'active'
        ? `<span class="status-badge status-success">Active</span>`
        : `<span class="status-badge status-secondary">Inactive</span>`,
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

  isAdmin = false;

  constructor(
    private productService: ProductService,
    public router: Router,
    private sanitizer: DomSanitizer,
    private confirmationService: ConfirmationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.actions = this.isAdmin ? [
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
    ] : [
      {
        icon: 'eye',
        label: 'View',
        handler: (item: Product) => this.router.navigate(['/merch/products', item.id]),
        primary: true,
      }
    ];
    this.headerActions = this.isAdmin ? [
      {
        icon: 'plus',
        label: 'New Product',
        type: 'primary',
        handler: () => this.router.navigate(['/merch/products/new']),
      }
    ] : [];
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

  async deleteProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Product',
      message: `Delete "${product.name}"?`,
      warning: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    this.productService.deleteProduct(product.id).subscribe({
      next: () => this.loadProducts()
    });
  }
}
