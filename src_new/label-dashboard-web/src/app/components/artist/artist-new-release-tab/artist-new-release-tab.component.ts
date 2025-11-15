import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Artist } from '../artist-selection/artist-selection.component';
import { ReleaseFormComponent, ReleaseFormSubmitData } from '../release-form/release-form.component';
import { ReleaseService } from '../../../services/release.service';
import { TrackListDialogComponent } from '../track-list-dialog/track-list-dialog.component';

@Component({
    selector: 'app-artist-new-release-tab',
    imports: [CommonModule, ReleaseFormComponent, TrackListDialogComponent],
    templateUrl: './artist-new-release-tab.component.html',
    styleUrl: './artist-new-release-tab.component.scss'
})
export class ArtistNewReleaseTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() releaseCreated = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  loading = false;
  showTrackListDialog = false;
  createdRelease: any = null;

  constructor(private releaseService: ReleaseService) {}

  onFormSubmit(submitData: ReleaseFormSubmitData): void {
    if (!this.artist) {
      this.alertMessage.emit({
        type: 'error',
        message: 'No artist selected'
      });
      return;
    }

    this.loading = true;
    
    this.releaseService.createRelease(submitData.formData).subscribe({
      next: (response) => {
        this.loading = false;
        this.createdRelease = response.release;
        this.alertMessage.emit({
          type: 'success',
          message: 'Release created successfully!'
        });
        // Show track list dialog
        this.showTrackListDialog = true;
      },
      error: (error) => {
        this.loading = false;
        console.error('Release creation error:', error);
        this.alertMessage.emit({
          type: 'error',
          message: error.error?.error || 'Failed to create release. Please try again.'
        });
      }
    });
  }

  onFormCancel(): void {
    this.cancelled.emit();
  }

  onFormAlert(alert: {type: 'success' | 'error', message: string}): void {
    this.alertMessage.emit(alert);
  }

  onTrackListDialogClose(): void {
    this.showTrackListDialog = false;
    // Emit the created release after track list dialog closes
    if (this.createdRelease) {
      this.releaseCreated.emit(this.createdRelease);
      this.createdRelease = null;
    }
  }

  onSkipTrackList(): void {
    this.showTrackListDialog = false;
    if (this.createdRelease) {
      this.releaseCreated.emit(this.createdRelease);
      this.createdRelease = null;
    }
  }
}