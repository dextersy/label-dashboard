import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Event } from '../../../services/event.service';

export interface CreateEventForm {
  title: string;
  date_and_time: string;
  venue: string;
  description: string;
  ticket_price: number;
  close_time: string;
  poster_url: string;
  rsvp_link: string;
}

@Component({
  selector: 'app-create-event-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal fade show" style="display: block;" tabindex="-1" *ngIf="isOpen">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fa fa-calendar-plus me-2"></i>
              Create New Event
            </h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          
          <form [formGroup]="eventForm" (ngSubmit)="onSubmit()">
            <div class="modal-body">
              <div class="row">
                
                <!-- Event Title -->
                <div class="col-12 mb-3">
                  <label class="form-label required">Event Title</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    formControlName="title"
                    placeholder="Enter event title"
                    [class.is-invalid]="eventForm.get('title')?.invalid && eventForm.get('title')?.touched">
                  <div class="invalid-feedback" *ngIf="eventForm.get('title')?.invalid && eventForm.get('title')?.touched">
                    Event title is required
                  </div>
                </div>
                
                <!-- Date and Time -->
                <div class="col-md-6 mb-3">
                  <label class="form-label required">Event Date & Time</label>
                  <input 
                    type="datetime-local" 
                    class="form-control" 
                    formControlName="date_and_time"
                    [class.is-invalid]="eventForm.get('date_and_time')?.invalid && eventForm.get('date_and_time')?.touched">
                  <div class="invalid-feedback" *ngIf="eventForm.get('date_and_time')?.invalid && eventForm.get('date_and_time')?.touched">
                    Event date and time is required
                  </div>
                </div>
                
                <!-- Venue -->
                <div class="col-md-6 mb-3">
                  <label class="form-label required">Venue</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    formControlName="venue"
                    placeholder="Enter venue name"
                    [class.is-invalid]="eventForm.get('venue')?.invalid && eventForm.get('venue')?.touched">
                  <div class="invalid-feedback" *ngIf="eventForm.get('venue')?.invalid && eventForm.get('venue')?.touched">
                    Venue is required
                  </div>
                </div>
                
                <!-- Description -->
                <div class="col-12 mb-3">
                  <label class="form-label">Description</label>
                  <textarea 
                    class="form-control" 
                    formControlName="description" 
                    rows="3"
                    placeholder="Enter event description (optional)">
                  </textarea>
                </div>
                
                <!-- Ticket Price -->
                <div class="col-md-6 mb-3">
                  <label class="form-label required">Ticket Price (PHP)</label>
                  <div class="input-group">
                    <span class="input-group-text">₱</span>
                    <input 
                      type="number" 
                      class="form-control" 
                      formControlName="ticket_price"
                      min="0"
                      step="1"
                      placeholder="0"
                      [class.is-invalid]="eventForm.get('ticket_price')?.invalid && eventForm.get('ticket_price')?.touched">
                  </div>
                  <div class="invalid-feedback" *ngIf="eventForm.get('ticket_price')?.invalid && eventForm.get('ticket_price')?.touched">
                    Ticket price is required and must be a positive number
                  </div>
                </div>
                
                <!-- Close Time -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Ticket Sales Close Time</label>
                  <input 
                    type="datetime-local" 
                    class="form-control" 
                    formControlName="close_time"
                    placeholder="Leave empty to close at event time">
                  <small class="form-text text-muted">
                    Leave empty to close ticket sales at event time
                  </small>
                </div>
                
                <!-- Poster URL -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">Poster Image URL</label>
                  <input 
                    type="url" 
                    class="form-control" 
                    formControlName="poster_url"
                    placeholder="https://example.com/poster.jpg">
                </div>
                
                <!-- RSVP Link -->
                <div class="col-md-6 mb-3">
                  <label class="form-label">RSVP/Social Media Link</label>
                  <input 
                    type="url" 
                    class="form-control" 
                    formControlName="rsvp_link"
                    placeholder="https://facebook.com/events/123456">
                </div>
                
              </div>
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="close()">
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn btn-primary" 
                [disabled]="eventForm.invalid || loading">
                <i class="fa fa-spinner fa-spin me-1" *ngIf="loading"></i>
                <i class="fa fa-plus me-1" *ngIf="!loading"></i>
                {{ loading ? 'Creating...' : 'Create Event' }}
              </button>
            </div>
          </form>
          
        </div>
      </div>
    </div>
    
    <!-- Modal backdrop -->
    <div class="modal-backdrop fade show" *ngIf="isOpen" (click)="close()"></div>
  `,
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
export class CreateEventModalComponent {
  @Input() isOpen = false;
  @Input() loading = false;
  @Output() eventCreate = new EventEmitter<CreateEventForm>();
  @Output() modalClose = new EventEmitter<void>();

  eventForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.eventForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      date_and_time: ['', Validators.required],
      venue: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      ticket_price: [0, [Validators.required, Validators.min(0)]],
      close_time: [''],
      poster_url: [''],
      rsvp_link: ['']
    });
  }

  onSubmit(): void {
    if (this.eventForm.valid) {
      const formData = this.eventForm.value as CreateEventForm;
      this.eventCreate.emit(formData);
    } else {
      // Mark all fields as touched to show validation errors
      this.eventForm.markAllAsTouched();
    }
  }

  close(): void {
    this.modalClose.emit();
    this.eventForm.reset();
  }

  // Set default date to tomorrow at 7 PM when modal opens
  ngOnInit(): void {
    if (this.isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(19, 0, 0, 0); // 7 PM
      
      const formattedDate = tomorrow.toISOString().slice(0, 16); // Format for datetime-local input
      this.eventForm.patchValue({
        date_and_time: formattedDate,
        ticket_price: 500 // Default ticket price
      });
    }
  }
}