import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-product-detail-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  template: `
    <div class="container-fluid tw-py-4">
      @if (loading) {
        <div class="tw-text-center tw-py-8">
          <app-icon name="spinner" class="tw-animate-spin" /> Loading...
        </div>
      } @else if (product) {
        <!-- Product Info Card -->
        <div class="tw-bg-white tw-rounded-card tw-shadow-card tw-p-card-pad tw-mb-6">
          <div class="tw-flex tw-justify-between tw-items-start tw-mb-4">
            <div>
              <h3 class="tw-mb-1">{{ product.name }}</h3>
              @if (product.sku) {
                <span class="tw-text-muted tw-text-sm">SKU: {{ product.sku }}</span>
              }
            </div>
            <div class="tw-flex tw-gap-2">
              <button class="btn btn-sm btn-outline-secondary" [routerLink]="['/merch/products', product.id, 'edit']">
                <app-icon name="pencil" class="tw-mr-1" /> Edit
              </button>
            </div>
          </div>

          @if (product.description) {
            <p class="tw-text-muted tw-mb-3">{{ product.description }}</p>
          }

          <div class="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-4 tw-text-sm">
            <div>
              <span class="tw-text-muted tw-block">Price</span>
              <strong>{{ product.price != null ? product.price.toFixed(2) : '—' }}</strong>
            </div>
            <div>
              <span class="tw-text-muted tw-block">Status</span>
              <strong class="tw-capitalize">{{ product.status }}</strong>
            </div>
            <div>
              <span class="tw-text-muted tw-block">Release</span>
              <strong>{{ product.release?.title || '—' }}</strong>
            </div>
            <div>
              <span class="tw-text-muted tw-block">Artist</span>
              <strong>{{ product.artist?.name || '—' }}</strong>
            </div>
          </div>
        </div>

        <!-- Image Gallery -->
        @if (product.images && product.images.length > 0) {
          <div class="tw-bg-white tw-rounded-card tw-shadow-card tw-p-card-pad tw-mb-6">
            <h5 class="tw-mb-3">Images</h5>
            <div class="tw-flex tw-flex-wrap tw-gap-3">
              @for (img of product.images; track img.id) {
                <img [src]="img.path" class="tw-w-24 tw-h-24 tw-object-cover tw-rounded" />
              }
            </div>
          </div>
        }

        <!-- Artist Splits -->
        @if (product.productArtists && product.productArtists.length > 0) {
          <div class="tw-bg-white tw-rounded-card tw-shadow-card tw-p-card-pad tw-mb-6">
            <h5 class="tw-mb-3">Artist Splits</h5>
            <table class="table table-sm tw-mb-0">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Royalty %</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                @for (pa of product.productArtists; track pa.artist_id) {
                  <tr>
                    <td>{{ pa.artist?.name || 'Unknown' }}</td>
                    <td>{{ (pa.merch_royalty_percentage * 100).toFixed(1) }}%</td>
                    <td>{{ pa.merch_royalty_type }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <div class="tw-text-center tw-py-8 tw-text-muted">Product not found.</div>
      }
    </div>
  `
})
export class ProductDetailTabComponent implements OnInit {
  product: Product | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.productService.getProduct(parseInt(id, 10)).subscribe({
        next: (product) => {
          this.product = product;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }
}
