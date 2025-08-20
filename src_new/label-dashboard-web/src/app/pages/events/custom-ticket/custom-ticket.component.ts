import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../../services/event.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../services/breadcrumb.service';

export interface CustomTicketForm {
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  price_per_ticket: number;
  referral_code?: string;
  ticket_paid: boolean;
  payment_processing_fee: number;
  send_email: boolean;
}


@Component({
  selector: 'app-custom-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbComponent],
  templateUrl: './custom-ticket.component.html',
  styleUrl: './custom-ticket.component.scss'
})
export class CustomTicketComponent implements OnInit, OnDestroy {
  selectedEvent: Event | null = null;
  isAdmin = false;
  loading = false;
  submitting = false;
  returnRoute = '/events/abandoned'; // Default to pending orders
  
  customTicketForm: CustomTicketForm = {
    name: '',
    email_address: '',
    contact_number: '',
    number_of_entries: 1,
    price_per_ticket: 0,
    referral_code: '',
    ticket_paid: false,
    payment_processing_fee: 0,
    send_email: true
  };

  priceOverrideEnabled = false;
  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
        if (!this.isAdmin) {
          this.router.navigate(['/events']);
          return;
        }
      })
    );

    // Subscribe to selected event changes, but always refresh from API
    this.subscriptions.add(
      this.eventService.selectedEvent$.subscribe(event => {
        if (event) {
          // Always reload fresh data to ensure we have latest event information
          this.loadEventById(event.id);
        } else {
          // If no event is selected, redirect to events
          this.router.navigate(['/events']);
        }
      })
    );

    // Check if we have an event ID in the route
    const eventId = this.route.snapshot.queryParams['eventId'];
    if (eventId && !this.selectedEvent) {
      this.loadEventById(parseInt(eventId));
    }

    // Check where the user came from to determine return route
    const fromParam = this.route.snapshot.queryParams['from'];
    if (fromParam === 'tickets') {
      this.returnRoute = '/events/tickets';
    } else {
      this.returnRoute = '/events/abandoned';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEventById(eventId: number): void {
    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEvent(eventId).subscribe({
        next: (event) => {
          this.selectedEvent = event;
          // Don't call setSelectedEvent here to avoid infinite loop
          // Just update our local state
          this.initializeCustomTicketForm();
          // Update breadcrumbs after return route is determined
          setTimeout(() => this.updateBreadcrumbs(), 0);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load event:', error);
          this.notificationService.showError('Event not found');
          this.router.navigate(['/events']);
          this.loading = false;
        }
      })
    );
  }

  private initializeCustomTicketForm(): void {
    this.customTicketForm.price_per_ticket = this.selectedEvent?.ticket_price || 0;
  }


  enablePriceOverride(): void {
    this.priceOverrideEnabled = true;
  }

  onToggleMarkAsPaid(): void {
    if (this.customTicketForm.ticket_paid) {
      this.customTicketForm.send_email = false;
    } else {
      this.customTicketForm.payment_processing_fee = 0;
    }
  }

  onSubmitCustomTicket(): void {
    if (!this.selectedEvent) return;
    
    // Basic validation
    if (!this.customTicketForm.name || !this.customTicketForm.email_address || !this.customTicketForm.contact_number) {
      this.notificationService.showError('Please fill in all required fields.');
      return;
    }

    if (this.customTicketForm.number_of_entries <= 0) {
      this.notificationService.showError('Number of entries must be greater than 0.');
      return;
    }

    this.submitting = true;

    const ticketData = {
      event_id: this.selectedEvent.id,
      name: this.customTicketForm.name,
      email_address: this.customTicketForm.email_address,
      contact_number: this.customTicketForm.contact_number,
      number_of_entries: this.customTicketForm.number_of_entries,
      send_email: this.customTicketForm.send_email,
      price_per_ticket: this.priceOverrideEnabled ? this.customTicketForm.price_per_ticket : undefined,
      payment_processing_fee: this.customTicketForm.payment_processing_fee,
      referrer_code: this.customTicketForm.referral_code || undefined
    };
    
    this.subscriptions.add(
      this.eventService.addTicket(ticketData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Custom ticket created successfully!');
          
          // If ticket is marked as paid, mark it as paid immediately
          if (this.customTicketForm.ticket_paid && response.ticket?.id) {
            this.subscriptions.add(
              this.eventService.markTicketPaid(response.ticket.id).subscribe({
                next: () => {
                  this.handleSuccessfulCreation();
                },
                error: (error) => {
                  console.error('Failed to mark custom ticket as paid:', error);
                  this.handleSuccessfulCreation();
                }
              })
            );
          } else {
            this.handleSuccessfulCreation();
          }
        },
        error: (error) => {
          console.error('Failed to create custom ticket:', error);
          this.notificationService.showError('Failed to create custom ticket');
          this.submitting = false;
        }
      })
    );
  }

  private handleSuccessfulCreation(): void {
    this.resetCustomTicketForm();
    this.submitting = false;
    // Always navigate to pending orders after creation since that's where new tickets appear
    this.router.navigate(['/events/abandoned'], { 
      queryParams: { eventId: this.selectedEvent?.id } 
    });
  }

  resetCustomTicketForm(): void {
    this.customTicketForm = {
      name: '',
      email_address: '',
      contact_number: '',
      number_of_entries: 1,
      price_per_ticket: this.selectedEvent?.ticket_price || 0,
      referral_code: '',
      ticket_paid: false,
      payment_processing_fee: 0,
      send_email: true
    };
    this.priceOverrideEnabled = false;
  }

  onCancel(): void {
    // Navigate back to where the user came from
    this.router.navigate([this.returnRoute], { 
      queryParams: { eventId: this.selectedEvent?.id } 
    });
  }

  isEventPast(): boolean {
    if (!this.selectedEvent || !this.selectedEvent.date_and_time) {
      return false;
    }
    
    const eventDate = new Date(this.selectedEvent.date_and_time);
    const now = new Date();
    
    return now > eventDate;
  }

  isEventClosed(): boolean {
    if (!this.selectedEvent || !this.selectedEvent.close_time) {
      return false;
    }
    
    const closeTime = new Date(this.selectedEvent.close_time);
    const now = new Date();
    
    return now > closeTime;
  }

  getEventStatusMessage(): string {
    if (this.isEventPast()) {
      return 'This event has already occurred.';
    }
    
    if (this.isEventClosed()) {
      return 'Ticket sales for this event have closed.';
    }
    
    return '';
  }

  canCreateCustomTickets(): boolean {
    return this.isAdmin && !this.isEventPast(); // Admins can create custom tickets unless event is past
  }

  private updateBreadcrumbs(): void {
    if (this.selectedEvent) {
      const parentTabLabel = this.returnRoute === '/events/tickets' ? 'Tickets' : 'Pending Orders';
      this.breadcrumbService.setBreadcrumbs([
        { label: 'Events', route: '/events', icon: 'fas fa-ticket-alt' },
        { label: parentTabLabel, route: this.returnRoute },
        { label: 'Create Custom Ticket' } // Current page - no route
      ]);
    }
  }
}