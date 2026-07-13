import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { QuillModule } from 'ngx-quill';
import { BrandService, BrandSettings, ArtistCustomField } from '../../../services/brand.service';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-artist-register',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './artist-register.component.html',
  styleUrl: './artist-register.component.scss'
})
export class ArtistRegisterComponent implements OnInit {
  brandSettings: BrandSettings | null = null;
  loading = true;
  submitting = false;
  submitted = false;
  error: string | null = null;

  form = {
    name: '',
    submitter_email: '',
    bio: '',
    website_page_url: '',
    facebook_handle: '',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    youtube_channel: '',
    band_members: ''
  };

  // For array-type custom fields, store the raw comma-separated string here
  customDataRaw: Record<string, string> = {};
  // For all other custom field types
  customData: Record<string, any> = {};

  selectedFile: File | null = null;
  photoPreview: string | null = null;

  quillConfig = {
    toolbar: [
      ['bold', 'italic'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean']
    ]
  };

  constructor(
    private http: HttpClient,
    private brandService: BrandService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (settings) => {
        this.brandSettings = settings;
        this.titleService.setTitle(`Artist Registration — ${settings.name}`);
        this.loading = false;
      },
      error: () => {
        this.error = 'This page is not available.';
        this.loading = false;
      }
    });
  }

  get brandContrastColor(): string {
    const hex = (this.brandSettings?.brand_color ?? '#000000').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Perceived luminance (WCAG formula)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 140 ? '#000000' : '#ffffff';
  }

  get customFields(): ArtistCustomField[] {
    return this.brandSettings?.artist_custom_fields ?? [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.error = 'Please select a valid image file (JPEG, PNG, or GIF).';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'File size must be less than 5 MB.';
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.photoPreview = e.target?.result as string; };
    reader.readAsDataURL(file);
    this.error = null;
  }

  isFormValid(): boolean {
    if (!this.form.name.trim()) return false;
    if (!this.form.submitter_email.trim()) return false;
    for (const field of this.customFields) {
      if (field.required) {
        if (field.type === 'array') {
          const raw = (this.customDataRaw[field.key] || '').trim();
          if (!raw) return false;
        } else {
          const val = this.customData[field.key];
          if (val === undefined || val === null || String(val).trim() === '') return false;
        }
      }
    }
    return true;
  }

  // Build the final custom_data object, converting array fields from CSV to arrays
  private buildCustomData(): Record<string, any> {
    const result: Record<string, any> = { ...this.customData };
    for (const field of this.customFields) {
      if (field.type === 'array') {
        const raw = this.customDataRaw[field.key] || '';
        result[field.key] = raw
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }
    }
    return result;
  }

  submit(): void {
    if (!this.isFormValid() || this.submitting) return;

    this.submitting = true;
    this.error = null;

    const builtCustomData = this.buildCustomData();

    const formData = new FormData();
    formData.append('name', this.form.name.trim());
    formData.append('submitter_email', this.form.submitter_email.trim());
    if (this.form.bio) formData.append('bio', this.form.bio);
    if (this.form.website_page_url) formData.append('website_page_url', this.form.website_page_url);
    if (this.form.facebook_handle) formData.append('facebook_handle', this.form.facebook_handle);
    if (this.form.instagram_handle) formData.append('instagram_handle', this.form.instagram_handle);
    if (this.form.twitter_handle) formData.append('twitter_handle', this.form.twitter_handle);
    if (this.form.tiktok_handle) formData.append('tiktok_handle', this.form.tiktok_handle);
    if (this.form.youtube_channel) formData.append('youtube_channel', this.form.youtube_channel);
    if (this.form.band_members) formData.append('band_members', this.form.band_members);
    if (Object.keys(builtCustomData).length > 0) {
      formData.append('custom_data', JSON.stringify(builtCustomData));
    }
    if (this.selectedFile) {
      formData.append('profile_photo', this.selectedFile);
    }

    this.http.post(`${environment.apiUrl}/public/artists/register`, formData).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'An error occurred. Please try again.';
        this.submitting = false;
      }
    });
  }
}
