import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Artist } from '../../../artist/artist-selection/artist-selection.component';
import { ArtistRelease } from '../../../artist/artist-releases-tab/artist-releases-tab.component';
import { ReleaseService } from '../../../../services/release.service';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { ReleaseValidationService, ValidationResult } from '../../../../services/release-validation.service';
import { QuillModule } from 'ngx-quill';

export interface AlbumCreditsData {
  liner_notes: string;
  artists: any[];
}

@Component({
    selector: 'app-album-credits-section',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, QuillModule],
    templateUrl: './album-credits-section.component.html',
    styleUrl: './album-credits-section.component.scss'
})
export class AlbumCreditsSectionComponent implements OnInit, OnChanges {
  @Input() artist: Artist | null = null;
  @Input() editingRelease: ArtistRelease | null = null;

  @Output() formDataChange = new EventEmitter<AlbumCreditsData>();
  @Output() validityChange = new EventEmitter<boolean>();
  @Output() validationChange = new EventEmitter<ValidationResult>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() creditsSaved = new EventEmitter<AlbumCreditsData>();

  creditsForm: FormGroup;
  isAdmin = false;
  allArtists: Artist[] = [];
  loadingArtists = false;
  savingCredits = false;
  isInitialized = false;

  quillConfig = {
    toolbar: [
      ['bold', 'italic'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  // Character limits for rich text fields (visible characters, not HTML)
  linerNotesCharLimit = 3000;
  linerNotesCharCount = 0;

  onLinerNotesContentChanged(event: any): void {
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.linerNotesCharCount = text.length;
  }

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private releaseService: ReleaseService,
    private authService: AuthService,
    private validationService: ReleaseValidationService
  ) {
    this.isAdmin = this.authService.isAdmin();
    this.creditsForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadAllArtists();
    this.setupFormSubscriptions();
    
    // Only emit initial validity if not editing (for new releases)
    if (!this.editingRelease) {
      this.isInitialized = true;
      this.emitValidity();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingRelease'] && this.editingRelease) {
      this.populateFormForEditing();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      liner_notes: [''],
      royaltyArtists: this.fb.array([])
    });
  }

  private setupFormSubscriptions(): void {
    this.creditsForm.valueChanges.subscribe(() => {
      this.emitValidity();
    });
  }

  private emitFormData(): void {
    const formValue = this.creditsForm.getRawValue(); // Use getRawValue to include disabled controls
    const formData: AlbumCreditsData = {
      liner_notes: formValue.liner_notes || '',
      artists: formValue.royaltyArtists?.map((artist: any) => ({
        artist_id: artist.artist_id,
        artist_name: this.getArtistName(artist.artist_id),
        // Convert from display percentage (0-100) to decimal (0-1) for storage/API
        streaming_royalty_percentage: (artist.streaming_royalty_percentage || 0) / 100,
        sync_royalty_percentage: (artist.sync_royalty_percentage || 0) / 100,
        download_royalty_percentage: (artist.download_royalty_percentage || 0) / 100,
        physical_royalty_percentage: (artist.physical_royalty_percentage || 0) / 100
      })) || []
    };
    this.formDataChange.emit(formData);
    this.emitValidation(formData);
  }

  private emitValidation(formData: AlbumCreditsData): void {
    // Only emit validation if component is initialized
    if (!this.isInitialized) return;
    
    // Use the specific album credits validation
    const validation = this.validationService.validateAlbumCredits(formData);
    this.validationChange.emit(validation);
  }

  private emitValidity(): void {
    this.validityChange.emit(this.creditsForm.valid);
  }

  private loadAllArtists(): void {
    this.loadingArtists = true;
    this.apiService.getArtists().subscribe({
      next: (response: any) => {
        this.allArtists = response.artists || [];
        this.loadingArtists = false;
      },
      error: (error: any) => {
        console.error('Error loading artists:', error);
        this.loadingArtists = false;
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load artists'
        });
      }
    });
  }

  private populateFormForEditing(): void {
    if (!this.editingRelease) return;

    this.creditsForm.patchValue({
      liner_notes: this.editingRelease.liner_notes || ''
    });

    // Clear existing artists
    const artistsArray = this.creditsForm.get('royaltyArtists') as FormArray;
    while (artistsArray.length > 0) {
      artistsArray.removeAt(0);
    }

    // Add all artists from the release
    if (this.editingRelease.artists && this.editingRelease.artists.length > 0) {
      this.editingRelease.artists.forEach(artist => {
        this.addRoyaltyArtist(artist as unknown as Artist, artist.ReleaseArtist);
      });
    }

    // Emit validation after populating form
    this.emitFormData();
    this.emitValidity();
    
    // Mark as initialized after populating editing data
    this.isInitialized = true;
  }

  private addRoyaltyArtist(artist: any, royaltyData?: any): void {
    if (!artist || !artist.id) {
      console.error('Cannot add artist to form: artist or artist.id is missing', artist);
      return;
    }

    const artistsArray = this.creditsForm.get('royaltyArtists') as FormArray;

    // Calculate default percentage for non-admins (50% divided by number of artists)
    const defaultPercentage = this.isAdmin ? 0.5 : (0.5 / (artistsArray.length + 1));

    const artistGroup = this.fb.group({
      artist_id: [artist.id, Validators.required],
      streaming_royalty_percentage: [(royaltyData?.streaming_royalty_percentage || defaultPercentage) * 100, [Validators.min(0), Validators.max(100)]],
      sync_royalty_percentage: [(royaltyData?.sync_royalty_percentage || defaultPercentage) * 100, [Validators.min(0), Validators.max(100)]],
      download_royalty_percentage: [(royaltyData?.download_royalty_percentage || defaultPercentage) * 100, [Validators.min(0), Validators.max(100)]],
      physical_royalty_percentage: [(royaltyData?.physical_royalty_percentage || defaultPercentage) * 100, [Validators.min(0), Validators.max(100)]]
    });

    // Disable percentage controls for non-admins
    if (!this.isAdmin) {
      artistGroup.get('streaming_royalty_percentage')?.disable();
      artistGroup.get('sync_royalty_percentage')?.disable();
      artistGroup.get('download_royalty_percentage')?.disable();
      artistGroup.get('physical_royalty_percentage')?.disable();
    }

    // Disable artist selection for all artists (read-only)
    artistGroup.get('artist_id')?.disable();

    artistsArray.push(artistGroup);

    // Recalculate percentages for non-admins after adding, but only if no royalty data was provided
    // (royalty data means this is from saved data, so don't recalculate)
    if (!this.isAdmin && !royaltyData) {
      this.recalculateNonAdminPercentages();
    }
  }

  get royaltyArtists(): FormArray {
    return this.creditsForm.get('royaltyArtists') as FormArray;
  }

  get canModifyArtists(): boolean {
    return this.isAdmin || this.editingRelease?.status === 'Draft';
  }

  getArtistName(artistId: any): string {
    if (!artistId) return '';

    // Convert to number if it's a string
    const id = typeof artistId === 'string' ? parseInt(artistId, 10) : artistId;

    // First try to find in allArtists
    let artist = this.allArtists.find(a => a.id === id);
    if (artist) return artist.name;

    // If not found in allArtists, try to find in editingRelease artists
    if (this.editingRelease?.artists) {
      const releaseArtist = this.editingRelease.artists.find(a => a.id === id);
      if (releaseArtist) return releaseArtist.name;
    }

    return 'Unknown Artist';
  }

  private recalculateNonAdminPercentages(): void {
    if (this.isAdmin) return;

    const artistsArray = this.creditsForm.get('royaltyArtists') as FormArray;
    const numArtists = artistsArray.length;
    const percentagePerArtist = 50 / numArtists; // 50% total divided by number of artists

    artistsArray.controls.forEach((control) => {
      control.get('streaming_royalty_percentage')?.setValue(percentagePerArtist);
      control.get('sync_royalty_percentage')?.setValue(percentagePerArtist);
      control.get('download_royalty_percentage')?.setValue(percentagePerArtist);
      control.get('physical_royalty_percentage')?.setValue(percentagePerArtist);
    });
  }

  addRoyaltyArtistFromUI(): void {
    // Add an empty artist entry
    const artistsArray = this.creditsForm.get('royaltyArtists') as FormArray;
    const newArtistGroup = this.fb.group({
      artist_id: ['', Validators.required],
      streaming_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      sync_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      download_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      physical_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]]
    });

    // Disable percentage controls for non-admins
    if (!this.isAdmin) {
      newArtistGroup.get('streaming_royalty_percentage')?.disable();
      newArtistGroup.get('sync_royalty_percentage')?.disable();
      newArtistGroup.get('download_royalty_percentage')?.disable();
      newArtistGroup.get('physical_royalty_percentage')?.disable();
    }

    // Artist selection is enabled initially for new artists, disabled for existing ones
    // newArtistGroup.get('artist_id')?.disable();

    artistsArray.push(newArtistGroup);

    // Recalculate percentages for non-admins after adding
    if (!this.isAdmin) {
      this.recalculateNonAdminPercentages();
    }
  }

  removeRoyaltyArtist(index: number): void {
    const artistsArray = this.creditsForm.get('royaltyArtists') as FormArray;
    if (artistsArray.length > 1) {
      artistsArray.removeAt(index);
      // Recalculate percentages for non-admins after removing
      if (!this.isAdmin) {
        this.recalculateNonAdminPercentages();
      }
    }
  }

  getAvailableArtists(currentIndex: number): Artist[] {
    const currentArtistId = this.royaltyArtists.controls[currentIndex]?.get('artist_id')?.value;
    const selectedArtistIds = this.royaltyArtists.controls
      .map((control, index) => index !== currentIndex ? control.get('artist_id')?.value : null)
      .filter(id => id);

    return this.allArtists.filter(artist =>
      !selectedArtistIds.includes(artist.id) || artist.id === currentArtistId
    );
  }

  getRoyaltyTotal(type: 'streaming' | 'sync' | 'download' | 'physical'): number {
    return this.royaltyArtists.controls.reduce((total, control) => {
      return total + (control.get(`${type}_royalty_percentage`)?.value || 0);
    }, 0);
  }

  getLabelRoyalty(type: 'streaming' | 'sync' | 'download' | 'physical'): number {
    return 100 - this.getRoyaltyTotal(type);
  }

  async saveCredits(): Promise<void> {
    if (!this.editingRelease?.id || this.savingCredits) {
      return;
    }

    if (!this.creditsForm.valid) {
      this.alertMessage.emit({
        type: 'error',
        message: 'Please fix the form errors before saving.'
      });
      return;
    }

    this.savingCredits = true;

    try {
      const formData = this.creditsForm.getRawValue(); // Use getRawValue to include disabled controls
      const validArtists = formData.royaltyArtists
        ?.filter((artist: any) => artist.artist_id && artist.artist_id !== '') || [];

      if (validArtists.length === 0) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Please add at least one artist with valid selections.'
        });
        return;
      }

      const updateData = {
        liner_notes: formData.liner_notes || '',
        artists: validArtists.map((artist: any) => ({
          artist_id: parseInt(artist.artist_id),
          streaming_royalty_percentage: (artist.streaming_royalty_percentage || 0) / 100,
          sync_royalty_percentage: (artist.sync_royalty_percentage || 0) / 100,
          download_royalty_percentage: (artist.download_royalty_percentage || 0) / 100,
          physical_royalty_percentage: (artist.physical_royalty_percentage || 0) / 100
        }))
      };
      await this.releaseService.updateRelease(this.editingRelease.id, updateData).toPromise();

      this.alertMessage.emit({
        type: 'success',
        message: 'Album credits saved successfully!'
      });

      // Emit the saved data in the same format as form data (with artist names)
      const savedData: AlbumCreditsData = {
        liner_notes: formData.liner_notes || '',
        artists: validArtists.map((artist: any) => ({
          artist_id: artist.artist_id,
          artist_name: this.getArtistName(artist.artist_id),
          streaming_royalty_percentage: (artist.streaming_royalty_percentage || 0) / 100,
          sync_royalty_percentage: (artist.sync_royalty_percentage || 0) / 100,
          download_royalty_percentage: (artist.download_royalty_percentage || 0) / 100,
          physical_royalty_percentage: (artist.physical_royalty_percentage || 0) / 100
        }))
      };
      this.creditsSaved.emit(savedData);

      // Note: emitFormData() is not called here to avoid repopulating with stale editingRelease data
      // The parent component will reload the data and update accordingly

    } catch (error: any) {
      console.error('Error saving album credits:', error);
      this.alertMessage.emit({
        type: 'error',
        message: error.error?.error || 'Failed to save album credits. Please try again.'
      });
    } finally {
      this.savingCredits = false;
    }
  }
}