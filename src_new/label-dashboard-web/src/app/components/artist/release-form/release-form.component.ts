import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Artist } from '../../artist/artist-selection/artist-selection.component';
import { ArtistRelease } from '../../artist/artist-releases-tab/artist-releases-tab.component';
import { ReleaseService, ReleaseFormData } from '../../../services/release.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { QuillModule } from 'ngx-quill';

export interface ReleaseFormSubmitData {
  formData: ReleaseFormData;
  isEdit: boolean;
  releaseId?: number;
}

@Component({
    selector: 'app-release-form',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, QuillModule],
    templateUrl: './release-form.component.html',
    styleUrl: './release-form.component.scss'
})
export class ReleaseFormComponent implements OnInit, OnChanges {
  @Input() artist: Artist | null = null;
  @Input() editingRelease: ArtistRelease | null = null;
  @Input() showStatus: boolean = true;
  @Input() generateCatalogNumber: boolean = true;
  @Input() submitButtonText: string = 'Save Release';
  @Input() cancelButtonText: string = 'Cancel';
  @Input() showActionButtons: boolean = true;
  @Input() loading: boolean = false;
  
  @Output() submit = new EventEmitter<ReleaseFormSubmitData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  releaseForm: FormGroup;
  isAdmin = false;
  selectedCoverArt: File | null = null;
  coverArtPreview: string | null = null;
  defaultCatalogNumber = '';
  allArtists: Artist[] = [];
  loadingArtists = false;

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
  linerNotesCharLimit = 3000;
  linerNotesCharCount = 0;

  onDescriptionContentChanged(event: any): void {
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.descriptionCharCount = text.length;
  }

  onLinerNotesContentChanged(event: any): void {
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.linerNotesCharCount = text.length;
  }

