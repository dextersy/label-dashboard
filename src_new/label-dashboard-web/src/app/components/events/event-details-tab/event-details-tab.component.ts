import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../../services/event.service';
import { QuillModule } from 'ngx-quill';
import { VenueAutocompleteComponent, VenueSelection } from '../../shared/venue-autocomplete/venue-autocomplete.component';

export interface EventDetails {
  id?: number;
  title: string;
  date_and_time: string;
  venue: string;
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
  description: string;
  poster_url?: string;
  rsvp_link: string;
  ticket_price: number;
  max_tickets: number;
  close_time: string;
  verification_pin: string;
  verification_link?: string;
  buy_shortlink?: string;
  ticket_naming: string;
  slug?: string;
  countdown_display: 'always' | '1_week' | '3_days' | '1_day' | 'never';
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_card: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  status?: 'draft' | 'published';
  backend_status?: 'Open' | 'Closed';
  remaining_tickets?: number;
}

@Component({
  selector: 'app-event-details-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, QuillModule, VenueAutocompleteComponent],
  templateUrl: './event-details-tab.component.html',
  styleUrl: './event-details-tab.component.scss'
})
export class EventDetailsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() eventUpdated = new EventEmitter<Event>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();
  @ViewChild('eventForm') eventForm!: NgForm;

  event: EventDetails | null = null;
  currentVenueSelection: VenueSelection | null = null;
  loading = false;
  refreshingPIN = false;
  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  uploading = false;

  quillConfig = {
    toolbar: [
      ['bold', 'italic'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  private subscriptions = new Subscription();

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadEventDetails();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadEventDetails();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEventDetails(): void {
    if (!this.selectedEvent) {
      this.initializeNewEvent();
      return;
    }

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEvent(this.selectedEvent.id).subscribe({
        next: (event) => {
          this.event = this.convertEventToDetails(event);
          this.formatDatesForDisplay();
          this.updateCurrentVenueSelection();
          
          // Auto-generate slug for draft events if not set
          if (this.event && this.event.status === 'draft' && !this.event.slug && this.event.title) {
            this.generateSlug();
          }
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load event details:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to load event details'
          });
          this.loading = false;
        }
      })
    );
  }

  private convertEventToDetails(event: Event): EventDetails {
    return {
      id: event.id,
      title: event.title,
      date_and_time: event.date_and_time,
      venue: event.venue,
      google_place_id: (event as any).google_place_id,
      venue_address: (event as any).venue_address,
      venue_latitude: (event as any).venue_latitude,
      venue_longitude: (event as any).venue_longitude,
      venue_phone: (event as any).venue_phone,
      venue_website: (event as any).venue_website,
      venue_maps_url: (event as any).venue_maps_url,
      description: event.description || '',
      poster_url: event.poster_url,
      rsvp_link: event.rsvp_link || '',
      ticket_price: event.ticket_price,
      max_tickets: event.max_tickets || 0,
      close_time: event.close_time || '',
      verification_pin: event.verification_pin,
      verification_link: event.verification_link,
      buy_shortlink: event.buy_shortlink,
      ticket_naming: event.ticket_naming,
      slug: '', // Slug is input-only, not stored in API
      countdown_display: (event as any).countdown_display || '1_week',
      supports_gcash: event.supports_gcash,
      supports_qrph: event.supports_qrph,
      supports_card: event.supports_card,
      supports_ubp: event.supports_ubp,
      supports_dob: event.supports_dob,
      supports_maya: event.supports_maya,
      supports_grabpay: event.supports_grabpay,
      status: (event as any).status || 'draft',
      backend_status: this.getEventStatus(event) as 'Open' | 'Closed'
    };
  }

  private getEventStatus(event: Event): 'Open' | 'Closed' {
    const now = new Date();
    const eventDate = new Date(event.date_and_time);
    const closeTime = event.close_time ? new Date(event.close_time) : eventDate;
    
    if (now > closeTime) {
      return 'Closed';
    } else {
      return 'Open';
    }
  }

  private formatDatesForDisplay(): void {
    if (this.event) {
      // Format dates for datetime-local inputs
      this.event.date_and_time = this.formatDateForInput(this.event.date_and_time);
      if (this.event.close_time) {
        this.event.close_time = this.formatDateForInput(this.event.close_time);
      }
    }
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Handle various date formats from API
      let date: Date;
      
      // If it's already in the correct format for datetime-local, return as-is
      if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        return dateString;
      }
      
      // Parse the date - handle both ISO strings and MySQL datetime format
      if (dateString.includes('T')) {
        // ISO format: 2024-12-31T19:00:00.000Z
        date = new Date(dateString);
      } else {
        // MySQL datetime format: 2024-12-31 19:00:00
        date = new Date(dateString.replace(' ', 'T'));
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', dateString);
        return '';
      }
      
      // Convert to local timezone and format for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '';
    }
  }

  private initializeNewEvent(): void {
    const now = new Date();
    const closeTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    this.event = {
      title: '',
      date_and_time: now.toISOString().slice(0, 16),
      venue: '',
      description: '',
      rsvp_link: '',
      ticket_price: 0,
      max_tickets: 0,
      close_time: closeTime.toISOString().slice(0, 16),
      verification_pin: this.generateVerificationPIN(),
      verification_link: '',
      buy_shortlink: '',
      ticket_naming: 'Regular',
      slug: '',
      countdown_display: '1_week',
      supports_gcash: true,
      supports_qrph: true,
      supports_card: true,
      supports_ubp: true,
      supports_dob: true,
      supports_maya: true,
      supports_grabpay: true,
      status: 'draft'
    };
    
    this.updateCurrentVenueSelection();
    
    // Auto-generate slug if title is provided for new events
    if (this.event.title) {
      this.generateSlug();
    }
  }

  generateVerificationPIN(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateSlug(): void {
    if (this.event?.title) {
      // Convert to PascalCase: split by spaces/special chars, capitalize each word, then join
      const pascalCase = this.event.title
        .split(/[\s\W]+/) // Split by spaces and non-word characters
        .filter(word => word.length > 0) // Remove empty strings
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, lowercase rest
        .join(''); // Join without spaces
      
      this.event.slug = pascalCase;
    }
  }

  onTitleChange(): void {
    // Auto-generate slug for new events or draft events if slug is empty
    if (this.event && (!this.event.id || this.event.status === 'draft') && !this.event.slug) {
      this.generateSlug();
    }
  }

  onVenueSelected(venueSelection: VenueSelection | null): void {
    if (this.event && venueSelection) {
      this.event.venue = venueSelection.venue || '';
      this.event.google_place_id = venueSelection.google_place_id;
      this.event.venue_address = venueSelection.venue_address;
      this.event.venue_latitude = venueSelection.venue_latitude;
      this.event.venue_longitude = venueSelection.venue_longitude;
      this.event.venue_phone = venueSelection.venue_phone;
      this.event.venue_website = venueSelection.venue_website;
      this.event.venue_maps_url = venueSelection.venue_maps_url;
      
      // Update the current selection to prevent infinite loops
      this.currentVenueSelection = { ...venueSelection };
    } else if (this.event && !venueSelection) {
      // Handle case where venue is cleared
      this.event.venue = '';
      this.event.google_place_id = undefined;
      this.event.venue_address = undefined;
      this.event.venue_latitude = undefined;
      this.event.venue_longitude = undefined;
      this.event.venue_phone = undefined;
      this.event.venue_website = undefined;
      this.event.venue_maps_url = undefined;
      
      this.currentVenueSelection = null;
    }
  }

  private updateCurrentVenueSelection(): void {
    if (!this.event) {
      this.currentVenueSelection = null;
      return;
    }
    
    this.currentVenueSelection = {
      venue: this.event.venue || '',
      google_place_id: this.event.google_place_id,
      venue_address: this.event.venue_address,
      venue_latitude: this.event.venue_latitude,
      venue_longitude: this.event.venue_longitude,
      venue_phone: this.event.venue_phone,
      venue_website: this.event.venue_website,
      venue_maps_url: this.event.venue_maps_url
    };
  }

  resetPIN(): void {
    if (!this.event || !this.event.id || this.refreshingPIN) return;

    this.refreshingPIN = true;
    
    this.eventService.refreshVerificationPIN(this.event.id).subscribe({
      next: (response) => {
        if (this.event) {
          this.event.verification_pin = response.verification_pin;
          this.alertMessage.emit({
            type: 'success',
            text: 'Verification PIN refreshed successfully!'
          });
        }
        this.refreshingPIN = false;
      },
      error: (error) => {
        console.error('Failed to refresh verification PIN:', error);
        this.alertMessage.emit({
          type: 'error',
          text: 'Failed to refresh verification PIN. Please try again.'
        });
        this.refreshingPIN = false;
      }
    });
  }

  copyToClipboard(text: string, type: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.alertMessage.emit({
        type: 'success',
        text: `${type} copied to clipboard!`
      });
    }).catch(() => {
      this.alertMessage.emit({
        type: 'error',
        text: `Failed to copy ${type} to clipboard.`
      });
    });
  }

  private formatDateForAPI(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Convert datetime-local format back to ISO string for API
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString();
    } catch (error) {
      console.error('Error formatting date for API:', dateString, error);
      return '';
    }
  }

  onSaveEvent(): void {
    if (!this.event) return;
    
    // Basic validation
    if (!this.event.title || !this.event.venue || !this.event.date_and_time) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Please fill in all required fields (Title, Date & Time, Venue).'
      });
      return;
    }

    if (!this.event.id) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Cannot update event without ID.'
      });
      return;
    }

    this.uploading = true;

    // If there's a selected poster file, use FormData for file upload
    if (this.selectedPosterFile) {
      const formData = new FormData();
      formData.append('poster', this.selectedPosterFile);
      
      // Add all other event data
      formData.append('title', this.event.title);
      formData.append('date_and_time', this.formatDateForAPI(this.event.date_and_time));
      formData.append('venue', this.event.venue);
      formData.append('description', this.event.description || '');
      formData.append('ticket_price', this.event.ticket_price.toString());
      formData.append('close_time', this.event.close_time ? this.formatDateForAPI(this.event.close_time) : '');
      formData.append('rsvp_link', this.event.rsvp_link || '');
      formData.append('ticket_naming', this.event.ticket_naming || 'Regular');
      formData.append('max_tickets', (this.event.max_tickets || 0).toString());
      formData.append('countdown_display', this.event.countdown_display);
      
      // Add venue location data (always include to allow clearing)
      formData.append('google_place_id', this.event.google_place_id || '');
      formData.append('venue_address', this.event.venue_address || '');
      formData.append('venue_latitude', this.event.venue_latitude?.toString() || '');
      formData.append('venue_longitude', this.event.venue_longitude?.toString() || '');
      formData.append('venue_phone', this.event.venue_phone || '');
      formData.append('venue_website', this.event.venue_website || '');
      formData.append('venue_maps_url', this.event.venue_maps_url || '');
      
      // Add payment method support flags
      formData.append('supports_gcash', this.event.supports_gcash.toString());
      formData.append('supports_qrph', this.event.supports_qrph.toString());
      formData.append('supports_card', this.event.supports_card.toString());
      formData.append('supports_ubp', this.event.supports_ubp.toString());
      formData.append('supports_dob', this.event.supports_dob.toString());
      formData.append('supports_maya', this.event.supports_maya.toString());
      formData.append('supports_grabpay', this.event.supports_grabpay.toString());
      formData.append('status', this.event.status || 'draft');

      this.subscriptions.add(
        this.eventService.updateEventWithFile(this.event.id, formData).subscribe({
          next: (updatedEvent) => {
            this.alertMessage.emit({
              type: 'success',
              text: 'Event updated successfully!'
            });
            this.event = this.convertEventToDetails(updatedEvent);
            this.formatDatesForDisplay();
            this.onEventSaved();
            this.resetFormState();
            this.eventUpdated.emit(updatedEvent);
            this.uploading = false;
          },
          error: (error) => {
            console.error('Failed to update event with file:', error);
            this.alertMessage.emit({
              type: 'error',
              text: 'Failed to update event'
            });
            this.uploading = false;
          }
        })
      );
    } else {
      // Create a copy with properly formatted dates for the API
      const updateData = {
        title: this.event.title,
        date_and_time: this.formatDateForAPI(this.event.date_and_time),
        venue: this.event.venue,
        google_place_id: this.event.google_place_id ?? null,
        venue_address: this.event.venue_address ?? null,
        venue_latitude: this.event.venue_latitude ?? null,
        venue_longitude: this.event.venue_longitude ?? null,
        venue_phone: this.event.venue_phone ?? null,
        venue_website: this.event.venue_website ?? null,
        venue_maps_url: this.event.venue_maps_url ?? null,
        description: this.event.description,
        poster_url: this.event.poster_url,
        rsvp_link: this.event.rsvp_link,
        ticket_price: this.event.ticket_price,
        close_time: this.event.close_time ? this.formatDateForAPI(this.event.close_time) : '',
        verification_pin: this.event.verification_pin,
        verification_link: this.event.verification_link,
        buy_shortlink: this.event.buy_shortlink,
        ticket_naming: this.event.ticket_naming,
        slug: this.event.slug,
        countdown_display: this.event.countdown_display,
        supports_gcash: this.event.supports_gcash,
        supports_qrph: this.event.supports_qrph,
        supports_card: this.event.supports_card,
        supports_ubp: this.event.supports_ubp,
        supports_dob: this.event.supports_dob,
        supports_maya: this.event.supports_maya,
        supports_grabpay: this.event.supports_grabpay,
        max_tickets: this.event.max_tickets,
        status: this.event.status
      };

      this.subscriptions.add(
        this.eventService.updateEvent(this.event.id, updateData).subscribe({
          next: (updatedEvent) => {
            this.alertMessage.emit({
              type: 'success',
              text: 'Event updated successfully!'
            });
            this.event = this.convertEventToDetails(updatedEvent);
            this.formatDatesForDisplay();
            this.resetFormState();
            this.eventUpdated.emit(updatedEvent);
            this.uploading = false;
          },
          error: (error) => {
            console.error('Failed to update event:', error);
            this.alertMessage.emit({
              type: 'error',
              text: 'Failed to update event'
            });
            this.uploading = false;
          }
        })
      );
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.alertMessage.emit({
          type: 'error',
          text: 'Please select a valid image file (JPG, PNG, GIF).'
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.alertMessage.emit({
          type: 'error',
          text: 'File is too large. Please select an image smaller than 10MB.'
        });
        return;
      }

      this.selectedPosterFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.posterPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);

      this.alertMessage.emit({
        type: 'info',
        text: 'Poster selected. Click "Save Changes" to upload.'
      });
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

  onEventSaved(): void {
    // Clear poster selection after successful save
    this.removePoster();
    this.uploading = false;
  }

  resetFormState(): void {
    // Reset the form's dirty state after successful save
    setTimeout(() => {
      if (this.eventForm) {
        // Mark all form controls as pristine
        Object.keys(this.eventForm.controls).forEach(key => {
          const control = this.eventForm.controls[key];
          control.markAsPristine();
          control.markAsUntouched();
        });
        this.eventForm.form.markAsPristine();
        this.eventForm.form.markAsUntouched();
      }
    }, 100);
  }

  onImageError(event: any): void {
    // Set fallback image if the poster URL fails to load
    event.target.src = 'assets/img/placeholder.jpg';
  }

  isFormDirty(): boolean {
    // Check if the form has been modified
    if (this.eventForm && this.eventForm.form.dirty) {
      return true;
    }
    
    // Also check if there's a poster file selected for upload
    return this.selectedPosterFile !== null;
  }

  onPublishEvent(): void {
    if (!this.event || !this.event.id) return;

    const confirmation = confirm(
      'Are you sure you want to publish this event?\n\n' +
      '⚠️ WARNING: Once published, the shortlinks can no longer be changed and the event will be visible to the public.\n\n' +
      'Click OK to proceed with publishing.'
    );

    if (!confirmation) return;

    const slug = this.event.slug;
    this.loading = true;

    this.subscriptions.add(
      this.eventService.publishEvent(this.event.id, slug).subscribe({
        next: (updatedEvent) => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Event published successfully! Shortlinks have been generated.'
          });
          this.event = this.convertEventToDetails(updatedEvent);
          this.formatDatesForDisplay();
          this.eventUpdated.emit(updatedEvent);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to publish event:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error.message || 'Failed to publish event'
          });
          this.loading = false;
        }
      })
    );
  }

  onUnpublishEvent(): void {
    if (!this.event || !this.event.id) return;

    const confirmation = confirm(
      'Are you sure you want to unpublish this event? It will no longer be visible to the public and ticket sales will stop.'
    );

    if (!confirmation) return;

    this.loading = true;

    this.subscriptions.add(
      this.eventService.unpublishEvent(this.event.id).subscribe({
        next: (updatedEvent) => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Event unpublished successfully!'
          });
          this.event = this.convertEventToDetails(updatedEvent);
          this.formatDatesForDisplay();
          this.eventUpdated.emit(updatedEvent);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to unpublish event:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error.message || 'Failed to unpublish event'
          });
          this.loading = false;
        }
      })
    );
  }

  hasConfirmedTickets(): boolean {
    // Check if the event has any confirmed tickets by looking at the tickets array
    // This is a simple check - in a real scenario, you might want to make an API call
    return (this.selectedEvent?.tickets?.filter(ticket => 
      ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.'
    ).length || 0) > 0;
  }

  setSuggestedCloseTime(interval: string): void {
    if (!this.event?.date_and_time) return;

    const eventDate = new Date(this.event.date_and_time);
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

    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const formattedDate = this.formatDateForInput(closeDate.toISOString());
    this.event.close_time = formattedDate;

    // Mark the form as dirty to enable the "Save Changes" button
    if (this.eventForm) {
      this.eventForm.form.markAsDirty();
      const closeTimeControl = this.eventForm.controls['close_time'];
      if (closeTimeControl) {
        closeTimeControl.markAsDirty();
        closeTimeControl.markAsTouched();
      }
    }
  }
}