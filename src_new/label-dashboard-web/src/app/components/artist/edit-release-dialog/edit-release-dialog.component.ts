import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Artist } from '../artist-selection/artist-selection.component';
import { ArtistRelease } from '../artist-releases-tab/artist-releases-tab.component';
import { ReleaseFormComponent, ReleaseFormSubmitData } from '../release-form/release-form.component';
import { ReleaseService } from '../../../services/release.service';

@Component({
  selector: 'app-edit-release-dialog',
  standalone: true,
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
  
  @ViewChild(ReleaseFormComponent) releaseFormComponent!: ReleaseFormComponent;

  constructor(private releaseService: ReleaseService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        // Modal opened - prevent scrolling
        document.body.classList.add('modal-open');
      } else {
        // Modal closed - restore scrolling
        document.body.classList.remove('modal-open');
      }
    }
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

  onClose(): void {
    this.close.emit();
  }
}