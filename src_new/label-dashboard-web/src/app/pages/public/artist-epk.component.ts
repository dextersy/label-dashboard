import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicService } from '../../services/public.service';
import { MetaService } from '../../services/meta.service';

export interface ArtistEPK {
  artist: {
    id: number;
    name: string;
    bio?: string;
    profile_photo?: string;
    social_media: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      tiktok?: string;
      spotify?: string;
      apple_music?: string;
      youtube?: string;
      soundcloud?: string;
      bandcamp?: string;
      website?: string;
    };
  };
  brand?: {
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
  };
  gallery: Array<{
    id: number;
    image_url: string;
    caption?: string;
  }>;
  releases: Array<{
    id: number;
    title: string;
    description?: string;
    cover_art_url?: string;
    release_date: string;
    release_type: string;
    streaming_links: {
      spotify?: string;
      apple_music?: string;
      youtube?: string;
      soundcloud?: string;
      bandcamp?: string;
    };
  }>;
}

@Component({
  selector: 'app-artist-epk',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artist-epk.component.html',
  styleUrls: ['./artist-epk.component.scss']
})
export class ArtistEPKComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  epkData: ArtistEPK | null = null;
  isLoading = true;
  isError = false;
  
  // Lightbox properties
  lightboxOpen = false;
  currentImageIndex = 0;
  galleryImages: Array<{url: string, caption?: string}> = [];

  constructor(
    private route: ActivatedRoute,
    private publicService: PublicService,
    private metaService: MetaService
  ) {}

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const artistId = params['artist_id'];
      if (artistId) {
        this.loadArtistEPK(artistId);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadArtistEPK(artistId: string) {
    this.isLoading = true;
    this.isError = false;

    this.publicService.getArtistEPK(parseInt(artistId, 10))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (epkData) => {
          this.epkData = epkData;
          this.setupGalleryImages();
          this.updatePageMetadata();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading artist EPK:', error);
          this.isError = true;
          this.isLoading = false;
        }
      });
  }

  private updatePageMetadata() {
    if (this.epkData) {
      const title = `${this.epkData.artist.name} - Electronic Press Kit`;
      const description = this.epkData.artist.bio 
        ? this.stripHtmlTags(this.epkData.artist.bio).substring(0, 160) + '...'
        : `Check out ${this.epkData.artist.name}'s music, bio, and latest releases.`;
      
      this.metaService.updatePageMetadata({
        title,
        description,
        image: this.epkData.artist.profile_photo,
        type: 'profile',
        siteName: this.epkData.brand?.name || 'Melt Records',
        twitterCard: 'summary_large_image'
      });
    }
  }

  stripHtmlTags(html: string): string {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  getProfilePhotoUrl(photoUrl?: string): string {
    if (!photoUrl) {
      return '/assets/img/default-avatar.png';
    }
    return photoUrl.startsWith('http') ? photoUrl : `/api/uploads/artists/${photoUrl}`;
  }

  getCoverArtUrl(coverUrl?: string): string {
    if (!coverUrl) {
      return '/assets/img/placeholder.jpg';
    }
    return coverUrl.startsWith('http') ? coverUrl : `/api/uploads/releases/${coverUrl}`;
  }

  getGalleryImageUrl(imageUrl: string): string {
    return imageUrl.startsWith('http') ? imageUrl : `/api/uploads/gallery/${imageUrl}`;
  }

  formatReleaseDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getBrandColor(): string {
    return this.epkData?.brand?.color || '#667eea';
  }

  // Helper to determine if a color is light or dark
  isLightColor(color: string): boolean {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  getBrandTagBackgroundColor(): string {
    const brandColor = this.getBrandColor();
    return this.isLightColor(brandColor) 
      ? 'rgba(0,0,0,0.7)' // Dark background for light text
      : 'rgba(255,255,255,0.7)'; // Light background for dark text
  }

  getSocialMediaLinks(): Array<{name: string, url: string, icon: string}> {
    if (!this.epkData?.artist.social_media) return [];

    const links = [];
    const social = this.epkData.artist.social_media;

    if (social.website) {
      const url = social.website.startsWith('http') ? social.website : `https://${social.website}`;
      links.push({ name: 'Website', url, icon: 'fas fa-globe' });
    }
    if (social.instagram) {
      const url = social.instagram.startsWith('http') ? social.instagram : `https://instagram.com/${social.instagram.replace('@', '')}`;
      links.push({ name: 'Instagram', url, icon: 'fab fa-instagram' });
    }
    if (social.facebook) {
      const url = social.facebook.startsWith('http') ? social.facebook : `https://facebook.com/${social.facebook}`;
      links.push({ name: 'Facebook', url, icon: 'fab fa-facebook' });
    }
    if (social.twitter) {
      const url = social.twitter.startsWith('http') ? social.twitter : `https://twitter.com/${social.twitter.replace('@', '')}`;
      links.push({ name: 'Twitter', url, icon: 'fab fa-twitter' });
    }
    if (social.tiktok) {
      const url = social.tiktok.startsWith('http') ? social.tiktok : `https://tiktok.com/@${social.tiktok.replace('@', '')}`;
      links.push({ name: 'TikTok', url, icon: 'fab fa-tiktok' });
    }
    if (social.spotify) {
      links.push({ name: 'Spotify', url: social.spotify, icon: 'fab fa-spotify' });
    }
    if (social.apple_music) {
      links.push({ name: 'Apple Music', url: social.apple_music, icon: 'fab fa-apple' });
    }
    if (social.youtube) {
      const url = social.youtube.startsWith('http') ? social.youtube : `https://youtube.com/${social.youtube}`;
      links.push({ name: 'YouTube', url, icon: 'fab fa-youtube' });
    }
    if (social.soundcloud) {
      links.push({ name: 'SoundCloud', url: social.soundcloud, icon: 'fab fa-soundcloud' });
    }
    if (social.bandcamp) {
      links.push({ name: 'Bandcamp', url: social.bandcamp, icon: 'fab fa-bandcamp' });
    }

    return links;
  }

  getStreamingLinks(release: any): Array<{name: string, url: string, icon: string}> {
    const links = [];
    const streaming = release.streaming_links;

    if (streaming.spotify) {
      links.push({ name: 'Spotify', url: streaming.spotify, icon: 'fab fa-spotify' });
    }
    if (streaming.apple_music) {
      links.push({ name: 'Apple Music', url: streaming.apple_music, icon: 'fab fa-apple' });
    }
    if (streaming.youtube) {
      links.push({ name: 'YouTube', url: streaming.youtube, icon: 'fab fa-youtube' });
    }
    if (streaming.soundcloud) {
      links.push({ name: 'SoundCloud', url: streaming.soundcloud, icon: 'fab fa-soundcloud' });
    }
    if (streaming.bandcamp) {
      links.push({ name: 'Bandcamp', url: streaming.bandcamp, icon: 'fab fa-bandcamp' });
    }

    return links;
  }

  // Lightbox functionality
  setupGalleryImages() {
    if (this.epkData?.gallery) {
      this.galleryImages = this.epkData.gallery.map(item => ({
        url: this.getGalleryImageUrl(item.image_url),
        caption: item.caption
      }));
    }
  }

  openLightbox(index: number) {
    this.currentImageIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeLightbox() {
    this.lightboxOpen = false;
    document.body.style.overflow = 'auto'; // Restore scrolling
  }

  nextImage() {
    if (this.currentImageIndex < this.galleryImages.length - 1) {
      this.currentImageIndex++;
    } else {
      this.currentImageIndex = 0; // Loop to first image
    }
  }

  prevImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    } else {
      this.currentImageIndex = this.galleryImages.length - 1; // Loop to last image
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.lightboxOpen) return;
    
    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case 'ArrowLeft':
        this.prevImage();
        break;
      case 'ArrowRight':
        this.nextImage();
        break;
    }
  }

  getCurrentImage(): {url: string, caption?: string} | undefined {
    return this.galleryImages[this.currentImageIndex];
  }

  onImageLoad(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.classList.add('loaded');
    }
  }
}