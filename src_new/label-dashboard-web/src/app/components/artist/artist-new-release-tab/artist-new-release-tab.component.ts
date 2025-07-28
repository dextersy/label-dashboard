import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Artist } from '../artist-selection/artist-selection.component';
import { ReleaseFormComponent, ReleaseFormSubmitData } from '../../shared/release-form/release-form.component';
import { ReleaseService } from '../../../services/release.service';

@Component({
  selector: 'app-artist-new-release-tab',
  standalone: true,
  imports: [CommonModule, ReleaseFormComponent],
  templateUrl: './artist-new-release-tab.component.html',
  styleUrl: './artist-new-release-tab.component.scss'
})
export class ArtistNewReleaseTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() releaseCreated = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  loading = false;

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
        this.alertMessage.emit({
          type: 'success',
          message: 'Release created successfully!'
        });
        this.releaseCreated.emit(response.release);
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
}