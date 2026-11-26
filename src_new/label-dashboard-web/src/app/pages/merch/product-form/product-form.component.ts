import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit, ProductImage } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';
import { ApiService } from '../../../services/api.service';
import { ReleaseService, Release } from '../../../services/release.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, FloatingActionBarComponent],
  styles: [`
    .sub-tab-toggle {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: #f1f3f5;
      border-radius: 10px;
      padding: 4px;
      border: 1px solid #e9ecef;
    }
    .sub-tab-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 8px 20px;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: #6c757d;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .sub-tab-btn:hover:not(.sub-tab-btn-active) {
      background: rgba(0,0,0,0.05);
      color: #343a40;
    }
    .sub-tab-btn:focus-visible {
      outline: 2px solid var(--brand-color, #3b82f6);
      outline-offset: 2px;
    }
    .sub-tab-btn-active {
      background: #fff;
      color: var(--brand-color, #3b82f6);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04);
    }
    .link-search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .link-search-icon {
      position: absolute;
      left: 9px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      font-size: 13px;
      pointer-events: none;
      z-index: 1;
    }
    .link-search-input {
      padding-left: 30px !important;
    }
    .link-dropdown {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      z-index: 1060;
      max-height: 220px;
      overflow-y: auto;
    }
    .link-option {
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #f1f3f5;
      transition: background-color 0.1s;
      font-size: 13px;
    }
    .link-option:last-child { border-bottom: none; }
    .link-option:hover { background-color: #f8f9fa; }
    .link-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      padding: 8px 10px 8px 8px;
      max-width: 400px;
    }
    .link-chip-img {
      width: 40px;
      height: 40px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .link-chip-img-artist {
      border-radius: 50%;
    }
    .link-chip-img-release {
      border-radius: 4px;
    }
    .link-chip-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--brand-color, #3b82f6);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .link-chip-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .link-chip-name {
      font-size: 13.5px;
      font-weight: 600;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .link-chip-sub {
      font-size: 11.5px;
      color: #9ca3af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .link-chip-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: #e5e7eb;
      color: #6b7280;
      font-size: 14px;
      cursor: pointer;
      flex-shrink: 0;
      margin-left: 2px;
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }
    .link-chip-clear:hover {
      background: #fee2e2;
      color: #ef4444;
    }
  `],
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

          <!-- Link to -->
          <div class="form-group md:tw-col-span-2">
            <label class="form-label">Link to</label>
            @if (!selectedArtist && !selectedRelease) {
              <div class="sub-tab-toggle tw-mb-3" role="group" aria-label="Link type">
                <button type="button" class="sub-tab-btn" [class.sub-tab-btn-active]="linkType === 'none'" (click)="setLinkType('none')">None</button>
                <button type="button" class="sub-tab-btn" [class.sub-tab-btn-active]="linkType === 'artist'" (click)="setLinkType('artist')">Artist</button>
                <button type="button" class="sub-tab-btn" [class.sub-tab-btn-active]="linkType === 'release'" (click)="setLinkType('release')">Release</button>
              </div>
            }

            @if (linkType === 'artist') {
              @if (selectedArtist) {
                <!-- Artist chip -->
                <div class="link-chip">
                  @if (getArtistPhotoUrl(selectedArtist)) {
                    <img [src]="getArtistPhotoUrl(selectedArtist)" class="link-chip-img link-chip-img-artist" alt="">
                  } @else {
                    <div class="link-chip-avatar">{{ selectedArtist.name?.charAt(0) }}</div>
                  }
                  <div class="link-chip-info">
                    <span class="link-chip-name">{{ selectedArtist.name }}</span>
                    <span class="link-chip-sub">Artist</span>
                  </div>
                  <button type="button" class="link-chip-clear" (click)="clearLink()" title="Remove link">×</button>
                </div>
              } @else {
                <!-- Artist search -->
                <div class="tw-relative">
                  <div class="link-search-wrap">
                    <app-icon name="search" class="link-search-icon" iconOnly />
                    <input type="text"
                           class="form-control link-search-input"
                           [(ngModel)]="linkSearchTerm"
                           (ngModelChange)="onLinkSearch()"
                           (focus)="onLinkSearch()"
                           (blur)="onLinkBlur()"
                           placeholder="Search artists..."
                           autocomplete="off">
                  </div>
                  @if (showLinkDropdown && filteredArtists.length > 0) {
                    <div class="link-dropdown">
                      @for (artist of filteredArtists; track artist.id) {
                        <div class="link-option tw-flex tw-items-center tw-gap-2"
                             (mousedown)="selectArtist(artist)">
                          @if (getArtistPhotoUrl(artist)) {
                            <img [src]="getArtistPhotoUrl(artist)" class="tw-w-7 tw-h-7 tw-rounded-full tw-object-cover tw-flex-shrink-0" alt="">
                          } @else {
                            <div class="tw-w-7 tw-h-7 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-xs tw-font-semibold tw-flex-shrink-0"
                                 style="background: var(--brand-color, #3b82f6); color: #fff;">
                              {{ artist.name?.charAt(0) }}
                            </div>
                          }
                          <span>{{ artist.name }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (!linkDataLoaded && linkSearchTerm === '') {
                    <div class="tw-text-sm tw-text-muted tw-mt-1">Loading artists…</div>
                  }
                </div>
              }
            }

            @if (linkType === 'release') {
              @if (selectedRelease) {
                <!-- Release chip -->
                <div class="link-chip">
                  @if (selectedRelease.cover_art) {
                    <img [src]="selectedRelease.cover_art" class="link-chip-img link-chip-img-release" alt="">
                  } @else {
                    <div class="link-chip-avatar" style="border-radius: 4px;">
                      <app-icon name="music" />
                    </div>
                  }
                  <div class="link-chip-info">
                    <span class="link-chip-name">{{ selectedRelease.title }}</span>
                    <span class="link-chip-sub">{{ selectedRelease.catalog_no }}</span>
                  </div>
                  <button type="button" class="link-chip-clear" (click)="clearLink()" title="Remove link">×</button>
                </div>
              } @else {
                <!-- Release search -->
                <div class="tw-relative">
                  <div class="link-search-wrap">
                    <app-icon name="search" class="link-search-icon" iconOnly />
                    <input type="text"
                           class="form-control link-search-input"
                           [(ngModel)]="linkSearchTerm"
                           (ngModelChange)="onLinkSearch()"
                           (focus)="onLinkSearch()"
                           (blur)="onLinkBlur()"
                           placeholder="Search releases..."
                           autocomplete="off">
                  </div>
                  @if (showLinkDropdown && filteredReleases.length > 0) {
                    <div class="link-dropdown">
                      @for (release of filteredReleases; track release.id) {
                        <div class="link-option tw-flex tw-items-center tw-gap-2"
                             (mousedown)="selectRelease(release)">
                          @if (release.cover_art) {
                            <img [src]="release.cover_art" class="tw-w-7 tw-h-7 tw-rounded tw-object-cover tw-flex-shrink-0" alt="">
                          } @else {
                            <div class="tw-w-7 tw-h-7 tw-rounded tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-bg-gray-100">
                              <app-icon name="music" />
                            </div>
                          }
                          <div class="tw-min-w-0">
                            <div class="tw-font-semibold tw-truncate" style="font-size:13px;">{{ release.title }}</div>
                            <div class="tw-text-muted" style="font-size:11px;">{{ release.catalog_no }}</div>
                          </div>
                        </div>
                      }
                    </div>
                  }
                  @if (!linkDataLoaded && linkSearchTerm === '') {
                    <div class="tw-text-sm tw-text-muted tw-mt-1">Loading releases…</div>
                  }
                </div>
              }
            }
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

  // Link to
  linkType: 'none' | 'artist' | 'release' = 'none';
  linkSearchTerm = '';
  showLinkDropdown = false;
  allArtists: any[] = [];
  allReleases: Release[] = [];
  filteredArtists: any[] = [];
  filteredReleases: Release[] = [];
  linkDataLoaded = false;
  selectedArtist: any = null;
  selectedRelease: Release | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private apiService: ApiService,
    private releaseService: ReleaseService,
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
          if (product.release_id) {
            this.linkType = 'release';
            this.releaseService.getReleases().subscribe({
              next: (res) => {
                this.allReleases = res.releases || [];
                this.linkDataLoaded = true;
                this.selectedRelease = this.allReleases.find(r => r.id === product.release_id) || null;
              }
            });
          } else if (product.artist_id) {
            this.linkType = 'artist';
            this.apiService.getArtists().subscribe({
              next: (res: any) => {
                this.allArtists = res.artists || res || [];
                this.linkDataLoaded = true;
                this.selectedArtist = this.allArtists.find(a => a.id === product.artist_id) || null;
              }
            });
          }
        }
      });
    }
  }

  setLinkType(type: 'none' | 'artist' | 'release'): void {
    this.linkType = type;
    this.linkSearchTerm = '';
    this.showLinkDropdown = false;
    this.filteredArtists = [];
    this.filteredReleases = [];
    this.linkDataLoaded = false;
    this.selectedArtist = null;
    this.selectedRelease = null;

    if (type === 'none') {
      this.form.artist_id = null;
      this.form.release_id = null;
    } else if (type === 'artist') {
      this.form.release_id = null;
      this.apiService.getArtists().subscribe({
        next: (res: any) => {
          this.allArtists = res.artists || res || [];
          this.linkDataLoaded = true;
          this.onLinkSearch();
        }
      });
    } else if (type === 'release') {
      this.form.artist_id = null;
      this.releaseService.getReleases().subscribe({
        next: (res) => {
          this.allReleases = res.releases || [];
          this.linkDataLoaded = true;
          this.onLinkSearch();
        }
      });
    }
  }

  onLinkSearch(): void {
    const term = this.linkSearchTerm.toLowerCase();
    this.showLinkDropdown = true;
    if (this.linkType === 'artist') {
      this.filteredArtists = term
        ? this.allArtists.filter(a => a.name?.toLowerCase().includes(term))
        : this.allArtists.slice(0, 10);
    } else if (this.linkType === 'release') {
      this.filteredReleases = term
        ? this.allReleases.filter(r =>
            r.title?.toLowerCase().includes(term) ||
            r.catalog_no?.toLowerCase().includes(term))
        : this.allReleases.slice(0, 10);
    }
  }

  onLinkBlur(): void {
    setTimeout(() => { this.showLinkDropdown = false; }, 150);
  }

  selectArtist(artist: any): void {
    this.form.artist_id = artist.id;
    this.selectedArtist = artist;
    this.linkSearchTerm = '';
    this.showLinkDropdown = false;
  }

  selectRelease(release: Release): void {
    this.form.release_id = release.id;
    this.selectedRelease = release;
    this.linkSearchTerm = '';
    this.showLinkDropdown = false;
  }

  clearLink(): void {
    this.form.artist_id = null;
    this.form.release_id = null;
    this.selectedArtist = null;
    this.selectedRelease = null;
    this.linkSearchTerm = '';
  }

  getArtistPhotoUrl(artist: any): string | null {
    if (artist.profilePhotoImage?.path) return artist.profilePhotoImage.path;
    if (artist.profile_photo) {
      return artist.profile_photo.startsWith('http')
        ? artist.profile_photo
        : `${environment.apiUrl}/uploads/artists/${artist.profile_photo}`;
    }
    return null;
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
