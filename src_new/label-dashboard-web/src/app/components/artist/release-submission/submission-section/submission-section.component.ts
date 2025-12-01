import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReleaseInfoData } from '../release-info-section/release-info-section.component';
import { AlbumCreditsData } from '../album-credits-section/album-credits-section.component';
import { TrackListData } from '../track-list-section/track-list-section.component';
import { ValidationResult } from '../../../../services/release-validation.service';
import { AuthService } from '../../../../services/auth.service';

export type ReleaseSubmissionSection = 'info' | 'credits' | 'tracks' | 'submit';

@Component({
    selector: 'app-submission-section',
    imports: [CommonModule, FormsModule],
    templateUrl: './submission-section.component.html',
    styleUrl: './submission-section.component.scss'
})
export class SubmissionSectionComponent implements OnChanges {
  @Input() releaseInfoData: ReleaseInfoData | null = null;
  @Input() albumCreditsData: AlbumCreditsData | null = null;
  @Input() trackListData: TrackListData | null = null;
  @Input() releaseInfoValidation: ValidationResult | null = null;
  @Input() albumCreditsValidation: ValidationResult | null = null;
  @Input() trackListValidation: ValidationResult | null = null;
  @Input() isSubmitting = false;

  @Output() submit = new EventEmitter<void>();
  @Output() navigateToSection = new EventEmitter<ReleaseSubmissionSection>();

  isFormValid = false;
  allErrors: string[] = [];
  allWarnings: string[] = [];
  hasAcknowledged = false;
  isAdmin = false;

  // Expose Math for template
  Math = Math;

  constructor(private authService: AuthService) {
    this.isAdmin = this.authService.isAdmin();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.checkFormValidity();
  }

  private checkFormValidity(): void {
    this.allErrors = [];
    this.allWarnings = [];

    // Collect errors and warnings from all sections
    if (this.releaseInfoValidation) {
      if (this.releaseInfoValidation.errors) {
        this.allErrors.push(...this.releaseInfoValidation.errors.map(e => e.message));
      }
      if (this.releaseInfoValidation.warnings) {
        this.allWarnings.push(...this.releaseInfoValidation.warnings.map(w => w.message));
      }
    }

    if (this.albumCreditsValidation) {
      if (this.albumCreditsValidation.errors) {
        this.allErrors.push(...this.albumCreditsValidation.errors.map(e => e.message));
      }
      if (this.albumCreditsValidation.warnings) {
        this.allWarnings.push(...this.albumCreditsValidation.warnings.map(w => w.message));
      }
    }

    if (this.trackListValidation) {
      if (this.trackListValidation.errors) {
        this.allErrors.push(...this.trackListValidation.errors.map(e => e.message));
      }
      if (this.trackListValidation.warnings) {
        this.allWarnings.push(...this.trackListValidation.warnings.map(w => w.message));
      }
    }

    // Check if release info is valid
    const hasValidReleaseInfo = this.releaseInfoData &&
      this.releaseInfoData.title &&
      this.releaseInfoData.catalog_no &&
      this.releaseInfoData.release_date;

    // Check if track list has at least one song
    const hasSongs = this.trackListData &&
      this.trackListData.songs &&
      this.trackListData.songs.length > 0;

    // Form is valid only if there are no errors (warnings are allowed)
    this.isFormValid = !!(hasValidReleaseInfo && hasSongs && this.allErrors.length === 0);
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

  onNavigateToSection(section: string): void {
    // Type assertion since we know the valid section values
    this.navigateToSection.emit(section as ReleaseSubmissionSection);
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