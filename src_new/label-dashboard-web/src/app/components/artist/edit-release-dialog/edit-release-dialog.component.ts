import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Artist } from '../artist-selection/artist-selection.component';
import { ArtistRelease } from '../artist-releases-tab/artist-releases-tab.component';
import { ReleaseFormComponent, ReleaseFormSubmitData } from '../release-form/release-form.component';
import { ReleaseService } from '../../../services/release.service';
import { SongService, Song } from '../../../services/song.service';
import { AuthService } from '../../../services/auth.service';
import { ReleaseValidationService, ValidationResult } from '../../../services/release-validation.service';

@Component({
    selector: 'app-edit-release-dialog',
    imports: [CommonModule, ReleaseFormComponent],
    templateUrl: './edit-release-dialog.component.html',
    styleUrl: './edit-release-dialog.component.scss'
})
export class EditReleaseDialogComponent implements OnChanges {
  @Input() isVisible: boolean = false;
  @Input() artist: Artist | null = null;
  @Input() editingRelease: ArtistRelease | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() releaseUpdated = new EventEmitter<any>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  loading = false;
  songs: Song[] = [];
  loadingSongs = false;
  showSongForm = false;
  editingSong: Song | null = null;
  submittingSong = false;
  selectedSongForAudio: Song | null = null;
  isAdmin = false;

  @ViewChild(ReleaseFormComponent) releaseFormComponent!: ReleaseFormComponent;

  constructor(
    private releaseService: ReleaseService,
    private songService: SongService,
    private authService: AuthService,
    private validationService: ReleaseValidationService
  ) {
    this.isAdmin = this.authService.isAdmin();
  }

  // For non-admin users on non-draft releases, editing is restricted
  isRestrictedMode(): boolean {
    // Can't be restricted if there's no release being edited
    if (!this.editingRelease) {
      return false;
    }
    return !this.isAdmin && this.editingRelease.status !== 'Draft';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        // Modal opened - prevent scrolling
        document.body.classList.add('modal-open');
        if (this.editingRelease) {
          this.loadSongs();
        }
      } else {
        // Modal closed - restore scrolling
        document.body.classList.remove('modal-open');
      }
    }
  }

  loadSongs(): void {
    if (!this.editingRelease) return;

    this.loadingSongs = true;
    this.songService.getSongsByRelease(this.editingRelease.id).subscribe({
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

  onUploadAudio(song: Song): void {
    this.selectedSongForAudio = song;
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

  onReorderSongs(reorderedSongs: Song[]): void {
    if (!this.editingRelease) return;

    const songIds = reorderedSongs.map(song => song.id).filter((id): id is number => id !== undefined);

    this.songService.reorderSongs(this.editingRelease.id, songIds).subscribe({
      next: (response) => {
        this.songs = response.songs;
        this.alertMessage.emit({
          type: 'success',
          message: 'Track order updated successfully'
        });
      },
      error: (error) => {
        console.error('Error reordering songs:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to update track order'
        });
        // Reload songs to restore original order
        this.loadSongs();
      }
    });
  }

  onFormSubmit(submitData: ReleaseFormSubmitData): void {
    if (!this.editingRelease) {
      this.alertMessage.emit({
        type: 'error',
        message: 'No release data to update'
      });
      return;
    }

    this.loading = true;
    
    this.releaseService.updateRelease(this.editingRelease.id, submitData.formData).subscribe({
      next: (response) => {
        this.loading = false;
        this.alertMessage.emit({
          type: 'success',
          message: 'Release updated successfully!'
        });
        this.releaseUpdated.emit(response.release);
        this.onClose();
      },
      error: (error) => {
        this.loading = false;
        console.error('Release update error:', error);
        this.alertMessage.emit({
          type: 'error',
          message: error.error?.error || 'Failed to update release. Please try again.'
        });
      }
    });
  }

  onFormCancel(): void {
    this.onClose();
  }

  onFormAlert(alert: {type: 'success' | 'error', message: string}): void {
    this.alertMessage.emit(alert);
  }

  onSubmitFromButton(): void {
    if (this.releaseFormComponent) {
      this.releaseFormComponent.submitForm();
    }
  }

  get isFormValid(): boolean {
    return this.releaseFormComponent?.isFormValid ?? false;
  }

  get validation(): ValidationResult {
    return this.validationService.validateRelease(this.editingRelease);
  }

  get validationErrors() {
    return this.validation.errors;
  }

  get validationWarnings() {
    return this.validation.warnings;
  }

  onClose(): void {
    this.close.emit();
  }
}