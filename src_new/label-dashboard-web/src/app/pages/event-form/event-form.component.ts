import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../services/event.service';
import { NotificationService } from '../../services/notification.service';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { VenueAutocompleteComponent, VenueSelection } from '../../components/events/venue-autocomplete/venue-autocomplete.component';
import { QuillModule } from 'ngx-quill';

export type EventFormSection = 'general' | 'purchase' | 'ticket-types' | 'scanner';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbComponent,
    VenueAutocompleteComponent,
    QuillModule
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent implements OnInit, OnDestroy {
  eventId: number | null = null;
  event: any = null;
  loading = false;
  isNewEvent = false;
  activeSection: EventFormSection = 'general';
  
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
    venue_maps_url: ''
  };
  
  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  currentVenueSelection: VenueSelection | null = null;
  
  // Quill editor config
  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  };
  
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private notificationService: NotificationService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    // Check if this is a new event or editing existing
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.eventId = +params['id'];
          this.isNewEvent = false;
          this.loadEvent();
        } else {
          this.isNewEvent = true;
          this.initializeNewEvent();
        }
        this.updateBreadcrumbs();
      })
    );

    // Check for section in query params
    this.subscriptions.add(
      this.route.queryParams.subscribe(queryParams => {
        if (queryParams['section']) {
          this.activeSection = queryParams['section'] as EventFormSection;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEvent(): void {
    if (!this.eventId) return;

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEvent(this.eventId).subscribe({
        next: (event) => {
          this.event = event;
          this.loading = false;
          this.updateBreadcrumbs();
        },
        error: (error) => {
          console.error('Error loading event:', error);
          this.notificationService.showError('Failed to load event details');
          this.loading = false;
          this.router.navigate(['/events']);
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
      venue_maps_url: ''
    };
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

  onCancel(): void {
    this.router.navigate(['/events']);
  }

  onSaveDraft(): void {
    // TODO: Implement save as draft
    this.notificationService.showSuccess('Event saved as draft');
  }

  onPublish(): void {
    // TODO: Implement publish
    this.notificationService.showSuccess('Event published successfully!');
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

  removePoster(): void {
    this.selectedPosterFile = null;
    this.posterPreview = null;
    this.eventData.poster_url = '';
  }

  generateSlug(): void {
    if (this.eventData.title) {
      this.eventData.slug = this.eventData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .substring(0, 50);
    }
  }

  onTitleChange(): void {
    // Auto-generate slug for new events if slug is empty
    if (this.isNewEvent && !this.eventData.slug) {
      this.generateSlug();
    }
  }

  private updateBreadcrumbs(): void {
    const breadcrumbs = [
      { label: 'Events', url: '/events' }
    ];

    if (this.isNewEvent) {
      breadcrumbs.push({ label: 'New Event', url: '' });
    } else if (this.event) {
      breadcrumbs.push({ label: this.event.title, url: '' });
    }

    this.breadcrumbService.setBreadcrumbs(breadcrumbs);
  }
}
