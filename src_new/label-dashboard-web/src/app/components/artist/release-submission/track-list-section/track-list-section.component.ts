import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongService, Song } from '../../../../services/song.service';
import { ReleaseService } from '../../../../services/release.service';
import { AuthService } from '../../../../services/auth.service';
import { ReleaseValidationService, ValidationResult } from '../../../../services/release-validation.service';
import { SongListComponent } from '../../../songs/song-list/song-list.component';
import { SongFormComponent } from '../../../songs/song-form/song-form.component';
import { downloadFromResponse } from '../../../../utils/file-utils';
import { ConfirmationService } from '../../../../services/confirmation.service';

export interface TrackListData {
  songs: Song[];
  validation: ValidationResult;
}

@Component({
    selector: 'app-track-list-section',
    imports: [CommonModule, SongListComponent, SongFormComponent],
    templateUrl: './track-list-section.component.html',
    styleUrl: './track-list-section.component.scss'
})
export class TrackListSectionComponent implements OnInit, OnChanges {
  @Input() releaseId: number | null = null;
  @Input() releaseTitle: string = '';
  @Input() releaseCatalogNo: string = '';
  @Input() releaseStatus: string = '';
  @Input() releaseArtists: any[] = [];

  @Output() trackListDataChange = new EventEmitter<TrackListData>();
  @Output() validationChange = new EventEmitter<ValidationResult>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  songs: Song[] = [];
  loadingSongs = false;
  showSongForm = false;
  editingSong: Song | null = null;
  submittingSong = false;
  isAdmin = false;
  uploadProgress: { [songId: number]: number } = {};
  downloadingMasters = false;

  constructor(
    private songService: SongService,
    private releaseService: ReleaseService,
    private authService: AuthService,
    private validationService: ReleaseValidationService,
    private confirmationService: ConfirmationService
  ) {
    this.isAdmin = this.authService.isAdmin();
  }

  ngOnInit(): void {
    // Emit initial state
    this.emitTrackListData();

    if (this.releaseId) {
      this.loadSongs();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['releaseId'] && this.releaseId) {
      this.loadSongs();
    }

    // Emit data when any input changes that affects validation
    if (changes['releaseTitle'] || changes['releaseCatalogNo'] || changes['releaseStatus']) {
      this.emitTrackListData();
    }
  }

  // For non-admin users on non-draft releases, tracklist modifications are restricted
  // This includes: add songs, delete songs, reorder songs, upload audio
  isRestrictedMode(): boolean {
    // If no status or status is Draft, not restricted
    if (!this.releaseStatus || this.releaseStatus === 'Draft') {
      return false;
    }
    return !this.isAdmin;
  }

  loadSongs(): void {
    if (!this.releaseId) return;

    this.loadingSongs = true;
    this.songService.getSongsByRelease(this.releaseId).subscribe({
      next: (response) => {
        this.songs = response.songs;
        this.loadingSongs = false;
        this.emitTrackListData();
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

  async onDeleteSong(song: Song): Promise<void> {
    if (!song.id) return;

    // Show confirmation dialog with warning about master file deletion
    const songTitle = song.title || 'this track';
    const confirmMessage = `Are you sure you want to delete "${songTitle}"?\n\n` +
      `⚠️ WARNING: This will permanently delete the master audio file and cannot be undone.\n\n` +
      `The following will be deleted:\n` +
      `• Track metadata (title, artists, ISRC, etc.)\n` +
      `• Master audio file (WAV)\n` +
      `• All associated data\n\n` +
      `💡 IMPORTANT: Make sure you have a copy of the master audio file before proceeding.\n\n` +
      `This action is PERMANENT and IRREVERSIBLE.`;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Track',
      message: confirmMessage,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) {
      return; // User cancelled
    }

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
    this.uploadProgress[songId] = 0;

    this.songService.uploadAudio(songId, file).subscribe({
      next: (event) => {
        if (event.type === 1) { // HttpEventType.UploadProgress
          // Calculate and update progress percentage
          if (event.total) {
            this.uploadProgress[songId] = Math.round((100 * event.loaded) / event.total);
          }
        } else if (event.type === 4) { // HttpEventType.Response
          // Upload complete
          delete this.uploadProgress[songId];
          this.alertMessage.emit({
            type: 'success',
            message: 'Audio file uploaded successfully'
          });
          this.loadSongs();
        }
      },
      error: (error) => {
        delete this.uploadProgress[songId];
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

  onDownloadMasters(): void {
    if (!this.releaseId || this.downloadingMasters) {
      return;
    }

    this.downloadingMasters = true;

    this.releaseService.downloadMasters(this.releaseId).subscribe({
      next: (response) => {
        this.downloadingMasters = false;

        // Download using filename from server's Content-Disposition header
        downloadFromResponse(response);

        this.alertMessage.emit({
          type: 'success',
          message: 'Masters downloaded successfully!'
        });
      },
      error: (error) => {
        console.error('Error downloading masters:', error);
        this.downloadingMasters = false;

        let errorMessage = 'Failed to download masters.';
        if (error.status === 404) {
          errorMessage = 'No masters available for this release.';
        }

        this.alertMessage.emit({
          type: 'error',
          message: errorMessage
        });
      }
    });
  }

  private emitTrackListData(): void {
    const trackListData: TrackListData = {
      songs: this.songs,
      validation: this.validation
    };
    this.trackListDataChange.emit(trackListData);
    this.validationChange.emit(this.validation);
  }

  get validation(): ValidationResult {
    // Only validate songs
    return this.validationService.validateSongs(this.songs);
  }

  get validationErrors() {
    return this.validation.errors;
  }

  get validationWarnings() {
    return this.validation.warnings;
  }
}