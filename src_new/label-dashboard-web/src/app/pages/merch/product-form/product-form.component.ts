import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { switchMap, of } from 'rxjs';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit, ProductCategory, ProductImage } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';
import { ApiService } from '../../../services/api.service';
import { ReleaseService, Release } from '../../../services/release.service';
import { environment } from '../../../../environments/environment';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, FloatingActionBarComponent, BreadcrumbComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
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

  // Category multi-select
  allCategories: ProductCategory[] = [];
  selectedCategories: ProductCategory[] = [];
  categorySearchTerm = '';
  showCategoryDropdown = false;
  categoriesLoaded = false;

  // Artist splits add UI
  splitSearchTerm = '';
  showSplitDropdown = false;
  filteredSplitArtists: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private apiService: ApiService,
    private releaseService: ReleaseService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    // Load categories for all edits
    this.productService.getCategories().subscribe({
      next: (cats) => {
        this.allCategories = cats;
        this.categoriesLoaded = true;
      },
    });

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
          this.selectedCategories = product.categories || [];
          // Load splits and all artists explicitly
          this.productService.getProductArtists(this.productId!).subscribe({
            next: (splits) => {
              this.artistSplits = splits.map(s => ({
                ...s,
                merch_royalty_percentage: parseFloat(String(s.merch_royalty_percentage))
              }));
            }
          });
          this.apiService.getArtists().subscribe({
            next: (res: any) => { this.allArtists = res.artists || res || []; }
          });
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

  private static readonly AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];

  getAvatarColor(name: string): string {
    if (!name) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return ProductFormComponent.AVATAR_COLORS[Math.abs(hash) % 8];
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  get totalSplitPercentage(): number {
    return this.artistSplits.reduce((sum, s) => sum + s.merch_royalty_percentage * 100, 0);
  }

  onSplitSearch(): void {
    const term = this.splitSearchTerm.toLowerCase();
    this.showSplitDropdown = true;
    this.filteredSplitArtists = (term
      ? this.allArtists.filter(a => a.name?.toLowerCase().includes(term))
      : this.allArtists.slice(0, 10)
    ).filter(a => !this.artistSplits.some(s => s.artist_id === a.id));
  }

  onSplitBlur(): void {
    setTimeout(() => { this.showSplitDropdown = false; }, 150);
  }

  addSplit(artist: any): void {
    this.artistSplits.push({
      artist_id: artist.id,
      product_id: this.productId!,
      merch_royalty_percentage: 0.5,
      merch_royalty_type: 'Revenue',
      artist: { id: artist.id, name: artist.name },
    });
    this.splitSearchTerm = '';
    this.showSplitDropdown = false;
  }

  get filteredCategories(): ProductCategory[] {
    const term = this.categorySearchTerm.toLowerCase();
    return this.allCategories.filter(c =>
      !this.selectedCategories.some(s => s.id === c.id) &&
      c.name.toLowerCase().includes(term)
    );
  }

  onCategorySearch(): void {
    this.showCategoryDropdown = true;
  }

  onCategoryBlur(): void {
    setTimeout(() => { this.showCategoryDropdown = false; }, 150);
  }

  addCategory(cat: ProductCategory): void {
    if (!this.selectedCategories.some(c => c.id === cat.id)) {
      this.selectedCategories.push(cat);
    }
    this.categorySearchTerm = '';
    this.showCategoryDropdown = false;
  }

  removeCategory(cat: ProductCategory): void {
    this.selectedCategories = this.selectedCategories.filter(c => c.id !== cat.id);
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    const saveProduct$ = this.isEdit && this.productId
      ? this.productService.updateProduct(this.productId, this.form)
      : this.productService.createProduct(this.form);

    saveProduct$.pipe(
      switchMap((product) => {
        const id = product.id;
        const splitsOp$ = this.artistSplits.length > 0
          ? this.productService.setProductArtists(
              id,
              this.artistSplits.map(s => ({
                artist_id: s.artist_id,
                merch_royalty_percentage: parseFloat(String(s.merch_royalty_percentage)),
                merch_royalty_type: s.merch_royalty_type,
              }))
            )
          : of(null);
        const catIds = this.selectedCategories.map(c => c.id);
        const catsOp$ = this.productService.setProductCategories(id, catIds);
        return splitsOp$.pipe(switchMap(() => catsOp$)).pipe(switchMap(() => of(product)));
      })
    ).subscribe({
      next: (product) => {
        this.saving = false;
        this.router.navigate(['/merch/products', product.id]);
      },
      error: () => {
        this.saving = false;
        this.notificationService.showError('Failed to save product. Please try again.');
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

  inheritSplits(): void {
    if (!this.productId) return;
    this.productService.inheritSplitsFromRelease(this.productId).subscribe({
      next: (splits) => {
        this.artistSplits = splits.map(s => ({
          ...s,
          merch_royalty_percentage: parseFloat(String(s.merch_royalty_percentage))
        }));
        this.notificationService.showSuccess('Splits inherited from release.');
      },
      error: () => this.notificationService.showError('Failed to inherit splits.')
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
        merch_royalty_percentage: parseFloat(String(s.merch_royalty_percentage)),
        merch_royalty_type: s.merch_royalty_type,
      }))
    ).subscribe({
      next: (splits) => {
        this.artistSplits = splits.map(s => ({
          ...s,
          merch_royalty_percentage: parseFloat(String(s.merch_royalty_percentage))
        }));
        this.notificationService.showSuccess('Artist splits saved.');
      },
      error: () => {
        this.notificationService.showError('Failed to save artist splits. Please try again.');
      }
    });
  }
}
