import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicService } from '../../services/public.service';
import { MetaService } from '../../services/meta.service';
import { AudioPlayerService, AudioPlayerState } from '../../services/audio-player.service';

export interface ArtistEPK {
  artist: {
    id: number;
    name: string;
    bio?: string;
    profile_photo?: string;
    epk_template?: number;
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
    status?: string;
    release_type: string;
    streaming_links: {
      spotify?: string;
      apple_music?: string;
      youtube?: string;
      soundcloud?: string;
      bandcamp?: string;
    };
    songs?: Array<{
      id: number;
      title: string;
      track_number?: number;
      has_audio: boolean;
    }>;
  }>;
}

@Component({
    selector: 'app-artist-epk',
    imports: [CommonModule],
    templateUrl: './artist-epk.component.html',
    styleUrls: ['./artist-epk.component.scss']
})
export class ArtistEPKComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  epkData: ArtistEPK | null = null;
  isLoading = true;
  isError = false;
  isPreview = false;
  previewTemplate: number | null = null;

  // Lightbox properties
  lightboxOpen = false;
  currentImageIndex = 0;
  galleryImages: Array<{url: string, caption?: string}> = [];

  // Audio player properties - using AudioPlayerService
  playingReleaseId: number | null = null;
  playingSongIndex: number = 0;
  audioState: AudioPlayerState | null = null;
  private isAutoAdvancing: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private publicService: PublicService,
    private metaService: MetaService,
    private audioPlayerService: AudioPlayerService
  ) {}

  ngOnInit() {
    // Subscribe to audio player state
    this.audioPlayerService.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.audioState = state;
    });

    // Clear any existing callbacks before setting new ones to avoid stale closures
    this.audioPlayerService.clearCallbacks();
    
    // Set up callback for when audio ends (auto-advance to next track)
    this.audioPlayerService.onEnded(() => this.onAudioEnded());
    this.audioPlayerService.onError(() => this.onAudioError());

    // Check if this is preview mode from route data
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.isPreview = data['preview'] || false;
    });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const artistId = params['artist_id'];

      // In preview mode, also get the template number
      if (this.isPreview && params['template']) {
        this.previewTemplate = parseInt(params['template'], 10);
      }

      // Load EPK data or show error if no artist ID
      if (artistId) {
        this.loadArtistEPK(artistId);
      } else {
        this.isError = true;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy() {
    // Clean up audio resources
    this.audioPlayerService.stop();
    this.audioPlayerService.clearCallbacks();
    
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

  getEpkTemplate(): number {
    // In preview mode, use the preview template override
    if (this.isPreview && this.previewTemplate) {
      return this.previewTemplate;
    }
    return this.epkData?.artist.epk_template || 1;
  }

  // Audio player methods
  releaseHasAudio(release: any): boolean {
    return release.songs && release.songs.length > 0 && release.songs.some((s: any) => s.has_audio);
  }

  isReleasePlayable(release: any): boolean {
    return release.status === 'Live' && this.releaseHasAudio(release);
  }

  isReleasePlaying(release: any): boolean {
    return this.playingReleaseId === release.id && this.audioState?.isPlaying === true;
  }

  isReleasePaused(release: any): boolean {
    return this.playingReleaseId === release.id && this.audioState?.isPaused === true;
  }

  isReleaseLoading(release: any): boolean {
    return this.playingReleaseId === release.id && this.audioState?.isLoading === true;
  }

  togglePlayRelease(release: any): void {
    if (!this.isReleasePlayable(release)) return;

    // If already playing this release, pause/resume it
    if (this.playingReleaseId === release.id) {
      if (this.audioState?.isPaused) {
        // Resume playback
        this.audioPlayerService.resume();
      } else if (this.audioState?.isPlaying) {
        // Pause playback
        this.audioPlayerService.pause();
      } else {
        // Neither playing nor paused (stopped state) - restart the release
        const firstSongIndex = release.songs.findIndex((song: any) => song.has_audio);
        if (firstSongIndex === -1) return;
        
        this.playingSongIndex = firstSongIndex;
        this.playAudio(release.songs[firstSongIndex]);
      }
    } else {
      // Stop current audio if playing different release
      this.audioPlayerService.stop();
      
      // Find first track with audio
      const firstSongIndex = release.songs.findIndex((song: any) => song.has_audio);
      if (firstSongIndex === -1) return;
      
      this.playingReleaseId = release.id;
      this.playingSongIndex = firstSongIndex;
      this.playAudio(release.songs[firstSongIndex]);
    }
  }

  private playAudio(song: any): void {
    if (!song || !song.has_audio || !this.epkData) return;

    // Use the service's playPublic method
    this.audioPlayerService.playPublic(
      { 
        id: song.id, 
        has_audio: song.has_audio,
        title: song.title,
        artist_name: this.epkData.artist.name
      }, 
      this.epkData.artist.id
    );
  }

  private onAudioEnded(): void {
    // Prevent concurrent execution if already auto-advancing
    if (this.isAutoAdvancing) {
      return;
    }

    // Auto-play next track if available
    const currentRelease = this.epkData?.releases.find(r => r.id === this.playingReleaseId);
    if (!currentRelease || !currentRelease.songs) {
      this.playingReleaseId = null;
      return;
    }

    // Store the release ID to check if playback was cancelled
    const currentReleaseId = currentRelease.id;

    // Set guard flag
    this.isAutoAdvancing = true;

    try {
      // Find next song with audio
      let nextIndex = this.playingSongIndex + 1;
      while (nextIndex < currentRelease.songs.length) {
        // Check if playback was stopped/cancelled
        if (this.playingReleaseId !== currentReleaseId) {
          return;
        }

        const nextSong = currentRelease.songs[nextIndex];
        if (nextSong.has_audio) {
          this.playingSongIndex = nextIndex;
          this.playAudio(nextSong);
          return;
        }
        nextIndex++;
      }

      // No more songs with audio - reset state
      this.playingReleaseId = null;
      this.playingSongIndex = 0;
    } finally {
      // Always clear the guard flag
      this.isAutoAdvancing = false;
    }
  }

  private onAudioError(): void {
    console.error('Audio playback error');
    this.playingReleaseId = null;
  }
}