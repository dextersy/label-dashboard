import { Component, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Event } from '../../../services/event.service';
import { VenueAutocompleteComponent, VenueSelection } from '../../shared/venue-autocomplete/venue-autocomplete.component';

export interface CreateEventForm {
  title: string;
  date_and_time: string;
  venue: string;
  description: string;
  ticket_price: number;
  close_time: string;
  poster_url?: string;
  poster_file?: File;
  rsvp_link: string;
  slug: string;
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
}

@Component({
  selector: 'app-create-event-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, VenueAutocompleteComponent],
  templateUrl: './create-event-modal.component.html',
  styles: [`
    .modal {
      z-index: 1050;
    }
    .modal-backdrop {
      z-index: 1040;
    }
    .required::after {
      content: ' *';
      color: red;
    }
  `]
})
export class CreateEventModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() loading = false;
  @Output() eventCreate = new EventEmitter<CreateEventForm>();
  @Output() modalClose = new EventEmitter<void>();

  eventForm: FormGroup;
  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  selectedVenue: VenueSelection | null = null;

  constructor(private fb: FormBuilder) {
    this.eventForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      date_and_time: ['', Validators.required],
      venue: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      ticket_price: [0, [Validators.required, Validators.min(0)]],
      close_time: [''],
      rsvp_link: [''],
      slug: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)]]
    });
    
    // Auto-generate slug when title changes
    this.eventForm.get('title')?.valueChanges.subscribe((title: string) => {
      if (title) {
        const generatedSlug = this.generateSlug(title);
        this.eventForm.get('slug')?.setValue(generatedSlug, { emitEvent: false });
      }
    });
  }

  onSubmit(): void {
    if (this.eventForm.valid) {
      const formData = this.eventForm.value as CreateEventForm;
      if (this.selectedPosterFile) {
        formData.poster_file = this.selectedPosterFile;
      }
      
      // Include venue data from Google Places
      if (this.selectedVenue) {
        formData.venue = this.selectedVenue.venue;
        formData.google_place_id = this.selectedVenue.google_place_id;
        formData.venue_address = this.selectedVenue.venue_address;
        formData.venue_latitude = this.selectedVenue.venue_latitude;
        formData.venue_longitude = this.selectedVenue.venue_longitude;
        formData.venue_phone = this.selectedVenue.venue_phone;
        formData.venue_website = this.selectedVenue.venue_website;
        formData.venue_maps_url = this.selectedVenue.venue_maps_url;
      }
      
      this.eventCreate.emit(formData);
    } else {
      // Mark all fields as touched to show validation errors
      this.eventForm.markAllAsTouched();
    }
  }

  close(): void {
    this.modalClose.emit();
    this.resetForm();
  }

  onPosterSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, GIF).');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Please select an image smaller than 10MB.');
        return;
      }

      this.selectedPosterFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.posterPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removePoster(): void {
    this.selectedPosterFile = null;
    this.posterPreview = null;
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  onVenueSelected(venue: VenueSelection): void {
    this.selectedVenue = venue;
    this.eventForm.patchValue({
      venue: venue.venue
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reset and set default values when modal is opened
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    // Reset the form to clear all previous values
    this.eventForm.reset();
    
    // Clear poster selection
    this.removePoster();
    
    // Clear venue selection
    this.selectedVenue = null;
    
    // Set default values
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0); // 7 PM
    
    const formattedDate = tomorrow.toISOString().slice(0, 16); // Format for datetime-local input
    this.eventForm.patchValue({
      title: '',
      date_and_time: formattedDate,
      venue: '',
      description: '',
      ticket_price: 500, // Default ticket price
      close_time: '',
      rsvp_link: '',
      slug: ''
    });
  }

  // Public method for parent component to trigger form reset
  public reset(): void {
    this.resetForm();
  }

  private generateSlug(title: string): string {
    return title
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 0) // Remove empty strings
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // PascalCase
      .join('');
  }
}