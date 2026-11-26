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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private apiService: ApiService,
    private releaseService: ReleaseService,
    private notificationService: NotificationService,
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
        this.notificationService.showSuccess('Artist splits saved.');
      },
      error: () => {
        this.notificationService.showError('Failed to save artist splits. Please try again.');
      }
    });
  }
}
