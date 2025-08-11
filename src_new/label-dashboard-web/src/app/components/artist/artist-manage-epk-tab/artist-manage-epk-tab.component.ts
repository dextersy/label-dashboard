import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Artist } from '../artist-selection/artist-selection.component';
import { BrandService } from '../../../services/brand.service';

@Component({
  selector: 'app-artist-manage-epk-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-manage-epk-tab.component.html',
  styleUrl: './artist-manage-epk-tab.component.scss'
})
export class ArtistManageEpkTabComponent implements OnInit {
  @Input() artist!: Artist;
  
  epkUrl: string = '';

  constructor(private brandService: BrandService) {}

  ngOnInit(): void {
    this.generateEPKUrl();
  }

  private generateEPKUrl(): void {
    if (this.artist && this.artist.id) {
      const currentDomain = window.location.hostname;
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';
      
      this.epkUrl = `${protocol}//${currentDomain}${port}/public/epk/${this.artist.id}`;
    }
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