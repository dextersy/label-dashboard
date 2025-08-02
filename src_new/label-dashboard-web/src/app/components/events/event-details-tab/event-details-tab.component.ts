import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EventService } from '../../../services/event.service';

export interface EventDetails {
  id?: number;
  title: string;
  date_and_time: string;
  venue: string;
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
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_card: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  status?: 'Open' | 'Closed';
  remaining_tickets?: number;
}

@Component({
  selector: 'app-event-details-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './event-details-tab.component.html',
  styleUrl: './event-details-tab.component.scss'
})
export class EventDetailsTabComponent implements OnInit, OnChanges {
  @Input() event: EventDetails | null = null;
  @Input() isAdmin: boolean = false;
  @Input() loading: boolean = false;
  @Output() eventUpdate = new EventEmitter<EventDetails>();
  @Output() eventUpdateWithFile = new EventEmitter<{eventId: number, formData: FormData}>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  refreshingPIN = false;
  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  uploading = false;

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    if (!this.event) {
      this.initializeNewEvent();
    } else {
      this.formatDatesForDisplay();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['event'] && this.event && changes['event'].currentValue) {
      this.formatDatesForDisplay();
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
      supports_gcash: true,
      supports_qrph: true,
      supports_card: true,
      supports_ubp: true,
      supports_dob: true,
      supports_maya: true,
      supports_grabpay: true
    };
  }

  generateVerificationPIN(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateSlug(): void {
    if (this.event?.title) {
      const slug = 'Buy' + this.event.title.replace(/[^A-Z0-9]/gi, '');
      this.event.slug = slug;
    }
  }

  onTitleChange(): void {
    // Auto-generate slug only for new events (no ID) and if slug is empty
    if (this.event && !this.event.id && !this.event.slug) {
      this.generateSlug();
    }
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
        text: 'Please fill in all required fields.'
      });
      return;
    }

    // If there's a selected poster file, use FormData for file upload
    if (this.selectedPosterFile) {
      this.uploading = true;
      
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
      
      // Add payment method support flags
      formData.append('supports_gcash', this.event.supports_gcash.toString());
      formData.append('supports_qrph', this.event.supports_qrph.toString());
      formData.append('supports_card', this.event.supports_card.toString());
      formData.append('supports_ubp', this.event.supports_ubp.toString());
      formData.append('supports_dob', this.event.supports_dob.toString());
      formData.append('supports_maya', this.event.supports_maya.toString());
      formData.append('supports_grabpay', this.event.supports_grabpay.toString());

      // Call the parent component's update method with FormData
      if (this.event.id) {
        this.eventUpdateWithFile.emit({ eventId: this.event.id, formData });
      }
    } else {
      // Create a copy with properly formatted dates for the API
      const eventForAPI = {
        ...this.event,
        date_and_time: this.formatDateForAPI(this.event.date_and_time),
        close_time: this.event.close_time ? this.formatDateForAPI(this.event.close_time) : ''
      };

      this.eventUpdate.emit(eventForAPI);
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

  onImageError(event: any): void {
    // Set fallback image if the poster URL fails to load
    event.target.src = 'assets/img/placeholder.jpg';
  }
}