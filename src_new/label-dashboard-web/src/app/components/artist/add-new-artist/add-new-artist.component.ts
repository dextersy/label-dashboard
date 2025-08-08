import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { ArtistStateService } from '../../../services/artist-state.service';
import { environment } from 'environments/environment';

export interface NewArtistData {
  name: string;
  bio?: string;
  website_page_url?: string;
  facebook_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  tiktok_handle?: string;
  youtube_channel?: string;
  band_members?: string;
}

@Component({
  selector: 'app-add-new-artist',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbComponent],
  templateUrl: './add-new-artist.component.html',
  styleUrl: './add-new-artist.component.scss'
})
export class AddNewArtistComponent {
  @Output() artistCreated = new EventEmitter<any>();

  alertMessage: {type: 'success' | 'error', message: string} | null = null;

  newArtist: NewArtistData = {
    name: '',
    bio: '',
    website_page_url: '',
    facebook_handle: '',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    youtube_channel: '',
    band_members: ''
  };
  
  creating = false;
  selectedFile: File | null = null;
  uploadProgress = 0;
  previewImageUrl: string | null = null;

  constructor(
    private http: HttpClient, 
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.alertMessage = {
          type: 'error',
          message: 'Please select a valid image file (JPEG, PNG, or GIF).'
        };
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.alertMessage = {
          type: 'error',
          message: 'File size must be less than 5MB.'
        };
        return;
      }

      this.selectedFile = file;
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  isFormValid(): boolean {
    return !!(this.newArtist.name && this.newArtist.name.trim().length > 0);
  }

  createArtist(): void {
    if (!this.isFormValid()) {
      this.alertMessage = {
        type: 'error',
        message: 'Please provide an artist name.'
      };
      return;
    }

    this.creating = true;
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('name', this.newArtist.name);
    formData.append('bio', this.newArtist.bio || '');
    formData.append('band_members', this.newArtist.band_members || '');
    formData.append('website_page_url', this.newArtist.website_page_url || '');
    formData.append('facebook_handle', this.newArtist.facebook_handle || '');
    formData.append('instagram_handle', this.newArtist.instagram_handle || '');
    formData.append('twitter_handle', this.newArtist.twitter_handle || '');
    formData.append('tiktok_handle', this.newArtist.tiktok_handle || '');
    formData.append('youtube_channel', this.newArtist.youtube_channel || '');

    if (this.selectedFile) {
      formData.append('profile_photo', this.selectedFile);
    }

    this.http.post<{message: string, artist: any}>(`${environment.apiUrl}/artists`, formData, {
      headers: this.getAuthHeaders(),
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event: any) => {
        if (event.type === 4) { // HttpEventType.Response
          const response = event.body;
          if (response && response.artist) {
            // Trigger refresh of artist list and select the new artist
            this.artistStateService.triggerArtistsRefresh(response.artist.id);
            
            // Set the new artist as selected in the global state
            this.artistStateService.setSelectedArtist(response.artist);
            
            this.artistCreated.emit(response.artist);
            this.alertMessage = {
              type: 'success',
              message: response.message || 'Artist created successfully!'
            };
            
            // Reset form
            this.resetForm();
            
            // Navigate to the new artist's profile after a short delay
            setTimeout(() => {
              this.router.navigate(['/artist/profile']);
            }, 2000);
          } else {
            this.alertMessage = {
              type: 'error',
              message: response?.message || 'Failed to create artist.'
            };
          }
          this.creating = false;
        } else if (event.type === 1) { // HttpEventType.UploadProgress
          if (event.total) {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
          }
        }
      },
      error: (error) => {
        console.error('Error creating artist:', error);
        this.alertMessage = {
          type: 'error',
          message: 'An error occurred while creating the artist.'
        };
        this.creating = false;
        this.uploadProgress = 0;
      }
    });
  }

  resetForm(): void {
    this.newArtist = {
      name: '',
      bio: '',
      website_page_url: '',
      facebook_handle: '',
      instagram_handle: '',
      twitter_handle: '',
      tiktok_handle: '',
      youtube_channel: '',
      band_members: ''
    };
    this.selectedFile = null;
    this.uploadProgress = 0;
    this.previewImageUrl = null;
  }

  cancel(): void {
    this.resetForm();
    this.router.navigate(['/artist']);
  }
}