  constructor(
    private fb: FormBuilder,
    private releaseService: ReleaseService,
    private authService: AuthService,
    private apiService: ApiService
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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingRelease'] && this.editingRelease) {
      this.populateFormForEditing();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      title: ['', Validators.required],
      catalog_no: ['', Validators.required],
      UPC: [''],
      release_date: ['', Validators.required],
      description: [''],
      liner_notes: [''],
      status: ['Draft'],
      royaltyArtists: this.fb.array([])
    });
  }

  private loadDefaultCatalogNumber(): void {
    this.releaseService.generateCatalogNumber().subscribe({
      next: (response) => {
        this.defaultCatalogNumber = response.catalog_number;
        this.releaseForm.patchValue({
          catalog_no: this.defaultCatalogNumber
        });
      },
      error: (error) => {
        console.error('Error generating catalog number:', error);
      }
    });
  }

  private loadAllArtists(): void {
    this.loadingArtists = true;
    this.apiService.getArtists().subscribe({
      next: (response: any) => {
        this.allArtists = response.artists || response || [];
        this.loadingArtists = false;
        
        // Initialize with current artist for new releases (both admin and non-admin)
        if (this.royaltyArtists.length === 0 && !this.editingRelease) {
          this.initializeRoyaltyArtists();
        }
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loadingArtists = false;
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load artists list'
        });
      }
    });
  }

  private initializeRoyaltyArtists(): void {
    if (this.artist) {
      this.addRoyaltyArtist(this.artist.id);
    }
  }

  get royaltyArtists(): FormArray {
    return this.releaseForm.get('royaltyArtists') as FormArray;
  }

  createRoyaltyArtistForm(artistId?: number): FormGroup {
    return this.fb.group({
      artist_id: [artistId || '', Validators.required],
      streaming_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      sync_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      download_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]],
      physical_royalty_percentage: [50, [Validators.min(0), Validators.max(100)]]
    });
  }

  addRoyaltyArtist(artistId?: number): void {
    this.royaltyArtists.push(this.createRoyaltyArtistForm(artistId));
  }

  removeRoyaltyArtist(index: number): void {
    if (this.royaltyArtists.length > 1) {
      this.royaltyArtists.removeAt(index);
    }
  }

  getAvailableArtists(currentIndex: number): Artist[] {
    const selectedArtistIds = this.royaltyArtists.controls
      .map((control, index) => index !== currentIndex ? control.get('artist_id')?.value : null)
      .filter(id => id);
    
    return this.allArtists.filter(artist => !selectedArtistIds.includes(artist.id));
  }

  validateRoyaltyPercentages(): string | null {
    const artistData = this.royaltyArtists.value;
    
    if (artistData.length === 0) {
      return null;
    }
    
    const totals = {
      streaming: 0,
      sync: 0,
      download: 0,
      physical: 0
    };
    
    for (const artist of artistData) {
      if (!artist.artist_id) {
        return 'Please select an artist for all royalty split rows';
      }
      
      totals.streaming += artist.streaming_royalty_percentage || 0;
      totals.sync += artist.sync_royalty_percentage || 0;
      totals.download += artist.download_royalty_percentage || 0;
      totals.physical += artist.physical_royalty_percentage || 0;
    }
    
    const violations = [];
    if (totals.streaming > 100) violations.push('Streaming');
    if (totals.sync > 100) violations.push('Sync');
    if (totals.download > 100) violations.push('Download');
    if (totals.physical > 100) violations.push('Physical');
    
    if (violations.length > 0) {
      return `${violations.join(', ')} royalty percentages exceed 100%. Please adjust the values.`;
    }
    
    return null;
  }

  getRoyaltyTotal(type: 'streaming' | 'sync' | 'download' | 'physical'): number {
    const fieldMap = {
      streaming: 'streaming_royalty_percentage',
      sync: 'sync_royalty_percentage', 
      download: 'download_royalty_percentage',
      physical: 'physical_royalty_percentage'
    };
    
    return this.royaltyArtists.value.reduce((total: number, artist: any) => {
      return total + (artist[fieldMap[type]] || 0);
    }, 0);
  }

  getLabelRoyalty(type: 'streaming' | 'sync' | 'download' | 'physical'): number {
    const artistTotal = this.getRoyaltyTotal(type);
    return Math.max(0, 100 - artistTotal);
  }

  private populateFormForEditing(): void {
    if (this.editingRelease) {
      this.releaseForm.patchValue({
        title: this.editingRelease.title,
        catalog_no: this.editingRelease.catalog_no,
        UPC: this.editingRelease.UPC,
        release_date: this.editingRelease.release_date,
        description: this.editingRelease.description,
        liner_notes: this.editingRelease.liner_notes,
        status: this.editingRelease.status
      });

      if (this.editingRelease.cover_art) {
        this.coverArtPreview = this.getCoverArtUrl(this.editingRelease.cover_art);
      }

      if (this.isAdmin && this.editingRelease.artists && this.editingRelease.artists.length > 0) {
        while (this.royaltyArtists.length !== 0) {
          this.royaltyArtists.removeAt(0);
        }

        this.editingRelease.artists.forEach((artist) => {
          const royaltyData = (artist as any).ReleaseArtist;
          if (royaltyData) {
            const artistForm = this.fb.group({
              artist_id: [artist.id, Validators.required],
              streaming_royalty_percentage: [royaltyData.streaming_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]],
              sync_royalty_percentage: [royaltyData.sync_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]],
              download_royalty_percentage: [royaltyData.download_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]],
              physical_royalty_percentage: [royaltyData.physical_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]]
            });
            this.royaltyArtists.push(artistForm);
          }
        });
      }
    }
  }

  getCoverArtUrl(coverArt: string): string {
    if (!coverArt) {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http') ? coverArt : `/api/uploads/covers/${coverArt}`;
  }

  onCoverArtSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Please select a valid image file (JPG, PNG)'
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Cover art file must be smaller than 5MB'
        });
        return;
      }

      this.selectedCoverArt = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.coverArtPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    if (this.releaseForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    if (this.isAdmin && this.royaltyArtists.length > 0) {
      const validationError = this.validateRoyaltyPercentages();
      if (validationError) {
        this.alertMessage.emit({
          type: 'error',
          message: validationError
        });
        return;
      }
    }
    
    const formData: ReleaseFormData = {
      title: this.releaseForm.value.title,
      catalog_no: this.releaseForm.value.catalog_no,
      UPC: this.releaseForm.value.UPC,
      release_date: this.releaseForm.value.release_date,
      description: this.releaseForm.value.description,
      liner_notes: this.releaseForm.value.liner_notes,
      status: this.releaseForm.value.status,
      cover_art: this.selectedCoverArt || undefined
    };

    // Add artist associations for both admin and non-admin
    // Backend will handle royalty percentages based on user role
    if (this.royaltyArtists.length > 0) {
      formData.artists = this.royaltyArtists.value.map((artistData: any) => ({
        artist_id: artistData.artist_id,
        streaming_royalty_percentage: artistData.streaming_royalty_percentage / 100,
        sync_royalty_percentage: artistData.sync_royalty_percentage / 100,
        download_royalty_percentage: artistData.download_royalty_percentage / 100,
        physical_royalty_percentage: artistData.physical_royalty_percentage / 100
      }));
    }

    const submitData: ReleaseFormSubmitData = {
      formData,
      isEdit: !!this.editingRelease,
      releaseId: this.editingRelease?.id
    };

    this.submit.emit(submitData);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  resetForm(): void {
    this.releaseForm.reset();
    this.selectedCoverArt = null;
    this.coverArtPreview = null;
    
    while (this.royaltyArtists.length !== 0) {
      this.royaltyArtists.removeAt(0);
    }
    
    if (this.generateCatalogNumber) {
      this.loadDefaultCatalogNumber();
    }
    
    this.releaseForm.patchValue({
      status: 'Draft'
    });

    // Initialize with current artist for new releases (both admin and non-admin)
    if (!this.editingRelease) {
      this.initializeRoyaltyArtists();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.releaseForm.controls).forEach(key => {
      const control = this.releaseForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.releaseForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.releaseForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['min']) {
        return `${fieldName} must be at least ${field.errors['min'].min}`;
      }
      if (field.errors['max']) {
        return `${fieldName} must be at most ${field.errors['max'].max}`;
      }
    }
    return '';
  }

  get isFormValid(): boolean {
    return this.releaseForm.valid;
  }

  submitForm(): void {
    this.onSubmit();
  }
}