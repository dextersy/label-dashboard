import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { EventService, Event } from '../../services/event.service';
import { environment } from '../../../environments/environment';

// Import tab components
import { EventDetailsTabComponent, EventDetails } from '../../components/events/event-details-tab/event-details-tab.component';
import { EventTicketsTabComponent, EventTicket, TicketSummary } from '../../components/events/event-tickets-tab/event-tickets-tab.component';
import { EventAbandonedOrdersTabComponent, AbandonedOrder, CustomTicketForm } from '../../components/events/event-abandoned-orders-tab/event-abandoned-orders-tab.component';
import { EventReferralsTabComponent, EventReferrer, ReferrerForm } from '../../components/events/event-referrals-tab/event-referrals-tab.component';
import { CreateEventModalComponent, CreateEventForm } from '../../components/events/create-event-modal/create-event-modal.component';
import { EventSelectionComponent } from '../../components/events/event-selection/event-selection.component';

export type EventsTabType = 'details' | 'tickets' | 'abandoned' | 'referrals';

// Using the Event interface from EventService directly
export type EventSelection = Event;

/**
 * Events Component
 * 
 * Manages events for the current brand/label. Events are brand-based, not artist-based.
 * This component loads all events belonging to the user's brand and provides functionality
 * for event management, ticket tracking, and referral management.
 */
