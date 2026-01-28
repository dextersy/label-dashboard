import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { EventPublishedService } from '../../services/event-published.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { EventSelectionComponent } from '../../components/events/event-selection/event-selection.component';
import { VenueAutocompleteComponent, VenueSelection } from '../../components/events/venue-autocomplete/venue-autocomplete.component';
import { TicketTypesComponent } from '../../components/events/ticket-types/ticket-types.component';
import { QuillModule } from 'ngx-quill';

export interface TicketType {
  id?: number;
  event_id?: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: string | null;
  end_date?: string | null;
  disabled?: boolean;
  showDateRange?: boolean; // UI state
  isFree?: boolean; // UI state - whether ticket is free
  isUnlimited?: boolean; // UI state - whether ticket has unlimited capacity
}

// Factory function for creating default ticket type
export function createDefaultTicketType(): TicketType {
  return {
    name: 'Regular',
    price: null as any, // blank by default
    max_tickets: 0,
    isFree: false
  };
}

export type EventFormSection = 'details' | 'pricing' | 'purchase' | 'scanner';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbComponent,
    EventSelectionComponent,
    VenueAutocompleteComponent,
    TicketTypesComponent,
    QuillModule
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent implements OnInit, OnDestroy {
  eventId: number | null = null;
  event: any = null;
  loading = false;
  saving = false;
  isNewEvent = false;
  isAdmin = false;
  pinRefreshed = false;
  activeSection: EventFormSection = 'details';
  availableEvents: Event[] = [];
  
  // Form data
  eventData: any = {
    title: '',
    date_and_time: '',
    venue: '',
    description: '',
    rsvp_link: '',
    slug: '',
    poster_url: '',
    google_place_id: '',
    venue_address: '',
    venue_latitude: null,
    venue_longitude: null,
    venue_phone: '',
    venue_website: '',
    venue_maps_url: '',
    // Ticket purchase settings
    max_tickets: 0,
    close_time: '',
    countdown_display: '1_week',
    show_tickets_remaining: true,
    supports_gcash: true,
    supports_qrph: true,
    supports_card: true,
    supports_ubp: true,
    supports_dob: true,
    supports_maya: true,
    supports_grabpay: true,
    // Scanner settings
    verification_pin: '',
    ticket_naming: 'ticket',
    status: 'draft'
  };
  
  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  currentVenueSelection: VenueSelection | null = null;
  ticketTypes: TicketType[] = [];
  originalEventData: any = null;
  originalTicketTypes: TicketType[] = [];
  slugManuallyEdited = false;
  
  // UI state
  isMaxTicketsUnlimited = true;
  closeAtEventStart = true;
  
  // Expose Math for template
  Math = Math;
  
  // Quill editor config
  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  };

  // Character limits for rich text fields (visible characters, not HTML)
  descriptionCharLimit = 5000;
  descriptionCharCount = 0;

  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private eventService: EventService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private eventPublishedService: EventPublishedService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    // Check if this is /events/new or /events/details
    const currentPath = this.router.url.split('?')[0];
    this.isNewEvent = currentPath.endsWith('/new');

    if (this.isNewEvent) {
      // New event mode
      this.initializeNewEvent();
    } else {
      // Edit mode - get event from EventService
      this.loadAvailableEvents();
      this.subscriptions.add(
        this.eventService.selectedEvent$.subscribe(event => {
          if (event) {
            this.event = event;
            this.eventId = event.id;
            this.loadEvent();
          } else if (this.availableEvents.length > 0) {
            // Auto-select first event if none selected
            const firstEvent = this.availableEvents[0];
            this.eventService.setSelectedEvent(firstEvent);
          }
        })
      );
    }

    // Check for section in query params
    this.subscriptions.add(
      this.route.queryParams.subscribe(queryParams => {
        if (queryParams['section']) {
          const requestedSection = queryParams['section'] as EventFormSection;
          // Redirect from scanner section if event is draft
          if (requestedSection === 'scanner' && this.isEventDraft()) {
            this.setActiveSection('details');
          } else {
            this.activeSection = requestedSection;
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadAvailableEvents(): void {
    this.subscriptions.add(
      this.eventService.getEvents().subscribe({
        next: (events) => {
          this.availableEvents = events;
          // Check if there's a selected event from EventService
          const selectedEvent = this.eventService.getSelectedEvent();
          if (!selectedEvent && events.length > 0) {
            this.eventService.setSelectedEvent(events[0]);
          }
        },
        error: (error) => {
          console.error('Error loading events:', error);
          this.notificationService.showError('Failed to load events');
        }
      })
    );
  }

  onEventSelection(event: Event): void {
    this.eventService.setSelectedEvent(event);
  }

  private loadEvent(): void {
    if (!this.eventId) return;

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEvent(this.eventId).subscribe({
        next: (event) => {
          this.event = event;
          this.populateFormFromEvent(event);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading event:', error);
          this.notificationService.showError('Failed to load event details');
          this.loading = false;
          this.router.navigate(['/campaigns/events']);
        }
      })
    );
  }

  private initializeNewEvent(): void {
    // Initialize with default values for new event
    this.event = null;
    this.eventData = {
      title: '',
      date_and_time: '',
      venue: '',
      description: '',
      rsvp_link: '',
      slug: '',
      poster_url: '',
      google_place_id: '',
      venue_address: '',
      venue_latitude: null,
      venue_longitude: null,
      venue_phone: '',
      venue_website: '',
      venue_maps_url: '',
      close_time: '',
      countdown_display: '1_week',
      show_tickets_remaining: true,
      supports_gcash: true,
      supports_qrph: true,
      supports_card: true,
      supports_ubp: true,
      supports_dob: true,
      supports_maya: true,
      supports_grabpay: true,
      verification_pin: '',
      ticket_naming: 'ticket',
      status: 'draft'
    };
    
    // Add default ticket type for new events
    this.ticketTypes = [createDefaultTicketType()];
  }

  setActiveSection(section: EventFormSection): void {
    this.activeSection = section;
    // Update URL without navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge'
    });
  }

  goToNextTab(): void {
    const tabOrder: EventFormSection[] = ['details', 'pricing', 'purchase', 'scanner'];
    const currentIndex = tabOrder.indexOf(this.activeSection);
    
    if (currentIndex >= 0 && currentIndex < tabOrder.length - 1) {
      const nextTab = tabOrder[currentIndex + 1];
      // Skip scanner tab if event is draft
      if (nextTab === 'scanner' && this.isEventDraft()) {
        return; // Stay on current tab if scanner is not available
      }
      this.setActiveSection(nextTab);
    }
  }

  onCancel(): void {
    this.router.navigate(['/campaigns/events']);
  }

  onSave(): void {
    // Always validate with publishing rules to ensure consistency
    if (!this.validateForm(true)) {
      return;
    }

    this.saving = true;
    // Use current status if event is already published, otherwise use 'draft'
    const isPublished = this.isEventPublished();
    const status = isPublished ? 'published' : 'draft';
    const formData = this.prepareFormData(status);

    const saveObservable = this.isNewEvent
      ? this.eventService.createEvent(formData)
      : (this.selectedPosterFile
          ? this.eventService.updateEventWithFile(this.eventId!, this.prepareFormDataForUpdate(status))
          : this.eventService.updateEvent(this.eventId!, this.prepareEventData(status)));

    this.subscriptions.add(
      saveObservable.subscribe({
        next: (event) => {
          const message = this.isEventPublished() ? 'Event updated successfully' : 'Event saved as draft';
          this.notificationService.showSuccess(message);
          this.saving = false;
          if (this.isNewEvent) {
            // Set the newly created event as selected and navigate to details
            this.eventService.setSelectedEvent(event);
            this.router.navigate(['/campaigns/events/details']);
          } else {
            // Update the event object and reset dirty tracking without repopulating form
            this.event = event;
            this.eventService.setSelectedEvent(event);
            // Update originalEventData to match current form state (what was just saved)
            this.originalEventData = JSON.parse(JSON.stringify(this.eventData));
            this.originalTicketTypes = JSON.parse(JSON.stringify(this.ticketTypes));
            // Clear the selected poster file since it's now uploaded
            this.selectedPosterFile = null;
            // Clear the PIN refreshed flag
            this.pinRefreshed = false;
          }
        },
        error: (error) => {
          console.error('Error saving event:', error);
          this.notificationService.showError('Failed to save event');
          this.saving = false;
          // Refresh event data to restore form to last saved state
          if (!this.isNewEvent && this.eventId) {
            this.loadEvent();
          }
        }
      })
    );
  }

  async onPublish(): Promise<void> {
    if (!this.validateForm(true)) {
      return;
    }

    const confirmed = await this.confirmationService.confirm({
      title: 'Publish Event',
      message: 'Are you sure you want to publish this event?\n\n' +
        '⚠️ WARNING: Once published, the shortlinks can no longer be changed and the event will be visible to the public.\n\n' +
        'Click \'Publish\' to proceed with publishing.',
      confirmText: 'Publish',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) return;

    this.saving = true;
    const formData = this.prepareFormData('published');

    const saveObservable = this.isNewEvent
      ? this.eventService.createEvent(formData)
      : (this.selectedPosterFile
          ? this.eventService.updateEventWithFile(this.eventId!, this.prepareFormDataForUpdate('published'))
          : this.eventService.updateEvent(this.eventId!, this.prepareEventData('published')));

    this.subscriptions.add(
      saveObservable.subscribe({
        next: (event) => {
          this.saving = false;
          this.event = event;
          this.eventService.setSelectedEvent(event);
          
          // Show the event published modal
          if (event.buy_shortlink) {
            this.eventPublishedService.show({
              eventTitle: event.title,
              buyLink: event.buy_shortlink
            });
          }
          
          if (this.isNewEvent) {
            // Navigate to details view for newly published events
            this.router.navigate(['/campaigns/events/details']);
          } else {
            this.populateFormFromEvent(event);
          }
        },
        error: (error) => {
          console.error('Error publishing event:', error);
          this.notificationService.showError('Failed to publish event');
          this.saving = false;
        }
      })
    );
  }

  onVenueSelected(venueSelection: VenueSelection | null): void {
    this.currentVenueSelection = venueSelection;
    if (venueSelection) {
      this.eventData.venue = venueSelection.venue;
      this.eventData.google_place_id = venueSelection.google_place_id;
      this.eventData.venue_address = venueSelection.venue_address;
      this.eventData.venue_latitude = venueSelection.venue_latitude;
      this.eventData.venue_longitude = venueSelection.venue_longitude;
      this.eventData.venue_phone = venueSelection.venue_phone;
      this.eventData.venue_website = venueSelection.venue_website;
      this.eventData.venue_maps_url = venueSelection.venue_maps_url;
    } else {
      this.eventData.venue = '';
      this.eventData.google_place_id = '';
      this.eventData.venue_address = '';
      this.eventData.venue_latitude = null;
      this.eventData.venue_longitude = null;
      this.eventData.venue_phone = '';
      this.eventData.venue_website = '';
      this.eventData.venue_maps_url = '';
    }
  }

  onPosterSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.notificationService.showError('Please select a valid image file (JPG, PNG, GIF).');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.notificationService.showError('File is too large. Please select an image smaller than 10MB.');
        return;
      }

      this.selectedPosterFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.posterPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onPosterUploadKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Find the poster input element and trigger click
      const posterInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      if (posterInput) {
        posterInput.click();
      }
    }
  }

  removePoster(): void {
    this.selectedPosterFile = null;
    this.posterPreview = null;
    this.eventData.poster_url = '';
  }

  generateSlug(): void {
    if (this.eventData.title) {
      // Convert to PascalCase: split by spaces/special chars, capitalize each word, then join
      const pascalCase = this.eventData.title
        .split(/[\s\W]+/) // Split by spaces and non-word characters
        .filter((word: string) => word.length > 0) // Remove empty strings
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, lowercase rest
        .join(''); // Join without spaces
      
      this.eventData.slug = pascalCase;
      this.slugManuallyEdited = false; // Reset flag when auto-generating
    }
  }

  onSlugChange(): void {
    // Mark slug as manually edited when user types in the field
    this.slugManuallyEdited = true;
  }

  onTitleChange(): void {
    // Auto-generate slug for draft events unless manually edited
    if (this.isEventDraft() && !this.slugManuallyEdited) {
      this.generateSlug();
    }
  }

  setSuggestedCloseTime(interval: string): void {
    if (!this.eventData.date_and_time) {
      this.notificationService.showError('Please set the event date and time first');
      return;
    }

    const eventDate = new Date(this.eventData.date_and_time);
    let closeDate: Date;

    switch (interval) {
      case '1h':
        closeDate = new Date(eventDate.getTime() - 60 * 60 * 1000);
        break;
      case '3h':
        closeDate = new Date(eventDate.getTime() - 3 * 60 * 60 * 1000);
        break;
      case '1d':
        closeDate = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '3d':
        closeDate = new Date(eventDate.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    // Format to datetime-local input format
    const year = closeDate.getFullYear();
    const month = String(closeDate.getMonth() + 1).padStart(2, '0');
    const day = String(closeDate.getDate()).padStart(2, '0');
    const hours = String(closeDate.getHours()).padStart(2, '0');
    const minutes = String(closeDate.getMinutes()).padStart(2, '0');
    
    this.eventData.close_time = `${year}-${month}-${day}T${hours}:${minutes}`;
    this.closeAtEventStart = false; // Turn off the switch when setting a specific time
  }

  onCloseAtEventStartChange(enabled: boolean): void {
    if (enabled) {
      // Clear the close time when enabling "End during show start"
      this.eventData.close_time = '';
    }
  }

  addTicketType(): void {
    this.ticketTypes.push(createDefaultTicketType());
  }

  removeTicketType(index: number): void {
    if (this.ticketTypes.length > 1) {
      this.ticketTypes.splice(index, 1);
    }
  }

  onTicketTypesChanged(): void {
    // Mark form as dirty when ticket types change
    // (ticketTypes is already updated via two-way binding)
    this.originalEventData = this.originalEventData || JSON.parse(JSON.stringify(this.eventData));
    // No need to reload event from backend here; just update dirty state
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.notificationService.showSuccess('Copied to clipboard!');
    }).catch(() => {
      this.notificationService.showError('Failed to copy to clipboard');
    });
  }

  generateVerificationPIN(): void {
    this.eventData.verification_pin = Math.floor(100000 + Math.random() * 900000).toString();
    this.pinRefreshed = true;
  }

  copyVerificationPIN(): void {
    if (this.eventData.verification_pin) {
      navigator.clipboard.writeText(this.eventData.verification_pin).then(() => {
        this.notificationService.showSuccess('PIN copied to clipboard');
      }).catch(() => {
        this.notificationService.showError('Failed to copy PIN');
      });
    }
  }

  onDescriptionContentChanged(event: any): void {
    // event.text contains the plain text without HTML tags
    // Quill adds a trailing newline, so we trim it
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.descriptionCharCount = text.length;
  }

  isEventDraft(): boolean {
    if (this.isNewEvent) return true;
    const status = (this.event as any)?.status || this.eventData?.status;
    return status === 'draft' || !status;
  }

  isEventPublished(): boolean {
    if (this.isNewEvent) return false;
    const status = (this.event as any)?.status || this.eventData?.status;
    return status === 'published';
  }

  isEventPast(): boolean {
    // Always reflect the current form value (even if unsaved)
    const dateAndTime = this.eventData?.date_and_time || this.event?.date_and_time;
    if (!dateAndTime) return false;
    const eventDate = new Date(dateAndTime);
    const now = new Date();
    return eventDate < now;

  }


  hasConfirmedTickets(): boolean {
    return (this.event?.tickets?.filter((ticket: any) => 
      ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.'
    ).length || 0) > 0;
  }

  isFormDirty(): boolean {
    if (!this.originalEventData) return false;
    // Compare eventData
    const eventDataChanged = JSON.stringify(this.eventData) !== JSON.stringify(this.originalEventData);
    // Compare ticketTypes (deep compare, ignoring UI-only fields)
    const stripUiFields = (arr: TicketType[]) => arr.map(tt => {
      const { showDateRange, isFree, isUnlimited, ...rest } = tt;
      return rest;
    });
    const ticketTypesChanged = JSON.stringify(stripUiFields(this.ticketTypes)) !== JSON.stringify(stripUiFields(this.originalTicketTypes));
    return eventDataChanged || ticketTypesChanged || this.selectedPosterFile !== null;
  }

  async onUnpublish(): Promise<void> {
    if (!this.eventId) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Unpublish Event',
      message: 'Are you sure you want to unpublish this event? It will no longer be visible to the public and ticket sales will stop.',
      confirmText: 'Unpublish',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    this.saving = true;

    this.subscriptions.add(
      this.eventService.unpublishEvent(this.eventId).subscribe({
        next: (event) => {
          this.saving = false;
          this.event = event;
          this.eventService.setSelectedEvent(event);
          this.populateFormFromEvent(event);
          this.notificationService.showSuccess('Event unpublished successfully');
        },
        error: (error) => {
          console.error('Error unpublishing event:', error);
          this.notificationService.showError('Failed to unpublish event');
          this.saving = false;
        }
      })
    );
  }

  private validateForm(isPublishing: boolean = false): boolean {
    if (!this.eventData.title || !this.eventData.title.trim()) {
      this.notificationService.showError('Event title is required');
      this.setActiveSection('details');
      return false;
    }

    if (!this.eventData.date_and_time) {
      this.notificationService.showError('Event date and time is required');
      this.setActiveSection('details');
      return false;
    }

    if (!this.eventData.venue || !this.eventData.venue.trim()) {
      this.notificationService.showError('Venue is required');
      this.setActiveSection('details');
      return false;
    }

    // Slug is only required for draft/new events, not for published events being updated
    if (this.isEventDraft() && (!this.eventData.slug || !this.eventData.slug.trim())) {
      this.notificationService.showError('Slug is required');
      this.setActiveSection('details');
      return false;
    }

    if (isPublishing) {
      if (this.ticketTypes.length === 0) {
        this.notificationService.showError('At least one ticket type is required to publish');
        this.setActiveSection('pricing');
        return false;
      }

      // Check if at least one payment method is enabled (accept any truthy value)
      const hasPaymentMethod = !!this.eventData.supports_gcash ||
                               !!this.eventData.supports_qrph ||
                               !!this.eventData.supports_card ||
                               !!this.eventData.supports_ubp ||
                               !!this.eventData.supports_dob ||
                               !!this.eventData.supports_maya ||
                               !!this.eventData.supports_grabpay;

      if (!hasPaymentMethod) {
        this.notificationService.showError('At least one payment method must be enabled to publish');
        this.setActiveSection('purchase');
        return false;
      }

      for (const ticketType of this.ticketTypes) {
        if (!ticketType.name || !ticketType.name.trim()) {
          this.notificationService.showError('All ticket types must have a name');
          this.setActiveSection('pricing');
          return false;
        }
        if (ticketType.price === null || ticketType.price === undefined || isNaN(ticketType.price)) {
          this.notificationService.showError('All ticket types must have a valid ticket price');
          this.setActiveSection('pricing');
          return false;
        }
        if (ticketType.price < 0) {
          this.notificationService.showError('Ticket prices cannot be negative');
          this.setActiveSection('pricing');
          return false;
        }
        if (ticketType.max_tickets < 0) {
          this.notificationService.showError('Max tickets cannot be negative');
          this.setActiveSection('pricing');
          return false;
        }
      }
    }

    return true;
  }

  private prepareFormData(status: 'draft' | 'published'): any {
    // Convert ticketTypes date fields to ISO string for API
    const ticketTypesForApi = this.ticketTypes.map(tt => ({
      ...tt,
      start_date: tt.start_date ? new Date(tt.start_date).toISOString() : null,
      end_date: tt.end_date ? new Date(tt.end_date).toISOString() : null
    }));

    const formData: any = {
      title: this.eventData.title,
      date_and_time: this.formatDateForAPI(this.eventData.date_and_time),
      venue: this.currentVenueSelection?.venue || this.eventData.venue,
      description: this.eventData.description || '',
      ticket_price: this.ticketTypes.length > 0 ? this.ticketTypes[0].price : 0,
      max_tickets: this.isMaxTicketsUnlimited ? 0 : Number(this.eventData.max_tickets),
      close_time: this.closeAtEventStart ? '' : (this.eventData.close_time ? this.formatDateForAPI(this.eventData.close_time) : ''),
      rsvp_link: this.eventData.rsvp_link || '',
      slug: this.eventData.slug,
      status: status,
      countdown_display: this.eventData.countdown_display,
      show_tickets_remaining: this.eventData.show_tickets_remaining,
      supports_gcash: this.eventData.supports_gcash,
      supports_qrph: this.eventData.supports_qrph,
      supports_card: this.eventData.supports_card,
      supports_ubp: this.eventData.supports_ubp,
      supports_dob: this.eventData.supports_dob,
      supports_maya: this.eventData.supports_maya,
      supports_grabpay: this.eventData.supports_grabpay,
      verification_pin: this.eventData.verification_pin || '',
      ticket_naming: this.eventData.ticket_naming || 'ticket',
      ticketTypes: ticketTypesForApi
    };

    if (this.currentVenueSelection) {
      formData.google_place_id = this.currentVenueSelection.google_place_id;
      formData.venue_address = this.currentVenueSelection.venue_address;
      formData.venue_latitude = this.currentVenueSelection.venue_latitude;
      formData.venue_longitude = this.currentVenueSelection.venue_longitude;
      formData.venue_phone = this.currentVenueSelection.venue_phone;
      formData.venue_website = this.currentVenueSelection.venue_website;
      formData.venue_maps_url = this.currentVenueSelection.venue_maps_url;
    }

    if (this.selectedPosterFile) {
      formData.poster_file = this.selectedPosterFile;
    }

    return formData;
  }

  private prepareFormDataForUpdate(status: 'draft' | 'published'): FormData {
    const formData = new FormData();
    const eventData = this.prepareEventData(status);

    Object.keys(eventData).forEach(key => {
      if (key === 'ticketTypes') {
        formData.append(key, JSON.stringify(eventData[key]));
      } else if (eventData[key] !== null && eventData[key] !== undefined) {
        formData.append(key, eventData[key].toString());
      }
    });

    if (this.selectedPosterFile) {
      formData.append('poster', this.selectedPosterFile);
    }

    return formData;
  }

  private prepareEventData(status: 'draft' | 'published'): any {
    // Convert ticketTypes date fields to ISO string for API
    const ticketTypesForApi = this.ticketTypes.map(tt => ({
      ...tt,
      start_date: tt.start_date ? new Date(tt.start_date).toISOString() : null,
      end_date: tt.end_date ? new Date(tt.end_date).toISOString() : null
    }));

    const eventData: any = {
      title: this.eventData.title,
      date_and_time: this.formatDateForAPI(this.eventData.date_and_time),
      venue: this.eventData.venue,
      description: this.eventData.description || '',
      ticket_price: this.ticketTypes.length > 0 ? this.ticketTypes[0].price : 0,
      max_tickets: this.isMaxTicketsUnlimited ? 0 : Number(this.eventData.max_tickets),
      close_time: this.closeAtEventStart ? '' : (this.eventData.close_time ? this.formatDateForAPI(this.eventData.close_time) : ''),
      rsvp_link: this.eventData.rsvp_link || '',
      slug: this.eventData.slug,
      status: status,
      countdown_display: this.eventData.countdown_display,
      show_tickets_remaining: this.eventData.show_tickets_remaining,
      supports_gcash: this.eventData.supports_gcash,
      supports_qrph: this.eventData.supports_qrph,
      supports_card: this.eventData.supports_card,
      supports_ubp: this.eventData.supports_ubp,
      supports_dob: this.eventData.supports_dob,
      supports_maya: this.eventData.supports_maya,
      supports_grabpay: this.eventData.supports_grabpay,
      verification_pin: this.eventData.verification_pin || '',
      ticket_naming: this.eventData.ticket_naming || 'ticket',
      ticketTypes: ticketTypesForApi
    };

    if (this.currentVenueSelection) {
      eventData.google_place_id = this.currentVenueSelection.google_place_id;
      eventData.venue_address = this.currentVenueSelection.venue_address;
      eventData.venue_latitude = this.currentVenueSelection.venue_latitude;
      eventData.venue_longitude = this.currentVenueSelection.venue_longitude;
      eventData.venue_phone = this.currentVenueSelection.venue_phone;
      eventData.venue_website = this.currentVenueSelection.venue_website;
      eventData.venue_maps_url = this.currentVenueSelection.venue_maps_url;
    }

    return eventData;
  }

  private populateFormFromEvent(event: any): void {
    // Clear poster preview when loading a new event
    this.posterPreview = null;
    this.selectedPosterFile = null;

    this.eventData = {
      title: event.title || '',
      date_and_time: this.formatDateForInput(event.date_and_time),
      venue: event.venue || '',
      description: event.description || '',
      rsvp_link: event.rsvp_link || '',
      slug: event.slug || '',
      poster_url: event.poster_url || '',
      google_place_id: event.google_place_id || '',
      venue_address: event.venue_address || '',
      venue_latitude: event.venue_latitude || null,
      venue_longitude: event.venue_longitude || null,
      venue_phone: event.venue_phone || '',
      venue_website: event.venue_website || '',
      venue_maps_url: event.venue_maps_url || '',
      max_tickets: event.max_tickets || 0,
      close_time: event.close_time ? this.formatDateForInput(event.close_time) : '',
      countdown_display: event.countdown_display || '1_week',
      show_tickets_remaining: event.show_tickets_remaining,
      supports_gcash: event.supports_gcash,
      supports_qrph: event.supports_qrph,
      supports_card: event.supports_card,
      supports_ubp: event.supports_ubp,
      supports_dob: event.supports_dob,
      supports_maya: event.supports_maya,
      supports_grabpay: event.supports_grabpay,
      verification_pin: event.verification_pin || '',
      ticket_naming: event.ticket_naming || 'ticket',
      status: (event as any).status || 'draft'
    };

    // Set unlimited state based on max_tickets
    this.isMaxTicketsUnlimited = !event.max_tickets || event.max_tickets === 0;
    
    // Set close at event start state based on close_time
    this.closeAtEventStart = !event.close_time;

    if (event.google_place_id) {
      this.currentVenueSelection = {
        venue: event.venue,
        google_place_id: event.google_place_id,
        venue_address: event.venue_address,
        venue_latitude: event.venue_latitude,
        venue_longitude: event.venue_longitude,
        venue_phone: event.venue_phone,
        venue_website: event.venue_website,
        venue_maps_url: event.venue_maps_url
      };
    }

    if (this.eventId) {
      this.loadTicketTypes();
    }

    if (event.poster_url) {
      this.posterPreview = event.poster_url;
    }

    // Auto-generate slug for draft events if not set
    if (this.isEventDraft() && !this.eventData.slug && this.eventData.title) {
      this.generateSlug();
    }

    // Store original data for dirty checking
    this.originalEventData = JSON.parse(JSON.stringify(this.eventData));
  }

  private loadTicketTypes(): void {
    if (!this.eventId) return;

    this.subscriptions.add(
      this.eventService.getTicketTypes(this.eventId).subscribe({
        next: (response) => {
          this.ticketTypes = response.ticketTypes || [];
          this.originalTicketTypes = JSON.parse(JSON.stringify(this.ticketTypes));
        },
        error: (error) => {
          console.error('Error loading ticket types:', error);
          this.notificationService.showError('Failed to load ticket types');
        }
      })
    );
  }

  private formatDateForAPI(dateString: string): string {
    if (!dateString) return '';

    try {
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

  private formatDateForInput(isoString: string): string {
    if (!isoString) return '';

    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return '';
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date for input:', isoString, error);
      return '';
    }
  }
}
