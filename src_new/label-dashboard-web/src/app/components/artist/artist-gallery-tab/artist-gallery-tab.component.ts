import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Artist } from '../artist-selection/artist-selection.component';
import { environment } from 'environments/environment';
import { LightboxComponent } from '../../shared/lightbox/lightbox.component';
import { ConfirmationService } from '../../../services/confirmation.service';

export interface ArtistPhoto {
  id: number;
  filename: string;
  caption: string;
  upload_date: string;
  url: string;
}

@Component({
    selector: 'app-artist-gallery-tab',
    imports: [CommonModule, FormsModule, LightboxComponent],
    templateUrl: './artist-gallery-tab.component.html',
    styleUrl: './artist-gallery-tab.component.scss'
})
export class ArtistGalleryTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() profilePhotoUpdated = new EventEmitter<Artist>();

  photos: ArtistPhoto[] = [];
  loading = false;
  uploading = false;
  selectedFiles: FileList | null = null;
  uploadProgress = 0;
  editingCaptions: { [key: number]: boolean } = {};
  editingCaptionTexts: { [key: number]: string } = {};
  
  // Lightbox properties
  showLightbox = false;
  lightboxImageUrl = '';
  lightboxImageAlt = '';
  lightboxCaption = '';

  constructor(
    private http: HttpClient,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    if (this.artist) {
      this.loadPhotos();
    }
  }

  ngOnChanges(): void {
    if (this.artist) {
      this.loadPhotos();
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadPhotos(): void {
    if (!this.artist) return;

    this.loading = true;
    
    this.http.get<{photos: ArtistPhoto[]}>(`${environment.apiUrl}/artists/${this.artist.id}/photos`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.photos = data.photos;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading photos:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load photo gallery.'
        });
        this.loading = false;
      }
    });
  }

  onFilesSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedFiles = files;
    }
  }

  uploadPhotos(): void {
    if (!this.artist || !this.selectedFiles || this.selectedFiles.length === 0) {
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('artist_id', this.artist.id.toString());
    
    for (let i = 0; i < this.selectedFiles.length; i++) {
      const file = this.selectedFiles[i];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.alertMessage.emit({
          type: 'error',
          message: `File ${file.name} is not a valid image format.`
        });
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          message: `File ${file.name} is too large (max 10MB).`
        });
        continue;
      }

      formData.append('photos', file);
    }

    this.http.post<{success: boolean, message: string, photos: ArtistPhoto[]}>(
      `${environment.apiUrl}/artists/${this.artist.id}/photos`, 
      formData,
      {
        headers: this.getAuthHeaders(),
        reportProgress: true,
        observe: 'events'
      }
    ).subscribe({
      next: (event: any) => {
        if (event.type === 4) { // HttpEventType.Response
          const response = event.body;
          if (response.success) {
            this.photos = [...this.photos, ...response.photos];
            this.alertMessage.emit({
              type: 'success',
              message: response.message || 'Photos uploaded successfully!'
            });
            this.selectedFiles = null;
            // Reset file input
            const fileInput = document.getElementById('photoUpload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
          } else {
            this.alertMessage.emit({
              type: 'error',
              message: response.message || 'Failed to upload photos.'
            });
          }
          this.uploading = false;
          this.uploadProgress = 0;
        } else if (event.type === 1) { // HttpEventType.UploadProgress
          if (event.total) {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
          }
        }
      },
      error: (error) => {
        console.error('Error uploading photos:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while uploading photos.'
        });
        this.uploading = false;
        this.uploadProgress = 0;
      }
    });
  }

  startEditingCaption(photo: ArtistPhoto): void {
    this.editingCaptions[photo.id] = true;
    this.editingCaptionTexts[photo.id] = photo.caption || '';
  }

  cancelEditingCaption(photoId: number): void {
    this.editingCaptions[photoId] = false;
    delete this.editingCaptionTexts[photoId];
  }

  saveCaption(photo: ArtistPhoto): void {
    if (!this.artist) return;

    const newCaption = this.editingCaptionTexts[photo.id] || '';
    
    this.http.put<{success: boolean, message: string}>(
      `${environment.apiUrl}/artists/${this.artist.id}/photos/${photo.id}/caption`,
      { caption: newCaption },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          photo.caption = newCaption;
          this.editingCaptions[photo.id] = false;
          delete this.editingCaptionTexts[photo.id];
          this.alertMessage.emit({
            type: 'success',
            message: 'Caption updated successfully!'
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to update caption.'
          });
        }
      },
      error: (error) => {
        console.error('Error updating caption:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while updating the caption.'
        });
      }
    });
  }

  async deletePhoto(photo: ArtistPhoto): Promise<void> {
    if (!this.artist) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Photo',
      message: 'Are you sure you want to delete this photo? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) {
      return;
    }

    this.http.delete<{success: boolean, message: string}>(
      `${environment.apiUrl}/artists/${this.artist.id}/photos/${photo.id}`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.photos = this.photos.filter(p => p.id !== photo.id);
          this.alertMessage.emit({
            type: 'success',
            message: 'Photo deleted successfully!'
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to delete photo.'
          });
        }
      },
      error: (error) => {
        console.error('Error deleting photo:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while deleting the photo.'
        });
      }
    });
  }

  getPhotoUrl(photo: ArtistPhoto): string {
    // Same approach as profile photo - check if URL is absolute or relative
    if (photo.url.startsWith('http')) {
      return photo.url; // Already absolute URL (S3 or external)
    }
    
    // For relative URLs, prepend the API base URL
    return `${environment.apiUrl}${photo.url}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getSelectedFilesArray(): File[] {
    if (!this.selectedFiles) return [];
    return Array.from(this.selectedFiles);
  }

  // Lightbox methods
  openLightbox(photo: ArtistPhoto): void {
    this.lightboxImageUrl = this.getPhotoUrl(photo);
    this.lightboxImageAlt = photo.caption || 'Artist photo';
    this.lightboxCaption = photo.caption || '';
    this.showLightbox = true;
  }

  closeLightbox(): void {
    this.showLightbox = false;
    this.lightboxImageUrl = '';
    this.lightboxImageAlt = '';
    this.lightboxCaption = '';
  }

  onPhotoDoubleClick(photo: ArtistPhoto): void {
    this.openLightbox(photo);
  }

  async setAsProfilePhoto(photo: ArtistPhoto): Promise<void> {
    if (!this.artist) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Set Profile Photo',
      message: 'Set this photo as the profile photo?',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'info'
    });

    if (!confirmed) {
      return;
    }

    this.http.put<{success: boolean, message: string}>(
      `${environment.apiUrl}/artists/${this.artist.id}/photos/${photo.id}/set-profile`,
      {},
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the local artist object with the new profile photo info
          const updatedArtist: Artist = {
            ...this.artist!,
            profile_photo: photo.url,
            profile_photo_id: photo.id,
            profilePhotoImage: {
              id: photo.id,
              path: photo.url,
              credits: photo.caption,
              date_uploaded: new Date(photo.upload_date)
            }
          };

          // Emit the updated artist so parent components can update their state
          this.profilePhotoUpdated.emit(updatedArtist);
          
          this.alertMessage.emit({
            type: 'success',
            message: 'Profile photo updated successfully!'
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to set profile photo.'
          });
        }
      },
      error: (error) => {
        console.error('Error setting profile photo:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while setting the profile photo.'
        });
      }
    });
  }
}