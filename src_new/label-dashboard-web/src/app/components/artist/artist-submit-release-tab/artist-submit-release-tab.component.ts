import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Artist } from '../artist-selection/artist-selection.component';
import { BrandService, BrandSettings } from '../../../services/brand.service';

@Component({
  selector: 'app-artist-submit-release-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artist-submit-release-tab.component.html',
  styleUrl: './artist-submit-release-tab.component.scss'
})
export class ArtistSubmitReleaseTabComponent implements OnInit {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  brandSettings: BrandSettings | null = null;
  loading = true;

  constructor(private brandService: BrandService) {}

  ngOnInit(): void {
    this.loadBrandSettings();
  }

  private loadBrandSettings(): void {
    this.loading = true;
    
    // First try to get cached brand settings
    const cachedSettings = this.brandService.getCurrentBrandSettings();
    if (cachedSettings) {
      this.brandSettings = cachedSettings;
      this.loading = false;
    }

    // Subscribe to brand settings updates
    this.brandService.brandSettings$.subscribe((settings: BrandSettings | null) => {
      if (settings) {
        this.brandSettings = settings;
        this.loading = false;
      }
    });

    // If no cached settings, load from API
    if (!cachedSettings) {
      this.brandService.loadBrandByDomain().subscribe({
        next: (settings: BrandSettings) => {
          this.brandSettings = settings;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading brand settings:', error);
          this.loading = false;
          this.alertMessage.emit({
            type: 'error',
            message: 'Failed to load release submission settings.'
          });
        }
      });
    }
  }

  openSubmissionForm(): void {
    if (this.hasSubmissionUrl()) {
      // Open the submission form in a new tab
      window.open(this.getSubmissionUrl(), '_blank');
      
      this.alertMessage.emit({
        type: 'success',
        message: 'Release submission form opened in a new tab.'
      });
    }
  }

  hasSubmissionUrl(): boolean {
    return !!(this.brandSettings?.release_submission_url && 
              this.brandSettings.release_submission_url.length > 0);
  }

  getSubmissionUrl(): string {
    return this.brandSettings?.release_submission_url || '';
  }

  getBrandName(): string {
    return this.brandSettings?.name || 'the label';
  }
}