import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { EventService, Event } from '../../services/event.service';
import { environment } from '../../../environments/environment';

// Import tab components
import { EventTicketsTabComponent } from '../../components/events/event-tickets-tab/event-tickets-tab.component';
import { EventAbandonedOrdersTabComponent } from '../../components/events/event-abandoned-orders-tab/event-abandoned-orders-tab.component';
import { EventReferralsTabComponent } from '../../components/events/event-referrals-tab/event-referrals-tab.component';
import { EventEmailTabComponent } from '../../components/events/event-email-tab/event-email-tab.component';
import { EventSelectionComponent } from '../../components/events/event-selection/event-selection.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

export type EventsTabType = 'tickets' | 'abandoned' | 'referrals' | 'email';

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
    imports: [
        CommonModule,
        FormsModule,
        EventTicketsTabComponent,
        EventAbandonedOrdersTabComponent,
        EventReferralsTabComponent,
        EventEmailTabComponent,
        EventSelectionComponent,
        BreadcrumbComponent
    ],
    templateUrl: './events.component.html',
    styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit, OnDestroy {
  selectedEvent: EventSelection | null = null;
  activeTab: EventsTabType = 'tickets';
  isAdmin = false;
  loading = false;
  retryCount = 0;
  maxRetries = 3;
  
  // Subscriptions for cleanup
  private subscriptions = new Subscription();

  // Remove tab-specific data since tabs now handle their own data

  // Available events for selection
  availableEvents: EventSelection[] = [];

  tabs = [
    { id: 'tickets' as EventsTabType, label: 'Tickets', icon: 'fas fa-ticket-alt' },
    { id: 'abandoned' as EventsTabType, label: 'Pending Orders', icon: 'fa-solid fa-shopping-cart' },
    { id: 'referrals' as EventsTabType, label: 'Referrals', icon: 'fa-solid fa-user-plus' },
    { id: 'email' as EventsTabType, label: 'Email Ticket Holders', icon: 'fas fa-envelope', adminOnly: true }
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private eventService: EventService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  /**
   * Check if event is in the past (has already occurred)
   */
  isEventPast(event: EventSelection | null): boolean {
    if (!event) return false;
    const eventDate = new Date(event.date_and_time);
    const now = new Date();
    return eventDate < now;
  }

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
        }
      })
    );

    // Subscribe to route data changes to determine active tab
    this.subscriptions.add(
      this.route.data.subscribe(data => {
        if (data['tab']) {
          this.activeTab = data['tab'] as EventsTabType;
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
          
          // Check if we have a previously selected event from localStorage
          const currentSelected = this.eventService.getSelectedEvent();
          let eventToSelect: Event | null = null;
          
          if (currentSelected && events.find(e => e.id === currentSelected.id)) {
            // Stored event still exists in the list
            eventToSelect = events.find(e => e.id === currentSelected.id) || null;
          }
          
          // Auto-select first event if no valid selection exists
          if (events.length > 0 && !eventToSelect) {
            eventToSelect = events[0];
          }
          
          // Set the selected event
          if (eventToSelect) {
            this.selectedEvent = eventToSelect;
            this.eventService.setSelectedEvent(eventToSelect);
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
    }
  }

  // Removed loadEventData and loadPlaceholderEventData - tabs now handle their own data loading

  onEventSelection(event: EventSelection): void {
    this.selectedEvent = event;
    this.eventService.setSelectedEvent(event);
    // Auto-refresh data when event selection changes
    this.refreshCurrentTabData();
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
   * Navigate to create new event page
   */
  openCreateEventModal(): void {
    this.router.navigate(['/campaigns/events/new']);
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
  
  // Utility methods moved to individual tab components

  setActiveTab(tabId: EventsTabType): void {
    this.activeTab = tabId;
    this.router.navigate(['/campaigns/events', tabId]);
    // Auto-refresh data when tab changes
    this.refreshCurrentTabData();
  }

  getTabClass(tabId: EventsTabType): string {
    return this.activeTab === tabId ? 'active' : '';
  }

  shouldShowTab(tab: any): boolean {
    return !tab.adminOnly || this.isAdmin;
  }

  // Simplified event handlers - tabs now handle their own logic
  onEventUpdated(updatedEvent: Event): void {
    // Update the selected event in the list
    const index = this.availableEvents.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
      this.availableEvents[index] = updatedEvent;
    }
    
    // Update the selected event reference to keep it in sync
    if (this.selectedEvent && this.selectedEvent.id === updatedEvent.id) {
      this.selectedEvent = updatedEvent;
    }
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

  /**
   * Auto-refresh data for the current active tab
   */
  private refreshCurrentTabData(): void {
    // Add a small delay to ensure the tab component is ready
    setTimeout(() => {
      // Emit a refresh event that tab components can listen to
      // This triggers the individual tab components to reload their data
      this.eventService.triggerDataRefresh();
    }, 100);
  }
}