@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    EventDetailsTabComponent,
    EventTicketsTabComponent,
    EventAbandonedOrdersTabComponent,
    EventReferralsTabComponent,
    CreateEventModalComponent,
    EventSelectionComponent
  ],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit, OnDestroy {
  selectedEvent: EventSelection | null = null;
  activeTab: EventsTabType = 'details';
  isAdmin = false;
  loading = false;
  retryCount = 0;
  maxRetries = 3;
  showCreateModal = false;
  creatingEvent = false;
  
  // Subscriptions for cleanup
  private subscriptions = new Subscription();

  // Event data for tabs
  eventDetails: EventDetails | null = null;
  eventTickets: EventTicket[] = [];
  abandonedOrders: AbandonedOrder[] = [];
  eventReferrers: EventReferrer[] = [];
  ticketSummary: TicketSummary | null = null;

  // Available events for selection
  availableEvents: EventSelection[] = [];

  tabs = [
    { id: 'details' as EventsTabType, label: 'Details', icon: 'fa-solid fa-info-circle' },
    { id: 'tickets' as EventsTabType, label: 'Tickets', icon: 'fa-solid fa-ticket' },
    { id: 'abandoned' as EventsTabType, label: 'Abandoned Orders', icon: 'fa-solid fa-shopping-cart' },
    { id: 'referrals' as EventsTabType, label: 'Referrals', icon: 'fa-solid fa-user-plus' }
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private eventService: EventService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    // Subscribe to selected event changes
    this.subscriptions.add(
      this.eventService.selectedEvent$.subscribe(event => {
        if (event && event !== this.selectedEvent) {
          this.selectedEvent = event;
          this.loadEventData();
        }
      })
    );

    // Load events on component init - events are brand-based, not artist-based
    this.loadAvailableEvents();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  loadAvailableEvents(): void {
    this.loading = true;
    this.retryCount = 0;
    
    this.subscriptions.add(
      this.eventService.getEvents().subscribe({
        next: (events) => {
          this.availableEvents = events;
          
          // Check if we have a previously selected event that still exists
          const currentSelected = this.eventService.getSelectedEvent();
          if (currentSelected && events.find(e => e.id === currentSelected.id)) {
            this.selectedEvent = events.find(e => e.id === currentSelected.id) || null;
          }
          
          // Auto-select first event if no valid selection exists
          if (events.length > 0 && !this.selectedEvent) {
            this.selectedEvent = events[0];
            this.eventService.setSelectedEvent(events[0]);
          }
          
          // Load event data if we have a selection
          if (this.selectedEvent) {
            this.loadEventData();
          }
          
          this.loading = false;
          this.retryCount = 0;
        },
        error: (error) => {
          console.error('Failed to load events:', error);
          this.notificationService.showError(error.message || 'Failed to load events');
          this.loading = false;
          
          // Show fallback data only in development mode
          if (this.isDevelopmentMode()) {
            this.notificationService.showInfo('Loading fallback data for development');
            this.loadPlaceholderEvents();
          }
        }
      })
    );
  }

  private loadPlaceholderEvents(): void {
    // Placeholder data - to be replaced with actual API calls
    this.availableEvents = [
      {
        id: 1,
        brand_id: 1,
        title: 'Summer Festival 2024',
        date_and_time: '2024-07-15T19:00',
        venue: 'Main Stage Arena',
        ticket_price: 500,
        description: 'Amazing summer festival with live music',
        poster_url: '',
        rsvp_link: '',
        buy_shortlink: '',
        close_time: '2024-07-15T17:00',
        verification_pin: '123456',
        verification_link: 'https://verify.example.com/123456',
        supports_gcash: true,
        supports_qrph: true,
        supports_card: true,
        supports_ubp: false,
        supports_dob: false,
        supports_maya: false,
        supports_grabpay: false,
        max_tickets: 200,
        ticket_naming: 'General Admission'
      },
      {
        id: 2,
        brand_id: 1,
        title: 'Spring Concert',
        date_and_time: '2024-03-20T20:00',
        venue: 'City Hall',
        ticket_price: 400,
        description: 'Spring concert featuring local artists',
        poster_url: '',
        rsvp_link: '',
        buy_shortlink: '',
        close_time: '2024-03-20T18:00',
        verification_pin: '654321',
        verification_link: 'https://verify.example.com/654321',
        supports_gcash: true,
        supports_qrph: true,
        supports_card: true,
        supports_ubp: false,
        supports_dob: false,
        supports_maya: false,
        supports_grabpay: false,
        max_tickets: 150,
        ticket_naming: 'General Admission'
      }
    ];

    // Auto-select first event if available
    if (this.availableEvents.length > 0) {
      this.selectedEvent = this.availableEvents[0];
      this.loadEventData();
    }
  }

  loadEventData(): void {
    if (!this.selectedEvent) return;

    this.loading = true;
    
    // Load event details
    this.subscriptions.add(
      this.eventService.getEvent(this.selectedEvent.id).subscribe({
        next: (event) => {
          // Convert Event to EventDetails format
          this.eventDetails = {
            id: event.id,
            title: event.title,
            date_and_time: event.date_and_time,
            venue: event.venue,
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
            supports_gcash: event.supports_gcash,
            supports_qrph: event.supports_qrph,
            supports_card: event.supports_card,
            supports_ubp: event.supports_ubp,
            supports_dob: event.supports_dob,
            supports_maya: event.supports_maya,
            supports_grabpay: event.supports_grabpay,
            status: this.getEventStatus(event) as 'Open' | 'Closed'
          };
        },
        error: (error) => {
          console.error('Failed to load event details:', error);
          this.notificationService.showError('Failed to load event details');
        }
      })
    );
    
    // Load event tickets
    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id).subscribe({
        next: (tickets) => {
          // Convert API tickets to component format
          this.eventTickets = tickets.map(ticket => ({
            id: ticket.id,
            name: ticket.name,
            email_address: ticket.email_address,
            contact_number: ticket.contact_number || '',
            number_of_entries: ticket.number_of_entries,
            ticket_code: ticket.ticket_code,
            price_per_ticket: ticket.price_per_ticket,
            payment_processing_fee: ticket.payment_processing_fee,
            order_timestamp: ticket.order_timestamp,
            number_of_claimed_entries: ticket.number_of_claimed_entries,
            status: this.normalizeTicketStatus(ticket.status)
          }));
          
          // Filter for abandoned orders (non-confirmed tickets)
          this.abandonedOrders = tickets
            .filter(ticket => ticket.status === 'New' || ticket.status === 'Payment pending')
            .map(ticket => ({
              id: ticket.id,
              name: ticket.name,
              email_address: ticket.email_address,
              contact_number: ticket.contact_number || '',
              number_of_entries: ticket.number_of_entries,
              payment_link: '', // Would need to be added to API response
              order_timestamp: ticket.order_timestamp,
              status: this.normalizeAbandonedOrderStatus(ticket.status)
            }));
          
          // Calculate ticket summary
          this.calculateTicketSummary();
        },
        error: (error) => {
          console.error('Failed to load event tickets:', error);
          this.notificationService.showError('Failed to load event tickets');
        }
      })
    );
    
    // Load event summary for additional stats
    this.subscriptions.add(
      this.eventService.getEventSummary(this.selectedEvent.id).subscribe({
        next: (summary) => {
          // Update ticket summary with API data
          if (this.ticketSummary) {
            this.ticketSummary.total_tickets_sold = summary.total_tickets_sold;
            this.ticketSummary.total_revenue = summary.total_revenue;
          }
        },
        error: (error) => {
          console.error('Failed to load event summary:', error);
        }
      })
    );
    
    this.loading = false;
  }

  private loadPlaceholderEventData(): void {
    // Placeholder event details
    this.eventDetails = {
      id: this.selectedEvent!.id,
      title: this.selectedEvent!.title,
      date_and_time: this.selectedEvent!.date_and_time,
      venue: this.selectedEvent!.venue,
      description: 'Join us for an amazing musical experience!',
      rsvp_link: 'https://facebook.com/events/123456',
      ticket_price: 500,
      max_tickets: 200,
      close_time: '2024-07-15T17:00',
      verification_pin: '123456',
      ticket_naming: 'General Admission',
      supports_gcash: true,
      supports_qrph: true,
      supports_card: true,
      supports_ubp: false,
      supports_dob: false,
      supports_maya: false,
      supports_grabpay: false,
      status: 'Open'
    };

    // Placeholder ticket data
    this.eventTickets = [
      {
        id: 1,
        name: 'John Doe',
        email_address: 'john@example.com',
        contact_number: '+639123456789',
        number_of_entries: 2,
        ticket_code: 'ABC123',
        price_per_ticket: 500,
        payment_processing_fee: 25,
        order_timestamp: '2024-01-15T10:30:00',
        number_of_claimed_entries: 0,
        status: 'Ticket sent.'
      }
    ];

    // Placeholder abandoned orders
    this.abandonedOrders = [
      {
        id: 2,
        name: 'Jane Smith',
        email_address: 'jane@example.com',
        contact_number: '+639987654321',
        number_of_entries: 1,
        payment_link: 'https://payment.link/abc123',
        order_timestamp: '2024-01-14T15:20:00',
        status: 'New'
      }
    ];

    // Placeholder referrers
    this.eventReferrers = [
      {
        id: 1,
        name: 'Music Promoter',
        referral_code: 'SUMMER2024-MUSICPROMOTER',
        tickets_sold: 5,
        gross_amount_sold: 2500,
        net_amount_sold: 2375,
        referral_shortlink: 'https://tickets.example.com/buy/summer2024-musicpromoter'
      }
    ];

    // Placeholder ticket summary
    this.ticketSummary = {
      total_tickets_sold: 2,
      total_revenue: 1000,
      total_processing_fee: 25,
      net_revenue: 975,
      platform_fee: 50,
      grand_total: 925
    };
  }

  onEventSelection(event: EventSelection): void {
    this.selectedEvent = event;
    this.eventService.setSelectedEvent(event);
    this.loadEventData();
  }

  onEventSelectionChange(event: any): void {
    const eventId = parseInt(event.target.value);
    const selectedEvent = this.availableEvents.find(e => e.id === eventId);
    if (selectedEvent) {
      this.onEventSelection(selectedEvent);
    }
  }
  
  
  /**
   * Refresh events from the API
   */
  refreshEvents(): void {
    this.loadAvailableEvents();
  }
  
  /**
   * Open create event modal
   */
  openCreateEventModal(): void {
    this.showCreateModal = true;
  }
  
  /**
   * Close create event modal
   */
  closeCreateEventModal(): void {
    this.showCreateModal = false;
    this.creatingEvent = false;
  }
  
  /**
   * Handle event creation
   */
  onCreateEvent(eventData: CreateEventForm): void {
    this.creatingEvent = true;
    
    this.subscriptions.add(
      this.eventService.createEvent(eventData).subscribe({
        next: (newEvent) => {
          this.onAlertMessage({ type: 'success', text: 'Event created successfully!' });
          this.closeCreateEventModal();
          
          // Add new event to the list and select it
          this.availableEvents.unshift(newEvent);
          this.selectedEvent = newEvent;
          this.eventService.setSelectedEvent(newEvent);
          this.loadEventData();
        },
        error: (error) => {
          console.error('Failed to create event:', error);
          this.onAlertMessage({ type: 'error', text: error.message || 'Failed to create event' });
          this.creatingEvent = false;
        }
      })
    );
  }
  
  
  /**
   * Check if running in development mode
   */
  private isDevelopmentMode(): boolean {
    return !environment.production;
  }
  
  /**
   * Handle component cleanup
   */
  private cleanup(): void {
    this.subscriptions.unsubscribe();
    // Clear any temporary data but preserve selected event
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
  
  private normalizeTicketStatus(status: string): 'Ticket sent.' | 'Payment Confirmed' | 'New' | 'Canceled' {
    // Map various possible API status values to component expected values
    switch (status.toLowerCase()) {
      case 'ticket sent.':
      case 'ticket sent':
        return 'Ticket sent.';
      case 'payment confirmed':
      case 'payment confirmed.':
        return 'Payment Confirmed';
      case 'new':
        return 'New';
      case 'canceled':
      case 'cancelled':
        return 'Canceled';
      default:
        return 'New'; // Default fallback
    }
  }
  
  private normalizeAbandonedOrderStatus(status: string): 'Payment Confirmed' | 'New' | 'Canceled' {
    // Map various possible API status values to abandoned order expected values
    switch (status.toLowerCase()) {
      case 'payment confirmed':
      case 'payment confirmed.':
        return 'Payment Confirmed';
      case 'new':
        return 'New';
      case 'canceled':
      case 'cancelled':
        return 'Canceled';
      default:
        return 'New'; // Default fallback
    }
  }
  
  private calculateTicketSummary(): void {
    const confirmedTickets = this.eventTickets.filter(t => 
      t.status === 'Ticket sent.' || t.status === 'Payment Confirmed'
    );
    
    const totalTicketsSold = confirmedTickets.reduce((sum, ticket) => 
      sum + ticket.number_of_entries, 0
    );
    
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      const ticketRevenue = ticket.price_per_ticket * ticket.number_of_entries;
      return sum + ticketRevenue;
    }, 0);
    
    const totalProcessingFee = confirmedTickets.reduce((sum, ticket) => 
      sum + ticket.payment_processing_fee, 0
    );
    
    const netRevenue = totalRevenue - totalProcessingFee;
    const platformFee = netRevenue * 0.05; // 5% platform fee (adjust as needed)
    const grandTotal = netRevenue - platformFee;
    
    this.ticketSummary = {
      total_tickets_sold: totalTicketsSold,
      total_revenue: totalRevenue,
      total_processing_fee: totalProcessingFee,
      net_revenue: netRevenue,
      platform_fee: platformFee,
      grand_total: grandTotal
    };
  }

  setActiveTab(tabId: EventsTabType): void {
    this.activeTab = tabId;
  }

  getTabClass(tabId: EventsTabType): string {
    return this.activeTab === tabId ? 'active' : '';
  }

  shouldShowTab(tab: any): boolean {
    return !tab.adminOnly || this.isAdmin;
  }

  // Event Details Tab handlers
  onEventUpdate(eventDetails: EventDetails): void {
    if (!this.selectedEvent) return;
    
    const updateData = {
      title: eventDetails.title,
      date_and_time: eventDetails.date_and_time,
      venue: eventDetails.venue,
      description: eventDetails.description,
      poster_url: eventDetails.poster_url,
      rsvp_link: eventDetails.rsvp_link,
      ticket_price: eventDetails.ticket_price,
      close_time: eventDetails.close_time,
      verification_pin: eventDetails.verification_pin,
      verification_link: eventDetails.verification_link,
      buy_shortlink: eventDetails.buy_shortlink,
      ticket_naming: eventDetails.ticket_naming,
      slug: eventDetails.slug, // Send slug to backend for URL generation
      supports_gcash: eventDetails.supports_gcash,
      supports_qrph: eventDetails.supports_qrph,
      supports_card: eventDetails.supports_card,
      supports_ubp: eventDetails.supports_ubp,
      supports_dob: eventDetails.supports_dob,
      supports_maya: eventDetails.supports_maya,
      supports_grabpay: eventDetails.supports_grabpay,
      max_tickets: eventDetails.max_tickets
    };
    
    this.subscriptions.add(
      this.eventService.updateEvent(this.selectedEvent.id, updateData).subscribe({
        next: (updatedEvent) => {
          this.onAlertMessage({ type: 'success', text: 'Event updated successfully!' });
          
          // Update the selected event in the list
          const index = this.availableEvents.findIndex(e => e.id === updatedEvent.id);
          if (index !== -1) {
            this.availableEvents[index] = updatedEvent;
          }
          
          // Update the selected event reference to keep it in sync
          if (this.selectedEvent && this.selectedEvent.id === updatedEvent.id) {
            this.selectedEvent = updatedEvent;
          }
          
          // Refresh event data from API to get any backend-generated fields
          this.refreshEventDetails();
        },
        error: (error) => {
          console.error('Failed to update event:', error);
          this.onAlertMessage({ type: 'error', text: 'Failed to update event' });
        }
      })
    );
  }

  /**
   * Refresh event details from API after save
   */
  private refreshEventDetails(): void {
    if (!this.selectedEvent) return;

    this.subscriptions.add(
      this.eventService.getEvent(this.selectedEvent.id).subscribe({
        next: (event) => {
          // Update the selected event in available events list with fresh data
          const index = this.availableEvents.findIndex(e => e.id === event.id);
          if (index !== -1) {
            this.availableEvents[index] = event;
          }
          
          // Update the selected event reference
          if (this.selectedEvent && this.selectedEvent.id === event.id) {
            this.selectedEvent = event;
          }
          
          // Convert Event to EventDetails format with fresh API data
          this.eventDetails = {
            id: event.id,
            title: event.title,
            date_and_time: event.date_and_time,
            venue: event.venue,
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
            supports_gcash: event.supports_gcash,
            supports_qrph: event.supports_qrph,
            supports_card: event.supports_card,
            supports_ubp: event.supports_ubp,
            supports_dob: event.supports_dob,
            supports_maya: event.supports_maya,
            supports_grabpay: event.supports_grabpay,
            status: this.getEventStatus(event) as 'Open' | 'Closed'
          };
        },
        error: (error) => {
          console.error('Failed to refresh event details:', error);
          // Don't show error to user since the save was successful
        }
      })
    );
  }

  // Event Tickets Tab handlers
  onResendTicket(ticketId: number): void {
    // TODO: Implement API call to resend ticket
    this.onAlertMessage({ type: 'success', text: 'Ticket resent successfully!' });
  }

  onCancelTicket(ticketId: number): void {
    // TODO: Implement API call to cancel ticket
    this.onAlertMessage({ type: 'success', text: 'Ticket cancelled successfully!' });
    // Remove ticket from list
    this.eventTickets = this.eventTickets.filter(t => t.id !== ticketId);
  }

  onDownloadTicketsCSV(): void {
    // TODO: Implement CSV download
    this.onAlertMessage({ type: 'info', text: 'CSV download functionality to be implemented.' });
  }

  // Abandoned Orders Tab handlers
  onMarkAsPaid(orderId: number): void {
    this.subscriptions.add(
      this.eventService.markTicketPaid(orderId).subscribe({
        next: () => {
          this.onAlertMessage({ type: 'success', text: 'Order marked as paid!' });
          // Remove from abandoned orders and add to confirmed tickets
          const order = this.abandonedOrders.find(o => o.id === orderId);
          if (order) {
            this.abandonedOrders = this.abandonedOrders.filter(o => o.id !== orderId);
            // Refresh event data to get updated ticket status
            this.loadEventData();
          }
        },
        error: (error) => {
          console.error('Failed to mark order as paid:', error);
          this.onAlertMessage({ type: 'error', text: 'Failed to mark order as paid' });
        }
      })
    );
  }

  onCancelOrder(orderId: number): void {
    // TODO: Implement API call to cancel order
    this.onAlertMessage({ type: 'success', text: 'Order cancelled successfully!' });
    this.abandonedOrders = this.abandonedOrders.filter(o => o.id !== orderId);
  }

  onVerifyPayments(): void {
    // TODO: Implement API call to verify payments
    this.onAlertMessage({ type: 'info', text: 'Payment verification started.' });
  }

  onSendPaymentReminders(): void {
    // TODO: Implement API call to send payment reminders
    this.onAlertMessage({ type: 'success', text: 'Payment reminders sent!' });
  }

  onCancelAllUnpaid(): void {
    // TODO: Implement API call to cancel all unpaid orders
    this.onAlertMessage({ type: 'success', text: 'All unpaid orders cancelled!' });
    this.abandonedOrders = [];
  }

  onCreateCustomTicket(ticketForm: CustomTicketForm): void {
    if (!this.selectedEvent) return;
    
    const ticketData = {
      event_id: this.selectedEvent.id,
      name: ticketForm.name,
      email_address: ticketForm.email_address,
      contact_number: ticketForm.contact_number,
      number_of_entries: ticketForm.number_of_entries
    };
    
    this.subscriptions.add(
      this.eventService.addTicket(ticketData).subscribe({
        next: (response) => {
          this.onAlertMessage({ type: 'success', text: 'Custom ticket created successfully!' });
          
          // If ticket is marked as paid, mark it as paid immediately
          if (ticketForm.ticket_paid && response.ticket?.id) {
            this.subscriptions.add(
              this.eventService.markTicketPaid(response.ticket.id).subscribe({
                next: () => {
                  this.loadEventData(); // Refresh data
                },
                error: (error) => {
                  console.error('Failed to mark custom ticket as paid:', error);
                }
              })
            );
          } else {
            // Refresh event data to show new ticket
            this.loadEventData();
          }
        },
        error: (error) => {
          console.error('Failed to create custom ticket:', error);
          this.onAlertMessage({ type: 'error', text: 'Failed to create custom ticket' });
        }
      })
    );
  }

  onDownloadAbandonedCSV(): void {
    // TODO: Implement CSV download
    this.onAlertMessage({ type: 'info', text: 'CSV download functionality to be implemented.' });
  }

  // Referrals Tab handlers
  onAddReferrer(referrerForm: ReferrerForm): void {
    // TODO: Implement API call to add referrer
    this.onAlertMessage({ type: 'success', text: 'Referrer added successfully!' });
    
    const newReferrer: EventReferrer = {
      id: Date.now(), // Temporary ID
      name: referrerForm.name,
      referral_code: referrerForm.referral_code,
      tickets_sold: 0,
      gross_amount_sold: 0,
      net_amount_sold: 0,
      referral_shortlink: `https://tickets.example.com/buy/${referrerForm.slug.toLowerCase()}`
    };
    this.eventReferrers.push(newReferrer);
  }

  onAlertMessage(message: { type: string; text: string }): void {
    if (message.type === 'success') {
      this.notificationService.showSuccess(message.text);
    } else if (message.type === 'error') {
      this.notificationService.showError(message.text);
    } else if (message.type === 'info') {
      this.notificationService.showInfo(message.text);
    }
  }
}
