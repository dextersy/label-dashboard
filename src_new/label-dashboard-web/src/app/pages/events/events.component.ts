import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { EventService, Event } from '../../services/event.service';
import { environment } from '../../../environments/environment';

// Import tab components
import { EventDetailsTabComponent } from '../../components/events/event-details-tab/event-details-tab.component';
import { EventTicketsTabComponent } from '../../components/events/event-tickets-tab/event-tickets-tab.component';
import { EventAbandonedOrdersTabComponent } from '../../components/events/event-abandoned-orders-tab/event-abandoned-orders-tab.component';
import { EventReferralsTabComponent } from '../../components/events/event-referrals-tab/event-referrals-tab.component';
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
  @ViewChild(CreateEventModalComponent) createEventModal!: CreateEventModalComponent;
  
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

  // Remove tab-specific data since tabs now handle their own data

  // Available events for selection
  availableEvents: EventSelection[] = [];

  tabs = [
    { id: 'details' as EventsTabType, label: 'Details', icon: 'fa-solid fa-info-circle' },
    { id: 'tickets' as EventsTabType, label: 'Tickets', icon: 'fas fa-ticket-alt' },
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
          
          // Reset the form in the modal before closing
          if (this.createEventModal) {
            this.createEventModal.reset();
          }
          
          this.closeCreateEventModal();
          
          // Add new event to the list and select it
          this.availableEvents.unshift(newEvent);
          this.selectedEvent = newEvent;
          this.eventService.setSelectedEvent(newEvent);
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
  
  // Utility methods moved to individual tab components

  setActiveTab(tabId: EventsTabType): void {
    this.activeTab = tabId;
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
}
