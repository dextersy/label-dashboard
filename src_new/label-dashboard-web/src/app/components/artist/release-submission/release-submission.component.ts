import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Artist } from '../../artist/artist-selection/artist-selection.component';
import { ReleaseService } from '../../../services/release.service';
import { AuthService } from '../../../services/auth.service';
import { SongService } from '../../../services/song.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService } from '../../../services/confirmation.service';
import { ArtistStateService } from '../../../services/artist-state.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { ReleaseInfoSectionComponent, ReleaseInfoData } from './release-info-section/release-info-section.component';
import { TrackListSectionComponent, TrackListData } from './track-list-section/track-list-section.component';
import { AlbumCreditsSectionComponent, AlbumCreditsData } from './album-credits-section/album-credits-section.component';
import { SubmissionSectionComponent } from './submission-section/submission-section.component';
import { ValidationResult } from '../../../services/release-validation.service';
import { ReleaseValidationService } from '../../../services/release-validation.service';
import { ReleaseSubmittedService } from '../../../services/release-submitted.service';

export type ReleaseSubmissionSection = 'info' | 'credits' | 'tracks' | 'submit';

@Component({
    selector: 'app-release-submission',
    imports: [
        CommonModule,
        MatTooltipModule,
        BreadcrumbComponent,
        ReleaseInfoSectionComponent,
        AlbumCreditsSectionComponent,
        TrackListSectionComponent,
        SubmissionSectionComponent
    ],
    templateUrl: './release-submission.component.html',
    styleUrl: './release-submission.component.scss'
})
export class ReleaseSubmissionComponent implements OnInit, OnDestroy {
  artist: Artist | null = null;
  private subscriptions: Subscription = new Subscription();

  private _activeSection: ReleaseSubmissionSection = 'info';
  private sectionFromQueryParam: ReleaseSubmissionSection | null = null;

  get activeSection(): ReleaseSubmissionSection {
    return this._activeSection;
  }

  set activeSection(value: ReleaseSubmissionSection) {
    this._activeSection = value;
    this.cdr.detectChanges();
  }
  isSubmitting = false;
  isEditing = false; // Track if we're editing an existing release

  // Section data
  releaseInfoData: ReleaseInfoData | null = null;
  albumCreditsData: AlbumCreditsData | null = null;
  trackListData: TrackListData | null = null;
  releaseId: number | null = null;
  editingRelease: any = null; // Store the full release data when editing

  // Validation states
  isReleaseInfoValid = false;
  isAlbumCreditsValid = false;
  releaseInfoValidation: ValidationResult | null = null;
  albumCreditsValidation: ValidationResult | null = null;
  trackListValidation: ValidationResult | null = null;

