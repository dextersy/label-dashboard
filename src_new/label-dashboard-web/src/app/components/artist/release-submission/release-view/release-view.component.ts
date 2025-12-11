import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Release } from '../../../../services/release.service';
import { AudioPlayerService } from '../../../../services/audio-player.service';

@Component({
  selector: 'app-release-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './release-view.component.html',
  styleUrl: './release-view.component.scss'
})
export class ReleaseViewComponent implements OnInit, OnDestroy {
  @Input() release: Release | null = null;
  @Input() isAdmin: boolean = false;
  @Output() editClicked = new EventEmitter<void>();

  // Audio player state (synced from service)
  playingSongId: number | null = null;
  loadingSongId: number | null = null;
  pausedSongId: number | null = null;
  
  private subscription: Subscription | null = null;

  constructor(private audioPlayerService: AudioPlayerService) {}

  ngOnInit(): void {
    // Subscribe to audio player state changes
    this.subscription = this.audioPlayerService.state$.subscribe(state => {
      this.playingSongId = state.playingSongId;
      this.loadingSongId = state.loadingSongId;
      this.pausedSongId = state.pausedSongId;
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Note: Don't stop audio here - the AudioPlayerService is a singleton
    // and the global popup player manages playback lifecycle
  }

  onEditClick(): void {
    this.editClicked.emit();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Live':
        return 'badge-success';
      case 'For Submission':
        return 'badge-info';
      case 'Pending':
        return 'badge-warning';
      case 'Draft':
        return 'badge-secondary';
      case 'Taken Down':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  getRoyaltyDisplay(artist: any): string {
    const royalty = artist.ReleaseArtist;
    if (!royalty) return 'N/A';
    
    // Convert from decimal (0-1) to percentage (0-100)
    const streaming = (royalty.streaming_royalty_percentage || 0) * 100;
    return `${streaming.toFixed(0)}%`;
  }

  hasStreamingLinks(): boolean {
    return !!(this.release?.spotify_link || this.release?.apple_music_link || this.release?.youtube_link);
  }

  // Get the primary artist name for the release
  private getArtistName(): string {
    if (this.release?.artists && this.release.artists.length > 0) {
      return this.release.artists[0].name;
    }
    return '';
  }

  // Audio player methods
  togglePlay(song: any): void {
    if (!song.audio_file) return;
    this.audioPlayerService.togglePlay({ 
      id: song.id, 
      audio_file: song.audio_file,
      title: song.title,
      artist_name: this.getArtistName()
    });
  }

  isPlaying(songId: number): boolean {
    return this.playingSongId === songId;
  }

  isPaused(songId: number): boolean {
    return this.pausedSongId === songId;
  }

  isLoading(songId: number): boolean {
    return this.loadingSongId === songId;
  }

  getPlayButtonIcon(song: any): string {
    if (this.isLoading(song.id)) return 'fas fa-spinner fa-spin';
    if (this.isPlaying(song.id)) return 'fas fa-pause';
    return 'fas fa-play';
  }

  // Get collaborators for a song
  getSongCollaborators(song: any): string {
    const collaborators: string[] = [];
    
    if (song.collaborators?.length) {
      song.collaborators.forEach((c: any) => {
        const name = c.artist?.name || 'Unknown';
        collaborators.push(name);
      });
    }
    
    if (song.authors?.length) {
      song.authors.forEach((a: any) => {
        const name = a.songwriter?.name || 'Unknown';
        collaborators.push(`${name} (Author)`);
      });
    }
    
    if (song.composers?.length) {
      song.composers.forEach((c: any) => {
        const name = c.songwriter?.name || 'Unknown';
        collaborators.push(`${name} (Composer)`);
      });
    }
    
    return collaborators.join(', ') || '—';
  }
}
