import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Artist } from '../artist-selection/artist-selection.component';
import { ReleaseService, ReleaseFormData } from '../../../services/release.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-artist-new-release-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './artist-new-release-tab.component.html',
  styleUrl: './artist-new-release-tab.component.scss'
})
export class ArtistNewReleaseTabComponent implements OnInit {
  @Input() artist: Artist | null = null;
  @Input() editingRelease: any = null; // For editing existing releases
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  @Output() releaseCreated = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  releaseForm: FormGroup;
  loading = false;
  isAdmin = false;
  selectedCoverArt: File | null = null;
  coverArtPreview: string | null = null;
  defaultCatalogNumber = '';
  allArtists: Artist[] = [];
  loadingArtists = false;

  constructor(
    private fb: FormBuilder,
    private releaseService: ReleaseService,
    private authService: AuthService,
    private apiService: ApiService
  ) {
    this.releaseForm = this.createForm();
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadDefaultCatalogNumber();
    this.loadAllArtists();
    
    if (this.editingRelease) {
      this.populateFormForEditing();
    }
  }

  ngOnChanges(): void {
    if (this.editingRelease && this.releaseForm) {
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
      status: ['Pending'],
      // Dynamic royalty splits (admin only)
      royaltyArtists: this.fb.array([])
    });
  }

  private loadDefaultCatalogNumber(): void {
    if (!this.editingRelease) {
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
  }

  private loadAllArtists(): void {
    this.loadingArtists = true;
    this.apiService.getArtists().subscribe({
      next: (response: any) => {
        this.allArtists = response.artists || response || [];
        this.loadingArtists = false;
        
        // Initialize with current artist if no existing royalty splits
        if (this.isAdmin && this.royaltyArtists.length === 0) {
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
    // Add the current artist as the first royalty split
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
    
    // Calculate totals for each royalty type
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
    
    // Check if any total exceeds 100%
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
    return Math.max(0, 100 - artistTotal); // Ensure it doesn't go below 0
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
        this.coverArtPreview = this.editingRelease.cover_art;
      }

      // Populate royalty artists if admin and artists exist
      if (this.isAdmin && this.editingRelease.artists) {
        // Clear existing royalty artists
        while (this.royaltyArtists.length !== 0) {
          this.royaltyArtists.removeAt(0);
        }

        // Add each artist to the royalty artists form array
        this.editingRelease.artists.forEach((artist: any) => {
          const artistForm = this.fb.group({
            artist_id: [artist.artist_id, Validators.required],
            streaming_royalty_percentage: [artist.streaming_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]], // Convert to percentage
            streaming_royalty_type: [artist.streaming_royalty_type],
            sync_royalty_percentage: [artist.sync_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]], // Convert to percentage  
            sync_royalty_type: [artist.sync_royalty_type],
            download_royalty_percentage: [artist.download_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]], // Convert to percentage
            download_royalty_type: [artist.download_royalty_type],
            physical_royalty_percentage: [artist.physical_royalty_percentage * 100, [Validators.required, Validators.min(0), Validators.max(100)]], // Convert to percentage
            physical_royalty_type: [artist.physical_royalty_type]
          });
          this.royaltyArtists.push(artistForm);
        });
      }
    }
  }

  onCoverArtSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Please select a valid image file (JPG, PNG)'
        });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          message: 'Cover art file must be smaller than 5MB'
        });
        return;
      }

      this.selectedCoverArt = file;

      // Create preview
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

    if (!this.artist) {
      this.alertMessage.emit({
        type: 'error',
        message: 'No artist selected'
      });
      return;
    }

    // Validate royalty percentages don't exceed 100% for each category
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

    this.loading = true;
    
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

    // Add artist royalty information if admin
    if (this.isAdmin && this.royaltyArtists.length > 0) {
      formData.artists = this.royaltyArtists.value.map((artistData: any) => ({
        artist_id: artistData.artist_id,
        streaming_royalty_percentage: artistData.streaming_royalty_percentage / 100,
        sync_royalty_percentage: artistData.sync_royalty_percentage / 100,
        download_royalty_percentage: artistData.download_royalty_percentage / 100,
        physical_royalty_percentage: artistData.physical_royalty_percentage / 100
      }));
    }

    const operation = this.editingRelease 
      ? this.releaseService.updateRelease(this.editingRelease.id, formData)
      : this.releaseService.createRelease(formData);

    operation.subscribe({
      next: (response) => {
        this.loading = false;
        this.alertMessage.emit({
          type: 'success',
          message: this.editingRelease ? 'Release updated successfully!' : 'Release created successfully!'
        });
        this.releaseCreated.emit(response.release);
        
        if (!this.editingRelease) {
          this.resetForm();
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Release operation error:', error);
        this.alertMessage.emit({
          type: 'error',
          message: error.error?.error || 'Failed to save release. Please try again.'
        });
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.releaseForm.controls).forEach(key => {
      const control = this.releaseForm.get(key);
      control?.markAsTouched();
    });
  }

  private resetForm(): void {
    this.releaseForm.reset();
    this.selectedCoverArt = null;
    this.coverArtPreview = null;
    
    // Clear royalty artists array
    while (this.royaltyArtists.length !== 0) {
      this.royaltyArtists.removeAt(0);
    }
    
    this.loadDefaultCatalogNumber();
    this.releaseForm.patchValue({
      status: 'Pending'
    });
    
    // Re-initialize with current artist
    if (this.isAdmin) {
      this.initializeRoyaltyArtists();
    }
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

  onCancel(): void {
    if (this.editingRelease) {
      this.cancelled.emit();
    } else {
      this.resetForm();
    }
  }
}