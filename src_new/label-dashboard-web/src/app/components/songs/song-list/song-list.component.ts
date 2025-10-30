import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { Song } from '../../../services/song.service';

@Component({
  selector: 'app-song-list',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './song-list.component.html',
  styleUrl: './song-list.component.scss'
})
export class SongListComponent {
  @Input() songs: Song[] = [];
  @Input() isAdmin: boolean = false;
  @Output() editSong = new EventEmitter<Song>();
  @Output() deleteSong = new EventEmitter<Song>();
  @Output() uploadAudio = new EventEmitter<Song>();
  @Output() reorderSongs = new EventEmitter<Song[]>();

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
}
