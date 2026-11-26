import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { ProductService } from '../../../services/product.service';
import { ProductImage } from '../../../models/product.model';
import { LightboxComponent } from '../../../components/shared/lightbox/lightbox.component';
import { ConfirmationService } from '../../../services/confirmation.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { FileUploadComponent } from '../../../components/shared/file-upload/file-upload.component';
import { PlanLimitService } from '../../../services/plan-limit.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-product-gallery-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LightboxComponent, DragDropModule, IconComponent, FileUploadComponent],
  templateUrl: './product-gallery-tab.component.html',
  styleUrl: './product-gallery-tab.component.scss',
})
export class ProductGalleryTabComponent implements OnInit {
  productId: number | null = null;
  images: ProductImage[] = [];
  loading = false;
  uploading = false;
  uploadProgress = 0;
  selectedFiles: File[] | null = null;

  // Reorder mode
  reorderMode = false;
  savingReorder = false;

  isAdmin = false;

  // Lightbox
  showLightbox = false;
  lightboxImageUrl = '';
  lightboxImageAlt = '';

  // Kebab menu (mobile)
  openKebabMenuId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private confirmationService: ConfirmationService,
    private planLimitService: PlanLimitService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.productId = parseInt(id as string, 10);
      this.loadImages();
    }
  }

  loadImages(): void {
    if (!this.productId) return;
    this.loading = true;
    this.productService.getProduct(this.productId).subscribe({
      next: (product) => {
        this.images = [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onFilesSelected(files: File[]): void {
    if (files.length > 0) {
      this.selectedFiles = files;
    }
  }

  getSelectedFilesArray(): File[] {
    return this.selectedFiles ?? [];
  }

  async uploadImages(): Promise<void> {
    if (!this.productId || !this.selectedFiles || this.selectedFiles.length === 0) return;

    this.uploading = true;
    this.uploadProgress = 0;

    const validFiles: File[] = [];
    for (const file of this.selectedFiles) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      validFiles.push(file);
    }

    let uploaded = 0;
    for (const file of validFiles) {
      await new Promise<void>((resolve) => {
        this.productService.uploadImage(this.productId!, file).subscribe({
          next: (img) => {
            this.images.push(img);
            uploaded++;
            this.uploadProgress = Math.round((uploaded / validFiles.length) * 100);
            this.planLimitService.refreshStorageInfo();
            resolve();
          },
          error: (err) => {
            this.planLimitService.handleLimitError(err);
            resolve();
          }
        });
      });
    }

    this.uploading = false;
    this.uploadProgress = 0;
    this.selectedFiles = null;
  }

  async deleteImage(image: ProductImage): Promise<void> {
    if (!this.productId) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Image',
      message: 'Are you sure you want to delete this image?',
      warning: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;

    this.productService.deleteImage(this.productId, image.id).subscribe({
      next: () => {
        this.images = this.images.filter(i => i.id !== image.id);
      }
    });
  }

  toggleReorderMode(): void {
    this.reorderMode = !this.reorderMode;
  }

  onDrop(event: CdkDragDrop<ProductImage[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.images, event.previousIndex, event.currentIndex);
    this.saveImageOrder();
  }

  private saveImageOrder(): void {
    if (!this.productId) return;
    this.savingReorder = true;
    const imageIds = this.images.map(i => i.id);
    this.productService.reorderImages(this.productId, imageIds).subscribe({
      next: (reordered) => {
        this.images = reordered;
        this.savingReorder = false;
      },
      error: () => {
        this.savingReorder = false;
      }
    });
  }

  openLightbox(image: ProductImage): void {
    this.lightboxImageUrl = image.path;
    this.lightboxImageAlt = 'Product image';
    this.showLightbox = true;
  }

  closeLightbox(): void {
    this.showLightbox = false;
    this.lightboxImageUrl = '';
    this.lightboxImageAlt = '';
  }

  toggleKebabMenu(imageId: number, event: Event): void {
    event.stopPropagation();
    this.openKebabMenuId = this.openKebabMenuId === imageId ? null : imageId;
  }

  closeKebabMenu(): void {
    this.openKebabMenuId = null;
  }
}
