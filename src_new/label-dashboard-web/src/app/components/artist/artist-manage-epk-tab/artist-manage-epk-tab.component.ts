import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Artist } from '../artist-selection/artist-selection.component';
import { BrandService } from '../../../services/brand.service';
import { ApiService } from '../../../services/api.service';
import { ModalToBodyDirective } from '../../../directives/modal-to-body.directive';
import { downloadQRCode } from '../../../utils/qr-utils';

export interface ArtistWithEPK extends Artist {
  epk_template?: number;
}

@Component({
    selector: 'app-artist-manage-epk-tab',
    imports: [CommonModule, FormsModule, ModalToBodyDirective],
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
  previewOpen: boolean = false;
  previewTemplate: number | null = null;

  templateOptions: { value: number; name: string; description: string; icon: any }[] = [];

  constructor(
    private brandService: BrandService,
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.templateOptions = [
      {
        value: 1,
        name: 'Modern Gradient',
        description: 'Bold design with gradient overlays and dynamic effects',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72" fill="none">
          <defs>
            <linearGradient id="epk-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient>
            <linearGradient id="epk-grad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f093fb"/><stop offset="100%" stop-color="#f5576c"/></linearGradient>
          </defs>
          <!-- Page frame -->
          <rect x="1" y="1" width="54" height="70" rx="4" fill="#1a1a2e" stroke="#333" stroke-width="1"/>
          <!-- Hero section with gradient overlay -->
          <rect x="1" y="1" width="54" height="30" rx="4" fill="url(#epk-grad)" opacity="0.8"/>
          <rect x="1" y="25" width="54" height="6" fill="#1a1a2e" opacity="0.5"/>
          <!-- Profile circle -->
          <circle cx="28" cy="16" r="7" fill="#2a2a4a" stroke="#fff" stroke-width="1.5"/>
          <circle cx="28" cy="14" r="2" fill="#888"/>
          <ellipse cx="28" cy="18" rx="3" ry="2" fill="#888"/>
          <!-- Artist name line -->
          <rect x="16" y="26" width="24" height="2" rx="1" fill="#fff" opacity="0.9"/>
          <!-- Social icons row -->
          <circle cx="21" cy="33" r="2" fill="url(#epk-grad2)" opacity="0.6"/>
          <circle cx="28" cy="33" r="2" fill="url(#epk-grad2)" opacity="0.6"/>
          <circle cx="35" cy="33" r="2" fill="url(#epk-grad2)" opacity="0.6"/>
          <!-- Bio section -->
          <rect x="10" y="39" width="36" height="1.5" rx="0.75" fill="#555"/>
          <rect x="14" y="42" width="28" height="1.5" rx="0.75" fill="#444"/>
          <!-- Music grid (3 cards) -->
          <rect x="4" y="48" width="14" height="14" rx="3" fill="url(#epk-grad)" opacity="0.3" stroke="#667eea" stroke-width="0.5"/>
          <rect x="21" y="48" width="14" height="14" rx="3" fill="url(#epk-grad)" opacity="0.3" stroke="#667eea" stroke-width="0.5"/>
          <rect x="38" y="48" width="14" height="14" rx="3" fill="url(#epk-grad)" opacity="0.3" stroke="#667eea" stroke-width="0.5"/>
          <!-- Play icons on cards -->
          <polygon points="9,53 9,59 13,56" fill="#fff" opacity="0.7"/>
          <polygon points="26,53 26,59 30,56" fill="#fff" opacity="0.7"/>
          <polygon points="43,53 43,59 47,56" fill="#fff" opacity="0.7"/>
          <!-- Footer -->
          <rect x="1" y="66" width="54" height="5" rx="0 0 4 4" fill="#111"/>
        </svg>`)
      },
      {
        value: 2,
        name: 'Minimal Clean',
        description: 'Simple, elegant design with clean typography',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72" fill="none">
          <!-- Page frame -->
          <rect x="1" y="1" width="54" height="70" rx="4" fill="#fff" stroke="#dee2e6" stroke-width="1"/>
          <!-- Header with light bg -->
          <rect x="1" y="1" width="54" height="22" rx="4" fill="#f8f9fa"/>
          <rect x="1" y="19" width="54" height="4" fill="#f8f9fa"/>
          <!-- Profile circle (smaller, bordered) -->
          <circle cx="28" cy="10" r="5.5" fill="#fff" stroke="#dee2e6" stroke-width="1"/>
          <circle cx="28" cy="9" r="1.5" fill="#aaa"/>
          <ellipse cx="28" cy="12.5" rx="2.5" ry="1.5" fill="#aaa"/>
          <!-- Artist name (thin serif-like) -->
          <rect x="17" y="18" width="22" height="1.5" rx="0.75" fill="#212529"/>
          <!-- Thin separator -->
          <line x1="1" y1="23" x2="55" y2="23" stroke="#dee2e6" stroke-width="0.5"/>
          <!-- Social text links row -->
          <rect x="12" y="26" width="8" height="1" rx="0.5" fill="#6c757d"/>
          <rect x="24" y="26" width="8" height="1" rx="0.5" fill="#6c757d"/>
          <rect x="36" y="26" width="8" height="1" rx="0.5" fill="#6c757d"/>
          <!-- Bio section -->
          <rect x="22" y="31" width="12" height="1.5" rx="0.75" fill="#212529"/>
          <rect x="17" y="33.5" width="22" height="0.5" rx="0.25" fill="#212529" opacity="0.15"/>
          <rect x="8" y="36" width="40" height="1" rx="0.5" fill="#6c757d" opacity="0.5"/>
          <rect x="10" y="38" width="36" height="1" rx="0.5" fill="#6c757d" opacity="0.5"/>
          <rect x="12" y="40" width="32" height="1" rx="0.5" fill="#6c757d" opacity="0.5"/>
          <!-- Music list rows (bordered cards) -->
          <rect x="5" y="45" width="46" height="7" rx="2" fill="#fff" stroke="#dee2e6" stroke-width="0.5"/>
          <rect x="7" y="46.5" width="5" height="4" rx="1" fill="#f0f0f0"/>
          <rect x="14" y="47" width="14" height="1" rx="0.5" fill="#212529"/>
          <rect x="14" y="49" width="8" height="1" rx="0.5" fill="#aaa"/>
          <rect x="5" y="54" width="46" height="7" rx="2" fill="#fff" stroke="#dee2e6" stroke-width="0.5"/>
          <rect x="7" y="55.5" width="5" height="4" rx="1" fill="#f0f0f0"/>
          <rect x="14" y="56" width="14" height="1" rx="0.5" fill="#212529"/>
          <rect x="14" y="58" width="8" height="1" rx="0.5" fill="#aaa"/>
          <!-- Footer -->
          <rect x="1" y="66" width="54" height="5" rx="0 0 4 4" fill="#212529"/>
        </svg>`)
      },
      {
        value: 0,
        name: 'Disabled',
        description: 'EPK page is not publicly accessible',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72" fill="none">
          <!-- Page frame (faded) -->
          <rect x="1" y="1" width="54" height="70" rx="4" fill="#f5f5f5" stroke="#ddd" stroke-width="1"/>
          <!-- Faded placeholder lines -->
          <rect x="16" y="12" width="24" height="2" rx="1" fill="#ddd"/>
          <rect x="12" y="20" width="32" height="1.5" rx="0.75" fill="#e5e5e5"/>
          <rect x="14" y="24" width="28" height="1.5" rx="0.75" fill="#e5e5e5"/>
          <rect x="8" y="32" width="14" height="10" rx="2" fill="#eee"/>
          <rect x="25" y="32" width="14" height="10" rx="2" fill="#eee"/>
          <!-- Disabled slash -->
          <line x1="10" y1="10" x2="46" y2="62" stroke="#ccc" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="28" cy="36" r="20" fill="none" stroke="#ccc" stroke-width="2"/>
        </svg>`)
      }
    ];
    this.generateEPKUrl();
    this.selectedTemplate = this.artist?.epk_template ?? 1;
  }

  private generateEPKUrl(): void {
    if (this.artist && this.artist.id) {
      const currentDomain = window.location.hostname;
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';

      this.epkUrl = `${protocol}//${currentDomain}${port}/public/epk/${this.artist.id}`;
    }
  }

  getPreviewUrl(templateNumber: number): any {
    const currentDomain = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : '';
    const url = `${protocol}//${currentDomain}${port}/artist/epk/preview/${this.artist.id}/${templateNumber}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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

  downloadEPKQRCode(): void {
    if (!this.epkUrl) return;

    const artistName = this.artist.name.replace(/[^a-z0-9]/gi, '-');
    downloadQRCode(this.epkUrl, `EPK-${artistName}`).catch(err => {
      console.error('Failed to generate QR code:', err);
      this.alertMessage.emit({ type: 'error', message: 'Failed to generate QR code.' });
    });
  }

  openPreview(templateNumber: number): void {
    this.previewTemplate = templateNumber;
    this.previewOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closePreview(): void {
    this.previewOpen = false;
    this.previewTemplate = null;
    document.body.style.overflow = 'auto';
  }

  getPreviewTemplateName(): string {
    const template = this.templateOptions.find(t => t.value === this.previewTemplate);
    return template ? template.name : '';
  }

  useThisTemplate(): void {
    if (this.previewTemplate) {
      this.selectedTemplate = this.previewTemplate;
      this.closePreview();
      this.updateEPKSettings();
    }
  }
}