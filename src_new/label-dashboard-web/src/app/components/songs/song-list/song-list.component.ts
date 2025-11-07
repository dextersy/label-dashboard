import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Song } from '../../../services/song.service';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './song-list.component.html',
  styleUrl: './song-list.component.scss'
})
export class SongListComponent implements OnDestroy {
  @Input() songs: Song[] = [];
  @Input() isAdmin: boolean = false;
  @Input() releaseStatus: string = 'Draft';
  @Input() uploadProgress: { [songId: number]: number } = {};
  @Output() editSong = new EventEmitter<Song>();
  @Output() deleteSong = new EventEmitter<Song>();
  @Output() uploadAudio = new EventEmitter<Song>();
  @Output() reorderSongs = new EventEmitter<Song[]>();

  playingSongId: number | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;

  // For non-admin users on non-draft releases, song list modifications are restricted
  // This includes: delete songs, reorder songs, upload audio
  isRestrictedMode(): boolean {
    // If no status or status is Draft, not restricted
    if (!this.releaseStatus || this.releaseStatus === 'Draft') {
      return false;
    }
    return !this.isAdmin;
  }

  onEdit(song: Song): void {
    this.editSong.emit(song);
  }

  onDelete(song: Song): void {
    if (confirm(`Are you sure you want to delete "${song.title}"?`)) {
      this.deleteSong.emit(song);
    }
  }

  onUploadAudio(song: Song): void {
    this.uploadAudio.emit(song);
  }

  onDrop(event: CdkDragDrop<Song[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.songs, event.previousIndex, event.currentIndex);
      this.reorderSongs.emit(this.songs);
    }
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getCollaboratorNames(song: Song): string {
    if (!song.collaborators || song.collaborators.length === 0) {
      return '-';
    }
    return song.collaborators
      .map(c => c.artist?.name || 'Unknown')
      .join(', ');
  }

  isUploading(songId?: number): boolean {
    return songId !== undefined && this.uploadProgress[songId] !== undefined;
  }

  getUploadProgress(songId?: number): number {
    return songId !== undefined ? (this.uploadProgress[songId] || 0) : 0;
  }

  onPlayAudio(song: Song): void {
    if (!song.id || !song.audio_file) return;

    // If clicking on the currently playing song, pause it
    if (this.playingSongId === song.id && this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
      this.playingSongId = null;
      return;
    }

    // Stop any currently playing audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    // Revoke previous blob URL to prevent memory leak
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    // Create new audio element and play
    const token = localStorage.getItem('auth_token');
    const audioUrl = `${environment.apiUrl}/songs/${song.id}/audio`;

    this.audioElement = new Audio();

    // Set authorization header by fetching with credentials
    fetch(audioUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        if (this.audioElement) {
          this.currentBlobUrl = URL.createObjectURL(blob);
          this.audioElement.src = this.currentBlobUrl;
          this.playingSongId = song.id || null;
          this.audioElement.play();

          // Reset playing state when audio ends
          this.audioElement.onended = () => {
            this.playingSongId = null;
          };

          // Handle errors
          this.audioElement.onerror = () => {
            console.error('Error playing audio');
            this.playingSongId = null;
          };
        }
      })
      .catch(error => {
        console.error('Error loading audio:', error);
        this.playingSongId = null;
      });
  }

  ngOnDestroy(): void {
    // Clean up audio element when component is destroyed
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    // Revoke blob URL to prevent memory leak
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}
