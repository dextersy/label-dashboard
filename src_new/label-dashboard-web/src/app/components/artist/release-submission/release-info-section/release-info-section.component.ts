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

export interface ReleaseInfoData {
  title: string;
  catalog_no: string;
  UPC: string;
  release_date: string;
  description: string;
  status: string;
  cover_art: File | null;
  cover_art_preview: string | null;
  artists: any[];
}

@Component({
    selector: 'app-release-info-section',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, QuillModule],
    templateUrl: './release-info-section.component.html',
    styleUrl: './release-info-section.component.scss'
})
export class ReleaseInfoSectionComponent implements OnInit, OnChanges {
  @Input() artist: Artist | null = null;
  @Input() editingRelease: ArtistRelease | null = null;
  @Input() showStatus: boolean = true;
  @Input() generateCatalogNumber: boolean = true;

  @Output() formDataChange = new EventEmitter<ReleaseInfoData>();
  @Output() validityChange = new EventEmitter<boolean>();
  @Output() validationChange = new EventEmitter<ValidationResult>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() releaseSaved = new EventEmitter<{releaseId: number, releaseData: ReleaseInfoData}>();

  releaseForm: FormGroup;
  isAdmin = false;
  selectedCoverArt: File | null = null;
  coverArtPreview: string | null = null;
  defaultCatalogNumber = '';
  allArtists: Artist[] = [];
  loadingArtists = false;
  savingRelease = false;

