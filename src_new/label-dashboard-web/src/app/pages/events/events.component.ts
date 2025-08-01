import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { ArtistStateService } from '../../services/artist-state.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

// Import tab components
import { EventDetailsTabComponent, EventDetails } from '../../components/events/event-details-tab/event-details-tab.component';
import { EventTicketsTabComponent, EventTicket, TicketSummary } from '../../components/events/event-tickets-tab/event-tickets-tab.component';
import { EventAbandonedOrdersTabComponent, AbandonedOrder, CustomTicketForm } from '../../components/events/event-abandoned-orders-tab/event-abandoned-orders-tab.component';
import { EventReferralsTabComponent, EventReferrer, ReferrerForm } from '../../components/events/event-referrals-tab/event-referrals-tab.component';

export type EventsTabType = 'details' | 'tickets' | 'abandoned' | 'referrals';

export interface EventSelection {
  id: number;
  title: string;
  date_and_time: string;
  venue: string;
}

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    EventDetailsTabComponent,
    EventTicketsTabComponent,
    EventAbandonedOrdersTabComponent,
    EventReferralsTabComponent
  ],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit {
  selectedArtist: Artist | null = null;
  selectedEvent: EventSelection | null = null;
  activeTab: EventsTabType = 'details';
  isAdmin = false;
  loading = false;

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
    { id: 'abandoned' as EventsTabType, label: 'Abandoned Orders', icon: 'fa-solid fa-clock-o' },
    { id: 'referrals' as EventsTabType, label: 'Referrals', icon: 'fa-solid fa-user-plus' }
  ];

  constructor(
    private artistStateService: ArtistStateService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    
    // Subscribe to artist selection changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
      if (artist) {
        this.loadAvailableEvents();
      }
    });

    // Subscribe to auth state
    this.authService.currentUser.subscribe(user => {
      this.isAdmin = user ? user.is_admin : false;
    });
  }

  loadAvailableEvents(): void {
    if (!this.selectedArtist) return;
    
    this.loading = true;
    // TODO: Implement API calls to load available events
    // For now, using placeholder data
    this.loadPlaceholderEvents();
    this.loading = false;
  }

  private loadPlaceholderEvents(): void {
    // Placeholder data - to be replaced with actual API calls
    this.availableEvents = [
      {
        id: 1,
        title: 'Summer Festival 2024',
        date_and_time: '2024-07-15T19:00',
        venue: 'Main Stage Arena'
      },
      {
        id: 2,
        title: 'Spring Concert',
        date_and_time: '2024-03-20T20:00',
        venue: 'City Hall'
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
    // TODO: Implement API calls to load event-specific data
    this.loadPlaceholderEventData();
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
    this.loadEventData();
  }

  onEventSelectionChange(event: any): void {
    const eventId = parseInt(event.target.value);
    const selectedEvent = this.availableEvents.find(e => e.id === eventId);
    if (selectedEvent) {
      this.onEventSelection(selectedEvent);
    }
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
    // TODO: Implement API call to update event
    this.onAlertMessage({ type: 'success', text: 'Event updated successfully!' });
    this.eventDetails = eventDetails;
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
    // TODO: Implement API call to mark order as paid
    this.onAlertMessage({ type: 'success', text: 'Order marked as paid!' });
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
    // TODO: Implement API call to create custom ticket
    this.onAlertMessage({ type: 'success', text: 'Custom ticket created successfully!' });
    
    // Add to abandoned orders if not marked as paid
    if (!ticketForm.ticket_paid) {
      const newOrder: AbandonedOrder = {
        id: Date.now(), // Temporary ID
        name: ticketForm.name,
        email_address: ticketForm.email_address,
        contact_number: ticketForm.contact_number,
        number_of_entries: ticketForm.number_of_entries,
        order_timestamp: new Date().toISOString(),
        status: 'New'
      };
      this.abandonedOrders.push(newOrder);
    }
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
