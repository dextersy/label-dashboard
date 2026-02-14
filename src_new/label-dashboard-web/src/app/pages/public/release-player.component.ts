import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicService } from '../../services/public.service';
import { MetaService } from '../../services/meta.service';
import { AudioPlayerService, AudioPlayerState, PlayableTrack } from '../../services/audio-player.service';

export interface ReleasePlayerData {
  release: {
    id: number;
    title: string;
    cover_art_url?: string;
    release_date: string;
    description?: string;
  };
  songs: Array<{
    id: number;
    title: string;
    track_number?: number;
    has_audio: boolean;
    duration?: number;
  }>;
  artist: {
    id: number;
    name: string;
  };
  brand?: {
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
  };
}

@Component({
  selector: 'app-release-player',
  imports: [CommonModule],
  templateUrl: './release-player.component.html',
  styleUrls: ['./release-player.component.scss']
})
export class ReleasePlayerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  playerData: ReleasePlayerData | null = null;
  isLoading = true;
  isError = false;

  currentSongIndex: number = -1;
  audioState: AudioPlayerState | null = null;
  private isAutoAdvancing = false;

  constructor(
    private route: ActivatedRoute,
    private publicService: PublicService,
    private metaService: MetaService,
    private audioPlayerService: AudioPlayerService
  ) {}

  ngOnInit(): void {
    this.audioPlayerService.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.audioState = state;
    });

    this.audioPlayerService.clearCallbacks();
    this.audioPlayerService.onEnded(() => this.onAudioEnded());
    this.audioPlayerService.onError(() => this.onAudioError());

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const artistId = parseInt(params['artistId'], 10);
      const releaseId = parseInt(params['releaseId'], 10);

      if (!isNaN(artistId) && !isNaN(releaseId)) {
        this.loadReleasePlayer(artistId, releaseId);
      } else {
        this.isError = true;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.audioPlayerService.stop();
    this.audioPlayerService.clearCallbacks();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReleasePlayer(artistId: number, releaseId: number): void {
    this.isLoading = true;
    this.isError = false;

    this.publicService.getReleasePlayer(artistId, releaseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ReleasePlayerData) => {
          this.playerData = data;
          this.updatePageMetadata();
          this.isLoading = false;
        },
        error: () => {
          this.isError = true;
          this.isLoading = false;
        }
      });
  }

  private updatePageMetadata(): void {
    if (!this.playerData) return;

    const title = `${this.playerData.release.title} – ${this.playerData.artist.name}`;
    const description = this.playerData.release.description
      ? this.stripHtml(this.playerData.release.description).substring(0, 160)
      : `Listen to ${this.playerData.release.title} by ${this.playerData.artist.name}`;

    this.metaService.updatePageMetadata({
      title,
      description,
      image: this.getCoverArtUrl(this.playerData.release.cover_art_url),
      type: 'music.album',
      siteName: this.playerData.brand?.name || '',
      twitterCard: 'summary_large_image'
    });
  }

  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  getCoverArtUrl(coverUrl?: string): string {
    if (!coverUrl) return '/assets/img/placeholder.jpg';
    return coverUrl.startsWith('http') ? coverUrl : `/api/uploads/releases/${coverUrl}`;
  }

  getBrandLogoUrl(logoUrl?: string): string {
    if (!logoUrl) return '';
    return logoUrl.startsWith('http') ? logoUrl : `/api/uploads/brands/${logoUrl}`;
  }

  getBrandColor(): string {
    return this.playerData?.brand?.color || '#667eea';
  }

  formatReleaseDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Audio controls

  isSongPlaying(index: number): boolean {
    return this.currentSongIndex === index && !!this.audioState?.isPlaying;
  }

  isSongPaused(index: number): boolean {
    return this.currentSongIndex === index && !!this.audioState?.isPaused;
  }

  isSongLoading(index: number): boolean {
    return this.currentSongIndex === index && !!this.audioState?.isLoading;
  }

  togglePlaySong(index: number): void {
    if (!this.playerData) return;
    const song = this.playerData.songs[index];
    if (!song?.has_audio) return;

    if (this.currentSongIndex === index) {
      if (this.audioState?.isPaused) {
        this.audioPlayerService.resume();
      } else if (this.audioState?.isPlaying) {
        this.audioPlayerService.pause();
      } else {
        this.playSong(index);
      }
    } else {
      this.audioPlayerService.stop();
      this.playSong(index);
    }
  }

  private playSong(index: number): void {
    if (!this.playerData) return;
    const song = this.playerData.songs[index];
    if (!song?.has_audio) return;

    this.currentSongIndex = index;
    const track: PlayableTrack = {
      id: song.id,
      has_audio: song.has_audio,
      title: song.title,
      artist_name: this.playerData.artist.name
    };
    this.audioPlayerService.playPublic(track, this.playerData.artist.id);
  }

  private onAudioEnded(): void {
    if (this.isAutoAdvancing || !this.playerData) {
      this.currentSongIndex = -1;
      return;
    }

    this.isAutoAdvancing = true;
    try {
      let next = this.currentSongIndex + 1;
      while (next < this.playerData.songs.length) {
        if (this.playerData.songs[next].has_audio) {
          this.playSong(next);
          return;
        }
        next++;
      }
      this.currentSongIndex = -1;
    } finally {
      this.isAutoAdvancing = false;
    }
  }

  private onAudioError(): void {
    this.currentSongIndex = -1;
  }

  seekAudio(event: MouseEvent): void {
    if (!this.audioState || this.audioState.duration === 0) return;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = ((event.clientX - rect.left) / rect.width) * 100;
    this.audioPlayerService.seek(pct);
  }

  formatTime(seconds: number): string {
    return this.audioPlayerService.formatTime(seconds);
  }

  getProgress(): number {
    return this.audioState?.progress || 0;
  }

  getCurrentTime(): number {
    return this.audioState?.currentTime || 0;
  }

  getDuration(): number {
    return this.audioState?.duration || 0;
  }
}
