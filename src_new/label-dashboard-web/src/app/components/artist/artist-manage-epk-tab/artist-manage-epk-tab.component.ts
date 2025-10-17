import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Artist } from '../artist-selection/artist-selection.component';
import { BrandService } from '../../../services/brand.service';
import { ApiService } from '../../../services/api.service';

export interface ArtistWithEPK extends Artist {
  epk_template?: number;
}

@Component({
  selector: 'app-artist-manage-epk-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-manage-epk-tab.component.html',
  styleUrl: './artist-manage-epk-tab.component.scss'
})
export class ArtistManageEpkTabComponent implements OnInit {
  @Input() artist!: ArtistWithEPK;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() artistUpdated = new EventEmitter<ArtistWithEPK>();

  epkUrl: string = '';
  selectedTemplate: number = 1;
  saving: boolean = false;

  templateOptions = [
    { value: 1, name: 'Modern Gradient', description: 'Bold design with gradient overlays and dynamic effects' },
    { value: 2, name: 'Minimal Clean', description: 'Simple, elegant design with clean typography' }
  ];

  constructor(
    private brandService: BrandService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.generateEPKUrl();
    this.selectedTemplate = this.artist?.epk_template || 1;
  }

  private generateEPKUrl(): void {
    if (this.artist && this.artist.id) {
      const currentDomain = window.location.hostname;
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';

      this.epkUrl = `${protocol}//${currentDomain}${port}/public/epk/${this.artist.id}`;
    }
  }

  updateEPKSettings(): void {
    if (!this.artist || this.saving) return;

    this.saving = true;

    this.apiService.updateArtistEPKSettings(this.artist.id, { epk_template: this.selectedTemplate })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.alertMessage.emit({
              type: 'success',
              message: response.message || 'EPK settings updated successfully!'
            });

            // Update the artist object with the returned settings
            const updatedArtist = { ...this.artist, ...response.settings };
            this.artistUpdated.emit(updatedArtist);
          } else {
            this.alertMessage.emit({
              type: 'error',
              message: response.message || 'Failed to update EPK settings.'
            });
          }
          this.saving = false;
        },
        error: (error) => {
          console.error('Error updating EPK settings:', error);
          this.alertMessage.emit({
            type: 'error',
            message: error.error?.error || 'An error occurred while updating the EPK settings.'
          });
          this.saving = false;
        }
      });
  }

  copyToClipboard(): void {
    if (this.epkUrl) {
      navigator.clipboard.writeText(this.epkUrl).then(() => {
        // Could emit success event to parent component for notification
        console.log('EPK URL copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback for older browsers
        this.fallbackCopyTextToClipboard(this.epkUrl);
      });
    }
  }

  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('EPK URL copied to clipboard (fallback)');
      }
    } catch (err) {
      console.error('Fallback: Could not copy text: ', err);
    }
    
    document.body.removeChild(textArea);
  }
}