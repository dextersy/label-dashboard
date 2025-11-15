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
  ticket_type_id: number;
  price_per_ticket: number;
  referral_code?: string;
  ticket_paid: boolean;
  payment_processing_fee: number;
  send_email: boolean;
}

export interface BulkTicketRow {
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  ticket_type_id: number;
  price_per_ticket: number;
  referral_code?: string;
  ticket_paid: boolean;
  payment_processing_fee: number;
  send_email: boolean;
}


@Component({
    selector: 'app-custom-ticket',
    imports: [CommonModule, FormsModule, BreadcrumbComponent],
    templateUrl: './custom-ticket.component.html',
    styleUrl: './custom-ticket.component.scss'
})
export class CustomTicketComponent implements OnInit, OnDestroy {
  selectedEvent: Event | null = null;
  ticketTypes: any[] = [];
  isAdmin = false;
  loading = false;
  submitting = false;
  returnRoute = '/events/abandoned'; // Default to pending orders
  currentView: 'single' | 'bulk' = 'single';
  
  customTicketForm: CustomTicketForm = {
    name: '',
    email_address: '',
    contact_number: '',
    number_of_entries: 1,
    ticket_type_id: 0,
    price_per_ticket: 0,
    referral_code: '',
    ticket_paid: false,
    payment_processing_fee: 0,
    send_email: true
  };

  bulkTickets: BulkTicketRow[] = [];
  priceOverrideEnabled = false;
  applyAllPaidState = false;
  applyAllSendEmailState = true;
  selectedApplyAllTicketType: number | null = null;
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
          this.loadTicketTypes(eventId);
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

  private loadTicketTypes(eventId: number): void {
    this.subscriptions.add(
      this.eventService.getAvailableTicketTypes(eventId, true).subscribe({
        next: (response) => {
          this.ticketTypes = response.ticketTypes || [];
          // Initialize with first available (not sold out) ticket type
          if (this.ticketTypes.length > 0) {
            const availableTicketType = this.ticketTypes.find(tt => !tt.is_sold_out);
            const selectedTicketType = availableTicketType || this.ticketTypes[0];

            this.customTicketForm.ticket_type_id = selectedTicketType.id;
            this.updatePriceFromTicketType(selectedTicketType.id);
          }
        },
        error: (error) => {
          console.error('Failed to load ticket types:', error);
          this.ticketTypes = [];
        }
      })
    );
  }

  private initializeCustomTicketForm(): void {
    this.customTicketForm.price_per_ticket = this.selectedEvent?.ticket_price || 0;
  }

  updatePriceFromTicketType(ticketTypeId: number): void {
    const selectedType = this.ticketTypes.find(type => type.id === ticketTypeId);
    if (selectedType && !this.priceOverrideEnabled) {
      this.customTicketForm.price_per_ticket = selectedType.price;
    }
  }

  onTicketTypeChange(): void {
    // Always update price when ticket type changes (unless override is enabled)
    this.updatePriceFromTicketType(this.customTicketForm.ticket_type_id);
  }


  enablePriceOverride(): void {
    this.priceOverrideEnabled = true;
  }

