import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Artist } from '../../artist/artist-selection/artist-selection.component';
import { ReleaseService } from '../../../services/release.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService } from '../../../services/confirmation.service';
import { ArtistStateService } from '../../../services/artist-state.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { ReleaseInfoSectionComponent, ReleaseInfoData } from './release-info-section/release-info-section.component';
import { TrackListSectionComponent, TrackListData } from './track-list-section/track-list-section.component';
import { SubmissionSectionComponent } from './submission-section/submission-section.component';

export type ReleaseSubmissionSection = 'info' | 'tracks' | 'submit';

@Component({
    selector: 'app-release-submission',
    imports: [
        CommonModule,
        BreadcrumbComponent,
        ReleaseInfoSectionComponent,
        TrackListSectionComponent,
        SubmissionSectionComponent
    ],
    templateUrl: './release-submission.component.html',
    styleUrl: './release-submission.component.scss'
})
export class ReleaseSubmissionComponent implements OnInit, OnDestroy {
  artist: Artist | null = null;
  private subscriptions: Subscription = new Subscription();

  activeSection: ReleaseSubmissionSection = 'info';
  isSubmitting = false;
  isEditing = false; // Track if we're editing an existing release

  // Section data
  releaseInfoData: ReleaseInfoData | null = null;
  trackListData: TrackListData | null = null;
  releaseId: number | null = null;
  editingRelease: any = null; // Store the full release data when editing

  // Validation states
  isReleaseInfoValid = false;

  constructor(
    private releaseService: ReleaseService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private artistStateService: ArtistStateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Subscribe to artist state changes
    this.subscriptions.add(
      this.artistStateService.selectedArtist$.subscribe(artist => {
        this.artist = artist;
      })
    );

    // Check if we're editing an existing release
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        const releaseId = params['id'];
        if (releaseId) {
          this.loadReleaseForEditing(+releaseId);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadReleaseForEditing(releaseId: number): void {
    this.isEditing = true;
    this.releaseService.getRelease(releaseId).subscribe({
      next: (response) => {
        // Store the full release data for editing
        this.editingRelease = response.release;
        
        // Set the release data for editing
        this.releaseId = releaseId;
        
        // Initialize the form data from the loaded release
        this.releaseInfoData = {
          title: response.release.title,
          catalog_no: response.release.catalog_no || '',
          UPC: response.release.UPC || '',
          release_date: response.release.release_date,
          description: response.release.description || '',
          liner_notes: response.release.liner_notes || '',
          status: response.release.status,
          cover_art: null, // File not returned from API
          cover_art_preview: response.release.cover_art || null,
          artists: response.release.artists || []
        };
        
        // Mark as valid since we're editing existing data
        this.isReleaseInfoValid = true;
        
        // Start with release info section for editing
        this.activeSection = 'info';
      },
      error: (error) => {
        console.error('Error loading release for editing:', error);
        this.notificationService.showError('Failed to load release for editing');
        this.router.navigate(['/artist/releases']);
      }
    });
  }

  private initializeDefaultData(): void {
    this.releaseInfoData = {
      title: '',
      catalog_no: '',
      UPC: '',
      release_date: '',
      description: '',
      liner_notes: '',
      status: 'Draft',
      cover_art: null,
      cover_art_preview: null,
      artists: this.artist ? [{
        id: this.artist.id,
        name: this.artist.name,
        role: 'Main Artist'
      }] : []
    };

    this.trackListData = {
      songs: [],
      validation: {
        hasErrors: false,
        hasWarnings: false,
        errors: [],
        warnings: []
      }
    };
  }

  setActiveSection(section: ReleaseSubmissionSection): void {
    this.activeSection = section;
  }

  onReleaseInfoDataChange(data: ReleaseInfoData): void {
    this.releaseInfoData = data;
  }

  onReleaseInfoValidityChange(isValid: boolean): void {
    this.isReleaseInfoValid = isValid;
  }

  onReleaseSaved(data: {releaseId: number, releaseData: ReleaseInfoData}): void {
    this.releaseId = data.releaseId;
    this.releaseInfoData = data.releaseData;
    this.isReleaseInfoValid = true; // Mark as valid since it was successfully saved
    
    // For new releases, redirect to the edit route to unify the flow
    if (!this.isEditing) {
      this.router.navigate(['/artist/releases/edit', data.releaseId]);
    }
  }

  onTrackListDataChange(data: TrackListData): void {
    this.trackListData = data;
  }

  onAlertMessage(message: {type: 'success' | 'error', message: string}): void {
    if (message.type === 'success') {
      this.notificationService.showSuccess(message.message);
    } else {
      this.notificationService.showError(message.message);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.releaseInfoData || !this.trackListData) {
      this.notificationService.showError('Missing required data');
      return;
    }

    // Final confirmation
    const confirmed = await this.confirmationService.confirm({
      title: 'Submit Release',
      message: 'Are you sure you want to submit this release? Once submitted, it will be processed for distribution.',
      confirmText: 'Submit',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) {
      return;
    }

    this.isSubmitting = true;

    try {
      // Create release data object
      const releaseData: any = {
        title: this.releaseInfoData.title,
        catalog_no: this.releaseInfoData.catalog_no,
        UPC: this.releaseInfoData.UPC || '',
        release_date: this.releaseInfoData.release_date,
        description: this.releaseInfoData.description || '',
        liner_notes: this.releaseInfoData.liner_notes || '',
        status: this.releaseInfoData.status,
        cover_art: this.releaseInfoData.cover_art
      };

      // Add artists if present
      if (this.releaseInfoData.artists && this.releaseInfoData.artists.length > 0) {
        releaseData.artists = this.releaseInfoData.artists.map(artist => ({
          artist_id: artist.id,
          streaming_royalty_percentage: 0,
          sync_royalty_percentage: 0,
          download_royalty_percentage: 0,
          physical_royalty_percentage: 0
        }));
      }

      const response = await this.releaseService.createRelease(releaseData).toPromise();

      this.isSubmitting = false;

      if (response) {
        this.notificationService.showSuccess('Release submitted successfully!');
        // Navigate back to releases list
        this.router.navigate(['/artist/releases']);
      } else {
        throw new Error('No response received');
      }

    } catch (error: any) {
      this.isSubmitting = false;
      console.error('Release submission error:', error);
      this.notificationService.showError(error.error?.error || 'Failed to submit release. Please try again.');
    }
  }

  onCancel(): void {
    // Navigate back to releases list
    this.router.navigate(['/artist/releases']);
  }

  get canProceedToTracks(): boolean {
    // For editing existing releases, always allow proceeding to tracks
    // For new releases, only allow after release info has been saved
    return this.isEditing || !!this.releaseId;
  }

  get isReleaseInfoCompleted(): boolean {
    // Only mark as completed for new releases after saving
    return !this.isEditing && !!this.releaseId;
  }

  get canProceedToSubmit(): boolean {
    return this.canProceedToTracks && !!(this.trackListData?.songs?.length) && this.isDraftStatus;
  }

  get isDraftStatus(): boolean {
    return this.releaseInfoData?.status === 'Draft';
  }
}