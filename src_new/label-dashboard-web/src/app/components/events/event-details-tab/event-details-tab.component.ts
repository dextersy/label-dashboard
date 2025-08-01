import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
export class EventDetailsTabComponent implements OnInit {
  @Input() event: EventDetails | null = null;
  @Input() isAdmin: boolean = false;
  @Input() loading: boolean = false;
  @Output() eventUpdate = new EventEmitter<EventDetails>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  ngOnInit(): void {
    if (!this.event) {
      this.initializeNewEvent();
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
      ticket_naming: 'General Admission',
      supports_gcash: true,
      supports_qrph: true,
      supports_card: true,
      supports_ubp: false,
      supports_dob: false,
      supports_maya: false,
      supports_grabpay: false
    };
  }

  generateVerificationPIN(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateSlug(): void {
    if (this.event?.title) {
      const slug = 'Buy' + this.event.title.replace(/[^A-Z0-9]/gi, '');
      // This would be used for URL slug generation in the backend
    }
  }

  resetPIN(): void {
    if (this.event) {
      this.event.verification_pin = this.generateVerificationPIN();
      this.alertMessage.emit({
        type: 'info',
        text: 'PIN reset. Please save the event to apply changes.'
      });
    }
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

    this.eventUpdate.emit(this.event);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Handle file upload - this would typically involve uploading to a service
      this.alertMessage.emit({
        type: 'info',
        text: 'File upload functionality to be implemented.'
      });
    }
  }
}