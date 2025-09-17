import { Component, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Event } from '../../../services/event.service';
import { VenueAutocompleteComponent, VenueSelection } from '../../shared/venue-autocomplete/venue-autocomplete.component';

export interface TicketTypeForm {
  name: string;
  price: number;
}

export interface CreateEventForm {
  title: string;
  date_and_time: string;
  venue: string;
  description: string;
  ticket_price: number; // Keep for backward compatibility with legacy code
  ticketTypes: TicketTypeForm[];
  close_time: string;
  poster_url?: string;
  poster_file?: File;
  rsvp_link: string;
  slug: string;
  status: 'draft' | 'published';
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
  actionType: 'draft' | 'published' | null = null;
  ticketTypes: TicketTypeForm[] = [{ name: 'Regular', price: 0 }];

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

  onSubmit(status: 'draft' | 'published'): void {
    // Validate ticket types
    if (this.ticketTypes.length === 0) {
      return; // Don't submit if no ticket types
    }

    // Validate each ticket type
    for (const ticketType of this.ticketTypes) {
      if (!ticketType.name.trim() || ticketType.price < 0) {
        return; // Don't submit if any ticket type is invalid
      }
    }

    if (this.eventForm.valid) {
      this.actionType = status;
      
      const formData = this.eventForm.value as CreateEventForm;
      formData.status = status;
      formData.ticketTypes = this.ticketTypes;
      
      // Set backward compatible ticket_price to first ticket type price
      formData.ticket_price = this.ticketTypes[0]?.price || 0;
      
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
    
    // Reset action type
    this.actionType = null;
    
    // Reset ticket types to default
    this.ticketTypes = [{ name: 'Regular', price: 0 }];
    
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

  setSuggestedCloseTime(interval: string): void {
    const eventDateValue = this.eventForm.get('date_and_time')?.value;
    if (!eventDateValue) return;

    // Parse the datetime-local value directly (it's already in local timezone)
    const eventDate = new Date(eventDateValue);
    let closeDate = new Date(eventDate);

    switch (interval) {
      case '4h':
        closeDate.setHours(closeDate.getHours() - 4);
        break;
      case '1d':
        closeDate.setDate(closeDate.getDate() - 1);
        break;
      case '2d':
        closeDate.setDate(closeDate.getDate() - 2);
        break;
      case '1w':
        closeDate.setDate(closeDate.getDate() - 7);
        break;
    }

    // Format for datetime-local input without timezone conversion
    const year = closeDate.getFullYear();
    const month = String(closeDate.getMonth() + 1).padStart(2, '0');
    const day = String(closeDate.getDate()).padStart(2, '0');
    const hours = String(closeDate.getHours()).padStart(2, '0');
    const minutes = String(closeDate.getMinutes()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;
    this.eventForm.get('close_time')?.setValue(formattedDate);
  }

  // Ticket Type Management Methods
  addTicketType(): void {
    this.ticketTypes.push({ name: '', price: 0 });
  }

  removeTicketType(index: number): void {
    if (this.ticketTypes.length > 1) {
      this.ticketTypes.splice(index, 1);
    }
  }

  isTicketTypeValid(ticketType: TicketTypeForm): boolean {
    return ticketType.name.trim().length > 0 && ticketType.price >= 0;
  }

  areAllTicketTypesValid(): boolean {
    return this.ticketTypes.length > 0 && this.ticketTypes.every(t => this.isTicketTypeValid(t));
  }
}