  quillConfig = {
    toolbar: [
      ['bold', 'italic'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  // Character limits for rich text fields (visible characters, not HTML)
  descriptionCharLimit = 2000;
  descriptionCharCount = 0;

  onDescriptionContentChanged(event: any): void {
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.descriptionCharCount = text.length;
  }

  constructor(
    private fb: FormBuilder,
    private releaseService: ReleaseService,
    private authService: AuthService,
    private apiService: ApiService,
    private validationService: ReleaseValidationService
  ) {
    this.releaseForm = this.createForm();
  }

  // For non-admin users on non-draft releases, only these fields remain editable:
  // - Release form: description, liner_notes
  // All other fields should have [readonly]="isRestrictedMode()" or [disabled]="isRestrictedMode()" applied
  isRestrictedMode(): boolean {
    // Can't be restricted if there's no release being edited (creating new release)
    if (!this.editingRelease) {
      return false;
    }
    return !this.isAdmin && this.editingRelease.status !== 'Draft';
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadAllArtists();

    if (this.generateCatalogNumber && !this.editingRelease) {
      this.loadDefaultCatalogNumber();
    }

    // If we already have editingRelease data on init, populate the form
    if (this.editingRelease) {
      this.populateFormForEditing();
    }

    // Subscribe to form changes for validation only (don't emit form data)
    this.releaseForm.valueChanges.subscribe(() => {
      this.emitValidity();
    });

    // Initial validity emit
    this.emitValidity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingRelease'] && this.editingRelease) {
      this.populateFormForEditing();
    }
    
    if (changes['artist'] && this.artist && !this.editingRelease) {
      // Add the artist to the form if it's not already there
      const artistsArray = this.releaseForm.get('artists') as FormArray;
      if (artistsArray.length === 0) {
        this.addArtistToForm(this.artist);
      }
    }
  }

  private createForm(): FormGroup {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return this.fb.group({
      title: ['', Validators.required],
      catalog_no: [''], // Not required - will be auto-generated if empty
      UPC: [''],
      release_date: [today, Validators.required], // Default to today
      description: [''],
      status: ['Draft'],
      artists: this.fb.array([])
    });
  }

  private emitFormData(): void {
    const formData: ReleaseInfoData = {
      title: this.releaseForm.get('title')?.value || '',
      catalog_no: this.releaseForm.get('catalog_no')?.value || '',
      UPC: this.releaseForm.get('UPC')?.value || '',
      release_date: this.releaseForm.get('release_date')?.value || '',
      description: this.releaseForm.get('description')?.value || '',
      status: this.releaseForm.get('status')?.value || 'Draft',
      cover_art: this.selectedCoverArt,
      cover_art_preview: this.coverArtPreview,
      artists: this.releaseForm.get('artists')?.value || []
    };
    this.formDataChange.emit(formData);
    this.emitValidation();
  }

  private emitValidation(): void {
    // Create a partial ArtistRelease object for validation
    const partialRelease: Partial<ArtistRelease> = {
      title: this.releaseForm.get('title')?.value || '',
      catalog_no: this.releaseForm.get('catalog_no')?.value || '',
      UPC: this.releaseForm.get('UPC')?.value || '',
      release_date: this.releaseForm.get('release_date')?.value || '',
      description: this.releaseForm.get('description')?.value || '',
      status: this.releaseForm.get('status')?.value || 'Draft',
      cover_art: this.coverArtPreview || (this.selectedCoverArt ? 'temp' : undefined), // Use preview or indicate file selected
      artists: this.releaseForm.get('artists')?.value || []
    };

    const validation = this.validationService.validateRelease(partialRelease as ArtistRelease, true);
    this.validationChange.emit(validation);
  }

  private emitValidity(): void {
    // Check both form validity and cover art requirement
    const hasCoverArt = this.selectedCoverArt !== null || (this.coverArtPreview !== null && this.coverArtPreview !== '');
    const isValid = this.releaseForm.valid && hasCoverArt;
    this.validityChange.emit(isValid);
  }

  hasCoverArt(): boolean {
    return this.selectedCoverArt !== null || (this.coverArtPreview !== null && this.coverArtPreview !== '');
  }

  private loadAllArtists(): void {
    this.loadingArtists = true;
    this.apiService.getArtists().subscribe({
      next: (response: any) => {
        this.allArtists = response.artists || [];
        this.loadingArtists = false;

        // If we have an artist input, add it to the form
        if (this.artist) {
          this.addArtistToForm(this.artist);
        }
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

  private loadDefaultCatalogNumber(): void {
    this.releaseService.generateCatalogNumber().subscribe({
      next: (response: any) => {
        this.defaultCatalogNumber = response.catalog_number;
        if (!this.releaseForm.get('catalog_no')?.value) {
          this.releaseForm.patchValue({ catalog_no: this.defaultCatalogNumber });
        }
      },
      error: (error: any) => {
        console.error('Error loading default catalog number:', error);
      }
    });
  }

  private populateFormForEditing(): void {
    if (!this.editingRelease) return;

    this.releaseForm.patchValue({
      title: this.editingRelease.title,
      catalog_no: this.editingRelease.catalog_no,
      UPC: this.editingRelease.UPC || '',
      release_date: this.editingRelease.release_date,
      description: this.editingRelease.description || '',
      status: this.editingRelease.status
    });

    // Clear existing artists
    const artistsArray = this.releaseForm.get('artists') as FormArray;
    while (artistsArray.length > 0) {
      artistsArray.removeAt(0);
    }

    // Add existing artists
    if (this.editingRelease.artists) {
      this.editingRelease.artists.forEach(artist => {
        this.addArtistToForm(artist);
      });
    }

    // Set cover art preview if exists
    if (this.editingRelease.cover_art) {
      this.coverArtPreview = this.editingRelease.cover_art;
    }

    // Emit validation after populating form
    this.emitValidation();
  }

  private addArtistToForm(artist: any): void {
    if (!artist || !artist.id) {
      console.error('Cannot add artist to form: artist or artist.id is missing', artist);
      return;
    }
    
    const artistsArray = this.releaseForm.get('artists') as FormArray;
    artistsArray.push(this.fb.group({
      id: [artist.id],
      name: [artist.name],
      role: ['Main Artist']
    }));
  }

  onCoverArtSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Please select a valid image file'
        });
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Image file size must be less than 5MB'
        });
        return;
      }

      this.selectedCoverArt = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.coverArtPreview = e.target?.result as string;
        this.emitFormData();
        this.emitValidity();
      };
      reader.readAsDataURL(file);
    }
  }

  removeCoverArt(): void {
    this.selectedCoverArt = null;
    this.coverArtPreview = null;
    this.emitFormData();
    this.emitValidity();
  }

  addArtist(): void {
    if (this.allArtists.length > 0) {
      const firstArtist = this.allArtists[0];
      this.addArtistToForm(firstArtist);
      this.emitFormData();
    }
  }

  removeArtist(index: number): void {
    const artistsArray = this.releaseForm.get('artists') as FormArray;
    artistsArray.removeAt(index);
    this.emitFormData();
  }

  get artists(): FormArray {
    return this.releaseForm.get('artists') as FormArray;
  }

  async saveRelease(): Promise<void> {
    // Mark all form controls as touched to trigger validation display
    this.releaseForm.markAllAsTouched();
    
    // Update validity
    this.releaseForm.updateValueAndValidity();
    
    if (!this.releaseForm.valid) {
      this.alertMessage.emit({
        type: 'error',
        message: 'Please fill in all required fields before saving.'
      });
      return;
    }

    this.savingRelease = true;

    try {
      const formData = this.releaseForm.value;
      
      // Ensure at least one artist is present
      if (!formData.artists || formData.artists.length === 0) {
        if (this.artist) {
          // Add the current artist if not already added
          this.addArtistToForm(this.artist);
          formData.artists = this.releaseForm.get('artists')?.value || [];
        } else if (this.allArtists.length > 0) {
          // Add the first available artist as fallback
          this.addArtistToForm(this.allArtists[0]);
          formData.artists = this.releaseForm.get('artists')?.value || [];
        } else {
          console.error('No artist available to add to release');
          this.alertMessage.emit({
            type: 'error',
            message: 'Please select an artist before saving the release.'
          });
          return;
        }
      }
      
      // For non-admin users, ensure catalog number is set
      let catalogNo = formData.catalog_no;
      if (!catalogNo) {
        catalogNo = this.defaultCatalogNumber;
        // Update the form with the default catalog number
        this.releaseForm.patchValue({ catalog_no: catalogNo });
      }
      
      // Transform artists data to match API expectations
      const uniqueArtists = (formData.artists || []).filter((artist: any, index: number, self: any[]) => 
        index === self.findIndex((a: any) => a.id === artist.id)
      );
      
      const transformedArtists = uniqueArtists.map((artist: any) => ({
        artist_id: artist.id,
        streaming_royalty_percentage: .5, // Default to 50% for main artist
        sync_royalty_percentage: .5,
        download_royalty_percentage: .5,
        physical_royalty_percentage: .5
      }));
      
      const releaseData = {
        title: formData.title,
        catalog_no: catalogNo,
        UPC: formData.UPC || '',
        release_date: formData.release_date,
        description: formData.description || '',
        status: formData.status || 'Draft',
        cover_art: this.selectedCoverArt || undefined,
        artists: transformedArtists
      };

      let response;
      if (this.editingRelease) {
        // For editing, use updateRelease and don't send artists (they're already associated)
        const updateData = {
          title: formData.title,
          catalog_no: catalogNo,
          UPC: formData.UPC || '',
          release_date: formData.release_date,
          description: formData.description || '',
          status: formData.status || 'Draft',
          cover_art: this.selectedCoverArt || undefined
          // Note: Not sending artists for updates to avoid duplicate insertion issues
        };
        response = await this.releaseService.updateRelease(this.editingRelease.id, updateData).toPromise();
      } else {
        // For creating, use createRelease with artists
        const createData = {
          ...releaseData,
          artists: transformedArtists
        };
        response = await this.releaseService.createRelease(createData).toPromise();
      }

      if (response && response.release) {
        this.alertMessage.emit({
          type: 'success',
          message: 'Release information saved successfully!'
        });

        // Emit the saved release data
        const savedReleaseData = this.editingRelease ? {
          title: formData.title,
          catalog_no: catalogNo,
          UPC: formData.UPC || '',
          release_date: formData.release_date,
          description: formData.description || '',
          status: formData.status || 'Draft',
          cover_art: null, // File is not returned from API
          cover_art_preview: response.release.cover_art || null,
          artists: this.editingRelease.artists || [] // Use existing artists for updates
        } : {
          ...releaseData,
          cover_art: null, // File is not returned from API
          cover_art_preview: response.release.cover_art || null
        };

        this.releaseSaved.emit({
          releaseId: response.release.id,
          releaseData: savedReleaseData
        });

        // Emit the current form data after successful save
        this.formDataChange.emit(formData);
      }
    } catch (error: any) {
      console.error('Error saving release:', error);
      this.alertMessage.emit({
        type: 'error',
        message: error.error?.error || 'Failed to save release information. Please try again.'
      });
    } finally {
      this.savingRelease = false;
    }
  }
}