import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongService, Song } from '../../../services/song.service';
import { SongListComponent } from '../../songs/song-list/song-list.component';
import { SongFormComponent } from '../../songs/song-form/song-form.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-track-list-dialog',
  standalone: true,
  imports: [CommonModule, SongListComponent, SongFormComponent],
  templateUrl: './track-list-dialog.component.html',
  styleUrl: './track-list-dialog.component.scss'
})
export class TrackListDialogComponent implements OnChanges {
  @Input() isVisible: boolean = false;
  @Input() releaseId: number | null = null;
  @Input() releaseTitle: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  songs: Song[] = [];
  loadingSongs = false;
  showSongForm = false;
  editingSong: Song | null = null;
  submittingSong = false;
  isAdmin = false;

  constructor(
    private songService: SongService,
    private authService: AuthService
  ) {
    this.isAdmin = this.authService.isAdmin();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        // Modal opened - prevent scrolling
        document.body.classList.add('modal-open');
        if (this.releaseId) {
          this.loadSongs();
        }
      } else {
        // Modal closed - restore scrolling
        document.body.classList.remove('modal-open');
      }
    }
  }

  loadSongs(): void {
    if (!this.releaseId) return;

    this.loadingSongs = true;
    this.songService.getSongsByRelease(this.releaseId).subscribe({
      next: (response) => {
        this.songs = response.songs;
        this.loadingSongs = false;
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.loadingSongs = false;
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load songs'
        });
      }
    });
  }

  onAddSong(): void {
    this.editingSong = null;
    this.showSongForm = true;
  }

  onEditSong(song: Song): void {
    this.editingSong = song;
    this.showSongForm = true;
  }

  onDeleteSong(song: Song): void {
    if (!song.id) return;

    this.songService.deleteSong(song.id).subscribe({
      next: () => {
        this.alertMessage.emit({
          type: 'success',
          message: 'Song deleted successfully'
        });
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error deleting song:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to delete song'
        });
      }
    });
  }

  onUploadAudio(song: Song): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav,audio/wav,audio/x-wav';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file && song.id) {
        // Validate file type
        if (!file.type.includes('wav') && !file.name.toLowerCase().endsWith('.wav')) {
          this.alertMessage.emit({
            type: 'error',
            message: 'Only WAV files are allowed for audio masters'
          });
          return;
        }
        this.uploadAudioFile(song.id, file);
      }
    };
    input.click();
  }

  private uploadAudioFile(songId: number, file: File): void {
    this.songService.uploadAudio(songId, file).subscribe({
      next: () => {
        this.alertMessage.emit({
          type: 'success',
          message: 'Audio file uploaded successfully'
        });
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error uploading audio:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to upload audio file'
        });
      }
    });
  }

  onSongFormSubmit(songData: any): void {
    this.submittingSong = true;

    if (this.editingSong && this.editingSong.id) {
      // Update existing song
      this.songService.updateSong(this.editingSong.id, songData).subscribe({
        next: () => {
          this.submittingSong = false;
          this.showSongForm = false;
          this.alertMessage.emit({
            type: 'success',
            message: 'Song updated successfully'
          });
          this.loadSongs();
        },
        error: (error) => {
          console.error('Error updating song:', error);
          this.submittingSong = false;
          this.alertMessage.emit({
            type: 'error',
            message: 'Failed to update song'
          });
        }
      });
    } else {
      // Create new song
      this.songService.createSong(songData).subscribe({
        next: () => {
          this.submittingSong = false;
          this.showSongForm = false;
          this.alertMessage.emit({
            type: 'success',
            message: 'Song added successfully'
          });
          this.loadSongs();
        },
        error: (error) => {
          console.error('Error creating song:', error);
          this.submittingSong = false;
          this.alertMessage.emit({
            type: 'error',
            message: 'Failed to create song'
          });
        }
      });
    }
  }

  onSongFormClose(): void {
    this.showSongForm = false;
    this.editingSong = null;
  }

  onReorderSongs(reorderedSongs: Song[]): void {
    if (!this.releaseId) return;

    const songIds = reorderedSongs.map(s => s.id).filter((id): id is number => id !== undefined);
    this.songService.reorderSongs(this.releaseId, songIds).subscribe({
      next: () => {
        this.alertMessage.emit({
          type: 'success',
          message: 'Songs reordered successfully'
        });
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error reordering songs:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to reorder songs'
        });
        this.loadSongs(); // Reload to revert changes
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
