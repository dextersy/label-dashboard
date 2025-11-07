import { Component, Input, Output, EventEmitter, OnInit, OnChanges, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Artist } from '../artist-selection/artist-selection.component';
import { environment } from 'environments/environment';
import { QuillModule } from 'ngx-quill';

export interface ArtistProfile extends Artist {
  bio?: string;
  website_page_url?: string;
  facebook_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  tiktok_handle?: string;
  youtube_channel?: string;
  profile_photo_id?: number;
  profilePhotoImage?: {
    id: number;
    path: string;
    credits?: string;
    date_uploaded: Date;
  };
}

@Component({
  selector: 'app-artist-profile-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './artist-profile-tab.component.html',
  styleUrl: './artist-profile-tab.component.scss'
})
export class ArtistProfileTabComponent implements OnInit, OnChanges {
  @Input() artist: ArtistProfile | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() artistUpdated = new EventEmitter<ArtistProfile>();

  editingProfile: ArtistProfile = {
    id: 0,
    name: '',
    bio: '',
    website_page_url: '',
    facebook_handle: '',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    youtube_channel: '',
    band_members: ''
  } as ArtistProfile;
  saving = false;
  selectedFile: File | null = null;
  uploadProgress = 0;

  quillConfig = {
    toolbar: [
      ['bold', 'italic'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    if (this.artist) {
      this.editingProfile = { ...this.artist };
    }
  }

  ngOnChanges(): void {
    if (this.artist) {
      this.editingProfile = { ...this.artist };
    }
  }

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
        this.alertMessage.emit({
          type: 'error',
          message: 'Please select a valid image file (JPEG, PNG, or GIF).'
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          message: 'File size must be less than 5MB.'
        });
        return;
      }

      this.selectedFile = file;
      
      // Preview the selected image
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.editingProfile.profile_photo = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  saveProfile(): void {
    if (!this.artist) return;

    this.saving = true;
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('artist_id', this.artist.id.toString());
    formData.append('name', this.editingProfile.name || '');
    formData.append('band_members', this.editingProfile.band_members || '');
    formData.append('bio', this.editingProfile.bio || '');
    formData.append('website_page_url', this.editingProfile.website_page_url || '');
    formData.append('facebook_handle', this.editingProfile.facebook_handle || '');
    formData.append('instagram_handle', this.editingProfile.instagram_handle || '');
    formData.append('twitter_handle', this.editingProfile.twitter_handle || '');
    formData.append('tiktok_handle', this.editingProfile.tiktok_handle || '');
    formData.append('youtube_channel', this.editingProfile.youtube_channel || '');
    formData.append('notify_changes', 'true');

    if (this.selectedFile) {
      formData.append('profile_photo', this.selectedFile);
    }

    this.http.put<{message: string, artist: ArtistProfile}>(
      `${environment.apiUrl}/artists/${this.artist.id}`, 
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
          if (response && response.artist) {
            this.artistUpdated.emit(response.artist);
            this.alertMessage.emit({
              type: 'success',
              message: response.message || 'Artist profile updated successfully!'
            });
            this.selectedFile = null;
          } else {
            this.alertMessage.emit({
              type: 'error',
              message: response?.message || 'Failed to update artist profile.'
            });
          }
          this.saving = false;
        } else if (event.type === 1) { // HttpEventType.UploadProgress
          if (event.total) {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
          }
        }
      },
      error: (error) => {
        console.error('Error updating artist profile:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while updating the profile.'
        });
        this.saving = false;
        this.uploadProgress = 0;
      }
    });
  }

  getProfilePhotoUrl(): string {
    if (this.editingProfile.profile_photo && this.editingProfile.profile_photo.startsWith('data:')) {
      return this.editingProfile.profile_photo; // Preview image
    }

    // Use gallery image if available (profile_photo_id)
    if (this.editingProfile.profilePhotoImage?.path) {
      return this.editingProfile.profilePhotoImage.path;
    }
    
    // Fallback to legacy profile_photo field
    if (this.editingProfile.profile_photo) {
      return this.editingProfile.profile_photo.startsWith('http') 
        ? this.editingProfile.profile_photo 
        : `${environment.apiUrl}/uploads/artists/${this.editingProfile.profile_photo}`;
    }
    
    return 'assets/img/placeholder.jpg';
  }

  isFormValid(): boolean {
    // Basic validation - artist name is required
    return !!(this.editingProfile.name && this.editingProfile.name.trim().length > 0);
  }
}