import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit, ProductImage } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, FloatingActionBarComponent],
  template: `
    <div class="container-fluid tw-py-4">
      <div class="tw-bg-white tw-rounded-card tw-shadow-card tw-p-card-pad tw-mb-6">
        <h3 class="tw-mb-4">{{ isEdit ? 'Edit Product' : 'New Product' }}</h3>

        <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
          <div class="form-group">
            <label class="form-label">Product Name <span class="tw-text-red-500">*</span></label>
            <input type="text" class="form-control" [(ngModel)]="form.name" placeholder="e.g. Band T-Shirt">
          </div>

          <div class="form-group">
            <label class="form-label">SKU</label>
            <input type="text" class="form-control" [(ngModel)]="form.sku" placeholder="e.g. MERCH-001">
          </div>

          <div class="form-group">
            <label class="form-label">Price</label>
            <input type="number" class="form-control" [(ngModel)]="form.price" step="0.01" min="0" placeholder="0.00">
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" [(ngModel)]="form.status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div class="form-group md:tw-col-span-2">
            <label class="form-label">Description</label>
            <textarea class="form-control" [(ngModel)]="form.description" rows="3" placeholder="Product description..."></textarea>
          </div>
        </div>

        <!-- Images -->
        @if (isEdit) {
          <hr class="tw-my-4">
          <h5 class="tw-mb-3">Images</h5>
          <div class="tw-flex tw-flex-wrap tw-gap-3 tw-mb-3">
            @for (img of images; track img.id) {
              <div class="tw-relative tw-group">
                <img [src]="img.path" class="tw-w-24 tw-h-24 tw-object-cover tw-rounded">
                <button
                  class="tw-absolute tw-top-1 tw-right-1 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-flex tw-items-center tw-justify-center tw-text-xs tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity"
                  (click)="deleteImage(img)">×</button>
              </div>
            }
          </div>
          <input type="file" accept="image/*" (change)="onFileSelected($event)" class="form-control tw-max-w-xs">
        }

        <!-- Artist Splits -->
        @if (isEdit) {
          <hr class="tw-my-4">
          <h5 class="tw-mb-3">Artist Splits</h5>
          @for (split of artistSplits; track split.artist_id; let i = $index) {
            <div class="tw-flex tw-items-center tw-gap-3 tw-mb-2">
              <span class="tw-flex-1">{{ split.artist?.name || 'Artist #' + split.artist_id }}</span>
              <input type="number" class="form-control tw-w-24" [(ngModel)]="split.merch_royalty_percentage" step="0.001" min="0" max="1">
              <select class="form-select tw-w-32" [(ngModel)]="split.merch_royalty_type">
                <option value="Revenue">Revenue</option>
                <option value="Profit">Profit</option>
              </select>
              <button class="btn btn-sm btn-outline-danger" (click)="removeSplit(i)">
                <app-icon name="trash" />
              </button>
            </div>
          }
          <button class="btn btn-sm btn-outline-secondary tw-mt-2" (click)="saveSplits()">
            <app-icon name="check" class="tw-mr-1" /> Save Splits
          </button>
        }
      </div>

      <app-floating-action-bar>
        <button class="btn-secondary" (click)="cancel()">Cancel</button>
        <button class="btn-primary fab-primary-btn" [disabled]="!form.name || saving" (click)="save()">
          {{ isEdit ? 'Save Changes' : 'Create Product' }}
        </button>
      </app-floating-action-bar>
    </div>
  `
})
export class ProductFormComponent implements OnInit {
  isEdit = false;
  productId: number | null = null;
  form: Partial<Product> = {
    name: '',
    sku: '',
    description: '',
    price: null,
    status: 'active',
    release_id: null,
    artist_id: null,
  };
  images: ProductImage[] = [];
  artistSplits: ProductArtistSplit[] = [];
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.productId = parseInt(id, 10);
      this.productService.getProduct(this.productId).subscribe({
        next: (product) => {
          this.form = {
            name: product.name,
            sku: product.sku,
            description: product.description,
            price: product.price,
            status: product.status,
            release_id: product.release_id,
            artist_id: product.artist_id,
          };
          this.images = product.images || [];
          this.artistSplits = product.productArtists || [];
        }
      });
    }
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    const obs = this.isEdit && this.productId
      ? this.productService.updateProduct(this.productId, this.form)
      : this.productService.createProduct(this.form);

    obs.subscribe({
      next: (product) => {
        this.saving = false;
        this.router.navigate(['/merch/products', product.id]);
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  cancel(): void {
    if (this.isEdit && this.productId) {
      this.router.navigate(['/merch/products', this.productId]);
    } else {
      this.router.navigate(['/merch/products']);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.productId) return;
    this.productService.uploadImage(this.productId, input.files[0]).subscribe({
      next: (img) => {
        this.images.push(img);
        input.value = '';
      }
    });
  }

  deleteImage(img: ProductImage): void {
    if (!this.productId) return;
    this.productService.deleteImage(this.productId, img.id).subscribe({
      next: () => {
        this.images = this.images.filter(i => i.id !== img.id);
      }
    });
  }

  removeSplit(index: number): void {
    this.artistSplits.splice(index, 1);
  }

  saveSplits(): void {
    if (!this.productId) return;
    this.productService.setProductArtists(
      this.productId,
      this.artistSplits.map(s => ({
        artist_id: s.artist_id,
        merch_royalty_percentage: s.merch_royalty_percentage,
        merch_royalty_type: s.merch_royalty_type,
      }))
    ).subscribe({
      next: (splits) => {
        this.artistSplits = splits;
      }
    });
  }
}