  constructor(
    private releaseService: ReleaseService,
    private authService: AuthService,
    private songService: SongService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private artistStateService: ArtistStateService,
    private validationService: ReleaseValidationService,
    private releaseSubmittedService: ReleaseSubmittedService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to artist state changes
    this.subscriptions.add(
      this.artistStateService.selectedArtist$.subscribe(artist => {
        this.artist = artist;
      })
    );

    // Check for section query parameter synchronously
    const currentQueryParams = this.route.snapshot.queryParams;
    const section = currentQueryParams['section'];
    if (section && ['info', 'credits', 'tracks', 'submit'].includes(section)) {
      this.activeSection = section as ReleaseSubmissionSection;
      this.sectionFromQueryParam = section as ReleaseSubmissionSection;
      this.cdr.detectChanges();
    }

    // Check if we're editing an existing release
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        const releaseId = params['id'];
        if (releaseId) {
          this.loadReleaseForEditing(+releaseId);
        }
      })
    );

    // Also subscribe to query param changes in case they change dynamically
    this.subscriptions.add(
      this.route.queryParams.subscribe(queryParams => {
        const section = queryParams['section'];
        if (section && ['info', 'credits', 'tracks', 'submit'].includes(section)) {
          this.activeSection = section as ReleaseSubmissionSection;
          this.sectionFromQueryParam = section as ReleaseSubmissionSection;
          this.cdr.detectChanges();
        } else if (!section && this.sectionFromQueryParam) {
          // If query param is removed but we had one initially, keep the section
          this.activeSection = this.sectionFromQueryParam;
          this.cdr.detectChanges();
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
          status: response.release.status,
          cover_art: null, // File not returned from API
          cover_art_preview: response.release.cover_art || null,
          artists: response.release.artists || []
        };

        this.albumCreditsData = {
          liner_notes: response.release.liner_notes || '',
          artists: response.release.artists || []
        };
        
        // Mark as valid since we're editing existing data
        this.isReleaseInfoValid = true;
        this.isAlbumCreditsValid = true;
        
        // Start with the section from query params, or default to release info for editing
        this.activeSection = this.sectionFromQueryParam || 'info';

        // Perform initial validation with complete data from single API call
        this.performInitialValidation(response.release, response.release.songs || []);
      },
      error: (error) => {
        console.error('Error loading release for editing:', error);
        this.notificationService.showError('Failed to load release for editing');
        this.router.navigate(['/artist/releases']);
      }
    });
  }



  private performInitialValidation(release: any, songs: any[] = []): void {
    // Validate release info (cover art, description)
    // Note: liner notes validation is handled by album credits validation
    const releaseInfoRelease = { ...release };
    delete releaseInfoRelease.liner_notes; // Remove liner notes so they're not validated here
    this.releaseInfoValidation = this.validationService.validateRelease(releaseInfoRelease, true);

    // Validate album credits (liner notes, royalty percentages)
    // For non-admin users, normalize to 50% split since that's what the form enforces
    const isAdmin = this.authService.isAdmin();
    let normalizedArtists = this.albumCreditsData?.artists?.map((artist: any) => ({
      ...artist,
      streaming_royalty_percentage: (artist.streaming_royalty_percentage || artist.ReleaseArtist?.streaming_royalty_percentage || 0) * 100,
      sync_royalty_percentage: (artist.sync_royalty_percentage || artist.ReleaseArtist?.sync_royalty_percentage || 0) * 100,
      download_royalty_percentage: (artist.download_royalty_percentage || artist.ReleaseArtist?.download_royalty_percentage || 0) * 100,
      physical_royalty_percentage: (artist.physical_royalty_percentage || artist.ReleaseArtist?.physical_royalty_percentage || 0) * 100
    })) || [];

    // For non-admin users, override with 50% split calculation
    if (!isAdmin && normalizedArtists.length > 0) {
      const percentagePerArtist = 50 / normalizedArtists.length; // 50% total divided by number of artists
      normalizedArtists = normalizedArtists.map(artist => ({
        ...artist,
        streaming_royalty_percentage: percentagePerArtist,
        sync_royalty_percentage: percentagePerArtist,
        download_royalty_percentage: percentagePerArtist,
        physical_royalty_percentage: percentagePerArtist
      }));
    }

    const normalizedAlbumCreditsData = {
      liner_notes: this.albumCreditsData?.liner_notes || '',
      artists: normalizedArtists
    };
    this.albumCreditsValidation = this.validationService.validateAlbumCredits(normalizedAlbumCreditsData);

    // Initialize track list data with loaded songs
    this.trackListData = {
      songs: songs,
      validation: {
        hasErrors: false,
        hasWarnings: false,
        errors: [],
        warnings: []
      }
    };

    // Validate track list with the loaded songs
    this.trackListValidation = this.validationService.validateSongs(songs);

    // Trigger change detection to update the UI
    this.cdr.detectChanges();
  }

  private initializeDefaultData(): void {
    this.releaseInfoData = {
      title: '',
      catalog_no: '',
      UPC: '',
      release_date: '',
      description: '',
      status: 'Draft',
      cover_art: null,
      cover_art_preview: null,
      artists: this.artist ? [{
        id: this.artist.id,
        name: this.artist.name,
        role: 'Main Artist'
      }] : []
    };

    this.albumCreditsData = {
      liner_notes: '',
      artists: this.artist ? [{
        artist_id: this.artist.id,
        streaming_royalty_percentage: 50,
        sync_royalty_percentage: 50,
        download_royalty_percentage: 50,
        physical_royalty_percentage: 50
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
    console.log('setActiveSection called with:', section);
    this.activeSection = section;
  }

  onReleaseInfoDataChange(data: ReleaseInfoData): void {
    this.releaseInfoData = data;
  }

  onReleaseInfoValidityChange(isValid: boolean): void {
    this.isReleaseInfoValid = isValid;
  }

  onReleaseInfoValidationChange(validation: ValidationResult): void {
    this.releaseInfoValidation = validation;
  }

  onAlbumCreditsValidationChange(validation: ValidationResult): void {
    this.albumCreditsValidation = validation;
  }

  onTrackListValidationChange(validation: ValidationResult): void {
    this.trackListValidation = validation;
  }

  onAlbumCreditsDataChange(data: AlbumCreditsData): void {
    this.albumCreditsData = data;
  }

  onAlbumCreditsValidityChange(isValid: boolean): void {
    this.isAlbumCreditsValid = isValid;
  }

  onAlbumCreditsSaved(data: AlbumCreditsData): void {
    this.albumCreditsData = data;

    // Update editingRelease with the saved liner notes and artists
    if (this.editingRelease) {
      // Create a new editingRelease object to trigger ngOnChanges
      this.editingRelease = {
        ...this.editingRelease,
        liner_notes: data.liner_notes,
        artists: data.artists.map(savedArtist => ({
          id: savedArtist.artist_id,
          name: savedArtist.artist_name,
          ReleaseArtist: {
            streaming_royalty_percentage: savedArtist.streaming_royalty_percentage,
            sync_royalty_percentage: savedArtist.sync_royalty_percentage,
            download_royalty_percentage: savedArtist.download_royalty_percentage,
            physical_royalty_percentage: savedArtist.physical_royalty_percentage
          }
        }))
      };
    }

    // The notification is handled by the album-credits-section component
  }  
  
  onReleaseSaved(data: {releaseId: number, releaseData: ReleaseInfoData}): void {
    this.releaseId = data.releaseId;
    this.releaseInfoData = data.releaseData;
    this.isReleaseInfoValid = true; // Mark as valid since it was successfully saved
    
    // Update editingRelease with the saved data so form repopulates correctly when switching sections
    if (this.editingRelease) {
      this.editingRelease = {
        ...this.editingRelease,
        title: data.releaseData.title,
        catalog_no: data.releaseData.catalog_no,
        UPC: data.releaseData.UPC,
        release_date: data.releaseData.release_date,
        description: data.releaseData.description,
        status: data.releaseData.status,
        cover_art: data.releaseData.cover_art_preview || this.editingRelease.cover_art,
        artists: data.releaseData.artists
      };
    }
    
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
    if (!this.releaseId) {
      this.notificationService.showError('Cannot submit release: No release ID found. Please save the release information first.');
      return;
    }

    if (!this.releaseInfoData || !this.trackListData) {
      this.notificationService.showError('Missing required data');
      return;
    }

    // Final confirmation
    const confirmed = await this.confirmationService.confirm({
      title: 'Submit Release',
      message: 'Are you sure you want to submit this release?\n\nOnce submitted, it will be processed for distribution.\n\n⚠️ You won\'t be able to make any changes after this point. You may still contact your label representative if you need to make any changes.',
      confirmText: 'Submit',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) {
      return;
    }

    this.isSubmitting = true;

    try {
      // Update existing release status to "For Submission"
      const response = await this.releaseService.updateRelease(this.releaseId, {
        status: 'For Submission'
      }).toPromise();

      this.isSubmitting = false;

      if (response) {
        // Show the release submitted modal
        this.releaseSubmittedService.show({
          releaseTitle: this.releaseInfoData?.title || 'Release',
          message: 'The release will be processed within the next few days and your label representative might reach out to you if there are any concerns.'
        });
        
        // Navigate back to releases list after a short delay
        setTimeout(() => {
          this.router.navigate(['/artist/releases']);
        }, 3000);
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

  get canProceedToCredits(): boolean {
    // For editing existing releases, always allow proceeding to credits
    // For new releases, only allow after release info has been saved
    return this.isEditing || !!this.releaseId;
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
    // Allow access to submit tab for draft releases, even with validation errors
    return this.isEditing && this.isDraftStatus;
  }

  get isDraftStatus(): boolean {
    return this.releaseInfoData?.status === 'Draft';
  }

  // Section status getters for icons
  get releaseInfoStatus(): 'completed' | 'error' | 'warning' | 'none' {
    if (!this.releaseInfoValidation) return 'none';
    if (this.releaseInfoValidation.hasErrors) return 'error';
    if (this.releaseInfoValidation.hasWarnings) return 'warning';
    return 'completed';
  }

  get albumCreditsStatus(): 'completed' | 'warning' | 'error' | 'none' {
    if (!this.albumCreditsValidation) return 'none';
    if (this.albumCreditsValidation.hasErrors) return 'error';
    if (this.albumCreditsValidation.hasWarnings) return 'warning';
    return 'completed';
  }

  get trackListStatus(): 'completed' | 'warning' | 'error' | 'none' {
    if (!this.trackListValidation) return 'none';
    if (this.trackListValidation.hasErrors) return 'error';
    if (this.trackListValidation.hasWarnings) return 'warning';
    return 'completed';
  }
  get releaseInfoTooltip(): string {
    if (!this.releaseInfoValidation || (!this.releaseInfoValidation.hasErrors && !this.releaseInfoValidation.hasWarnings)) {
      return '';
    }

    const messages: string[] = [];
    this.releaseInfoValidation.errors.forEach(error => messages.push(`❌ ${error.message}`));
    this.releaseInfoValidation.warnings.forEach(warning => messages.push(`⚠️ ${warning.message}`));
    return messages.join('\n');
  }

  get albumCreditsTooltip(): string {
    if (!this.albumCreditsValidation || (!this.albumCreditsValidation.hasErrors && !this.albumCreditsValidation.hasWarnings)) {
      return '';
    }

    const messages: string[] = [];
    this.albumCreditsValidation.errors.forEach(error => messages.push(`❌ ${error.message}`));
    this.albumCreditsValidation.warnings.forEach(warning => messages.push(`⚠️ ${warning.message}`));
    return messages.join('\n');
  }

  get trackListTooltip(): string {
    if (!this.trackListValidation || (!this.trackListValidation.hasErrors && !this.trackListValidation.hasWarnings)) {
      return '';
    }

    const messages: string[] = [];
    this.trackListValidation.errors.forEach(error => messages.push(`❌ ${error.message}`));
    this.trackListValidation.warnings.forEach(warning => messages.push(`⚠️ ${warning.message}`));
    return messages.join('\n');
  }
}