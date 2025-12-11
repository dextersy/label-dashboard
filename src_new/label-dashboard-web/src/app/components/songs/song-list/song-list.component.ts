import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { Song } from '../../../services/song.service';
import { AudioPlayerService } from '../../../services/audio-player.service';

@Component({
    selector: 'app-song-list',
    imports: [CommonModule, DragDropModule],
    templateUrl: './song-list.component.html',
    styleUrl: './song-list.component.scss'
})
export class SongListComponent implements OnInit, OnDestroy {
  @Input() songs: Song[] = [];
  @Input() isAdmin: boolean = false;
  @Input() releaseStatus: string = 'Draft';
  @Input() uploadProgress: { [songId: number]: number } = {};
  @Output() editSong = new EventEmitter<Song>();
  @Output() deleteSong = new EventEmitter<Song>();
  @Output() uploadAudio = new EventEmitter<Song>();
  @Output() reorderSongs = new EventEmitter<Song[]>();

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
    this.deleteSong.emit(song);
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
    this.audioPlayerService.togglePlay({ 
      id: song.id, 
      audio_file: song.audio_file,
      title: song.title
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from audio player state
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Stop audio when component is destroyed
    this.audioPlayerService.stop();
  }
}