  disablePriceOverride(): void {
    this.priceOverrideEnabled = false;
    // Update price to match selected ticket type
    this.updatePriceFromTicketType(this.customTicketForm.ticket_type_id);
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

    // Check if selected ticket type is sold out
    const selectedTicketType = this.ticketTypes.find(tt => tt.id === this.customTicketForm.ticket_type_id);
    if (selectedTicketType && selectedTicketType.is_sold_out) {
      this.notificationService.showError('Cannot create custom tickets for sold out ticket types.');
      return;
    }

    this.submitting = true;

    const ticketData = {
      event_id: this.selectedEvent.id,
      ticket_type_id: this.customTicketForm.ticket_type_id,
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
    // Find first available (not sold out) ticket type
    const availableTicketType = this.ticketTypes.find(tt => !tt.is_sold_out);
    const defaultTicketType = availableTicketType || (this.ticketTypes.length > 0 ? this.ticketTypes[0] : null);

    this.customTicketForm = {
      name: '',
      email_address: '',
      contact_number: '',
      number_of_entries: 1,
      ticket_type_id: defaultTicketType ? defaultTicketType.id : 0,
      price_per_ticket: this.selectedEvent?.ticket_price || 0,
      referral_code: '',
      ticket_paid: false,
      payment_processing_fee: 0,
      send_email: true
    };
    this.priceOverrideEnabled = false;
    if (defaultTicketType) {
      this.updatePriceFromTicketType(defaultTicketType.id);
    }
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

  // View toggle methods
  switchToSingleView(): void {
    this.currentView = 'single';
  }

  switchToBulkView(): void {
    this.currentView = 'bulk';
    if (this.bulkTickets.length === 0) {
      this.addBulkRows(1);
    }
  }

  // Bulk ticket methods
  addBulkRows(count: number): void {
    // Find first available (not sold out) ticket type
    const availableTicketType = this.ticketTypes.find(tt => !tt.is_sold_out);
    const defaultTicketType = availableTicketType || (this.ticketTypes.length > 0 ? this.ticketTypes[0] : null);

    for (let i = 0; i < count; i++) {
      this.bulkTickets.push({
        name: '',
        email_address: '',
        contact_number: '',
        number_of_entries: 1,
        ticket_type_id: defaultTicketType ? defaultTicketType.id : 0,
        price_per_ticket: this.selectedEvent?.ticket_price || 0,
        referral_code: '',
        ticket_paid: false,
        payment_processing_fee: 0,
        send_email: true
      });

      // Set price based on selected ticket type if available
      if (defaultTicketType) {
        this.bulkTickets[this.bulkTickets.length - 1].price_per_ticket = defaultTicketType.price;
      }
    }
  }

  removeBulkRow(index: number): void {
    this.bulkTickets.splice(index, 1);
  }

  // Apply to all methods for bulk creation
  applyAllPaid(paid: boolean): void {
    this.applyAllPaidState = paid;
    if (paid) {
      this.applyAllSendEmailState = false;
    }
    
    this.bulkTickets.forEach(ticket => {
      ticket.ticket_paid = paid;
      if (paid) {
        ticket.send_email = false;
      } else {
        ticket.payment_processing_fee = 0;
      }
    });
  }

  applyAllProcessingFee(fee: string): void {
    const feeNum = parseFloat(fee);
    if (!isNaN(feeNum) && feeNum >= 0) {
      this.bulkTickets.forEach(ticket => {
        if (ticket.ticket_paid) {
          ticket.payment_processing_fee = feeNum;
        }
      });
    }
  }

  applyAllSendEmail(sendEmail: boolean): void {
    this.bulkTickets.forEach(ticket => {
      if (!ticket.ticket_paid) {
        ticket.send_email = sendEmail;
      }
    });
  }

  applyAllPrice(price: string): void {
    const priceNum = parseFloat(price);
    if (!isNaN(priceNum) && priceNum >= 0) {
      this.bulkTickets.forEach(ticket => {
        ticket.price_per_ticket = priceNum;
      });
    }
  }

  applyAllEntries(entries: string): void {
    const entriesNum = parseInt(entries, 10);
    if (!isNaN(entriesNum) && entriesNum > 0) {
      this.bulkTickets.forEach(ticket => {
        ticket.number_of_entries = entriesNum;
      });
    }
  }

  applyAllReferralCode(referralCode: string): void {
    this.bulkTickets.forEach(ticket => {
      ticket.referral_code = referralCode.trim();
    });
  }

  onApplyAllTicketTypeChange(): void {
    if (this.selectedApplyAllTicketType) {
      this.applyAllTicketType(this.selectedApplyAllTicketType);
      // Reset the dropdown to placeholder after applying
      this.selectedApplyAllTicketType = null;
    }
  }

  applyAllTicketType(ticketTypeId: number): void {
    const selectedType = this.ticketTypes.find(type => type.id === ticketTypeId);
    if (selectedType) {
      this.bulkTickets.forEach(ticket => {
        ticket.ticket_type_id = ticketTypeId;
        ticket.price_per_ticket = selectedType.price;
      });
    }
  }

  onBulkTicketTypeChange(index: number): void {
    const ticket = this.bulkTickets[index];
    const selectedType = this.ticketTypes.find(type => type.id === ticket.ticket_type_id);
    if (selectedType) {
      ticket.price_per_ticket = selectedType.price;
    }
  }

  getBulkTotal(): number {
    return this.bulkTickets.reduce((total, ticket) => {
      return total + (ticket.price_per_ticket * ticket.number_of_entries);
    }, 0);
  }

  getBulkProcessingFeeTotal(): number {
    return this.bulkTickets.reduce((total, ticket) => {
      return total + (ticket.ticket_paid ? ticket.payment_processing_fee : 0);
    }, 0);
  }

  onSubmitBulkTickets(): void {
    if (!this.selectedEvent) return;

    // Validate all tickets
    const invalidTickets = this.bulkTickets.filter(ticket =>
      !ticket.name || !ticket.email_address || !ticket.contact_number || ticket.number_of_entries <= 0
    );

    if (invalidTickets.length > 0) {
      this.notificationService.showError(`Please fill in all required fields for all tickets.`);
      return;
    }

    // Check for sold out ticket types
    const soldOutTickets = this.bulkTickets.filter(ticket => {
      const ticketType = this.ticketTypes.find(tt => tt.id === ticket.ticket_type_id);
      return ticketType && ticketType.is_sold_out;
    });

    if (soldOutTickets.length > 0) {
      this.notificationService.showError(`Cannot create tickets for sold out ticket types. Please update the ticket types for affected rows.`);
      return;
    }

    this.submitting = true;

    const ticketsData = this.bulkTickets.map(ticket => ({
      event_id: this.selectedEvent!.id,
      ticket_type_id: ticket.ticket_type_id,
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number,
      number_of_entries: ticket.number_of_entries,
      send_email: ticket.send_email,
      price_per_ticket: ticket.price_per_ticket,
      payment_processing_fee: ticket.payment_processing_fee,
      referrer_code: ticket.referral_code || undefined,
      ticket_paid: ticket.ticket_paid
    }));
    
    this.subscriptions.add(
      this.eventService.addTicket(ticketsData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess(`${this.bulkTickets.length} custom tickets created successfully!`);
          this.bulkTickets = [];
          this.submitting = false;
          // Always navigate to pending orders after creation since that's where new tickets appear
          this.router.navigate(['/events/abandoned'], { 
            queryParams: { eventId: this.selectedEvent?.id } 
          });
        },
        error: (error) => {
          console.error('Failed to create bulk tickets:', error);
          this.notificationService.showError('Failed to create bulk tickets');
          this.submitting = false;
        }
      })
    );
  }
}