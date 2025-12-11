import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Release } from '../../../../services/release.service';
import { environment } from '../../../../../environments/environment';

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

  // Audio player state
  playingSongId: number | null = null;
  loadingSongId: number | null = null;
  pausedSongId: number | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.cleanupAudio();
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

  // Audio player methods
  async togglePlay(song: any): Promise<void> {
    if (!song.audio_file) return;

    // If this song is currently playing, pause it
    if (this.playingSongId === song.id) {
      this.pauseAudio();
      return;
    }

    // If this song is paused, resume it
    if (this.pausedSongId === song.id && this.audioElement) {
      this.resumeAudio();
      return;
    }

    // Otherwise, play this new song
    await this.playSong(song);
  }

  private async playSong(song: any): Promise<void> {
    // Stop any currently playing audio
    this.cleanupAudio();

    this.loadingSongId = song.id;

    try {
      const token = localStorage.getItem('auth_token');
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      const audioUrl = `${environment.apiUrl}/songs/${song.id}/audio`;
      
      const blob = await this.http.get(audioUrl, {
        headers,
        responseType: 'blob'
      }).toPromise();

      if (blob) {
        this.currentBlobUrl = URL.createObjectURL(blob);
        this.audioElement = new Audio(this.currentBlobUrl);
        
        this.audioElement.onended = () => {
          this.playingSongId = null;
          this.pausedSongId = null;
        };

        this.audioElement.onerror = () => {
          console.error('Audio playback error');
          this.cleanupAudio();
        };

        await this.audioElement.play();
        this.playingSongId = song.id;
        this.pausedSongId = null;
      }
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      this.loadingSongId = null;
    }
  }

  private pauseAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.pausedSongId = this.playingSongId;
      this.playingSongId = null;
    }
  }

  private resumeAudio(): void {
    if (this.audioElement) {
      this.audioElement.play();
      this.playingSongId = this.pausedSongId;
      this.pausedSongId = null;
    }
  }

  private cleanupAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.playingSongId = null;
    this.pausedSongId = null;
    this.loadingSongId = null;
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
