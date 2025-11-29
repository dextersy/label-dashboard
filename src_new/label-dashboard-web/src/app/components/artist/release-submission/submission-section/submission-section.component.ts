import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseInfoData } from '../release-info-section/release-info-section.component';
import { AlbumCreditsData } from '../album-credits-section/album-credits-section.component';
import { TrackListData } from '../track-list-section/track-list-section.component';

@Component({
    selector: 'app-submission-section',
    imports: [CommonModule],
    templateUrl: './submission-section.component.html',
    styleUrl: './submission-section.component.scss'
})
export class SubmissionSectionComponent implements OnChanges {
  @Input() releaseInfoData: ReleaseInfoData | null = null;
  @Input() albumCreditsData: AlbumCreditsData | null = null;
  @Input() trackListData: TrackListData | null = null;
  @Input() isSubmitting = false;

  @Output() submit = new EventEmitter<void>();

  isFormValid = false;

  // Expose Math for template
  Math = Math;

  ngOnChanges(changes: SimpleChanges): void {
    this.checkFormValidity();
  }

  private checkFormValidity(): void {
    // Check if release info is valid
    const hasValidReleaseInfo = this.releaseInfoData &&
      this.releaseInfoData.title &&
      this.releaseInfoData.catalog_no &&
      this.releaseInfoData.release_date;

    // Check if track list has at least one song
    const hasSongs = this.trackListData &&
      this.trackListData.songs &&
      this.trackListData.songs.length > 0;

    // Check if validation passes (no errors)
    const hasNoValidationErrors = this.trackListData &&
      this.trackListData.validation &&
      !this.trackListData.validation.hasErrors;

    this.isFormValid = !!(hasValidReleaseInfo && hasSongs && hasNoValidationErrors);
  }

  onSubmit(): void {
    if (this.isFormValid && !this.isSubmitting) {
      this.submit.emit();
    }
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

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Draft': return 'badge-secondary';
      case 'For Submission': return 'badge-info';
      case 'Pending': return 'badge-warning';
      case 'Live': return 'badge-success';
      case 'Taken Down': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getCollaboratorNames(song: any): string {
    if (!song.collaborators || song.collaborators.length === 0) {
      return '';
    }
    return song.collaborators
      .map((c: any) => c.artist?.name)
      .filter((name: string | undefined) => name)
      .join(', ');
  }
}