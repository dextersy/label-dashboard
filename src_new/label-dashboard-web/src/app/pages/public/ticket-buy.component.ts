import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PublicService, PublicEvent, TicketPurchaseRequest } from '../../services/public.service';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { MetaService } from '../../services/meta.service';
import { CountdownNotificationComponent } from '../../shared/countdown-notification/countdown-notification.component';
import { checkEmailIssues, EmailTypoResult } from '../../utils/email-typo-detector';

// Angular Material imports (removed MatIconModule to prevent conflicts with FontAwesome)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';


@Component({
    selector: 'app-ticket-buy',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatCheckboxModule,
        CountdownNotificationComponent
    ],
    templateUrl: './ticket-buy.component.html',
    styleUrls: ['./ticket-buy.component.scss']
})
export class TicketBuyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  event: PublicEvent | null = null;
  ticketForm: FormGroup;
  isLoading = false;
  isSubmitting = false;
  isError = false;
  totalAmount = 0;
  brandColor = '#6f42c1';
  referralCode: string | null = null;
  currentBrand: BrandSettings | null = null;
  selectedTicketType: any = null;
  showLightbox = false;
  emailTypoResult: EmailTypoResult | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private publicService: PublicService,
    private brandService: BrandService,
    private metaService: MetaService
  ) {
    this.ticketForm = this.fb.group({
      name: ['', Validators.required],
      email_address: ['', [Validators.required, Validators.email]],
      contact_number: ['', Validators.required],
      number_of_entries: [1, [Validators.required, Validators.min(1)]],
      ticket_type_id: [''],
      referral_code: [''],
      privacy_consent: [false, Validators.requiredTrue]
    });
  }

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const eventId = params['id'];
      if (eventId) {
        this.loadEvent(eventId);
      }
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['ref']) {
        this.referralCode = params['ref'];
        this.ticketForm.patchValue({ referral_code: params['ref'] });
      }
    });

    // Add email typo and name/email mismatch checking
    this.ticketForm.get('email_address')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.checkEmailIssues();
      });

    // Check email issues when name changes too
    this.ticketForm.get('name')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.checkEmailIssues();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up metadata when leaving the page
    this.metaService.clearMetadata();
  }

  loadEvent(eventId: string) {
    this.isLoading = true;
    
    // Load both brand and event information simultaneously
    forkJoin({
      brand: this.brandService.loadBrandByDomain(),
      event: this.publicService.getEvent(parseInt(eventId, 10)),
      availableTicketTypes: this.publicService.getAvailableTicketTypes(parseInt(eventId, 10))
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ brand, event, availableTicketTypes }) => {
          this.currentBrand = brand;
          
          if (event.event) {
            this.event = event.event;

            // Replace event ticket types with filtered available ones
            if (availableTicketTypes && availableTicketTypes.ticketTypes) {
              this.event.ticketTypes = availableTicketTypes.ticketTypes;
            }

            // Additional frontend validation: check if event belongs to current brand
            if (this.event.brand?.id && this.currentBrand?.id && 
                this.event.brand.id !== this.currentBrand.id) {
              console.warn('Event belongs to different brand than current domain');
              this.showError();
              return;
            }
            
            // Set brand color from current brand or event brand
            if (this.currentBrand?.brand_color) {
              this.brandColor = this.currentBrand.brand_color;
            } else if (this.event.brand?.color) {
              this.brandColor = this.event.brand.color;
            }
            
            // Update SEO metadata for social sharing
            this.updatePageMetadata();
            
            // Set default ticket type
            this.initializeTicketType();
            
            this.isLoading = false;
          } else {
            this.showError();
          }
        },
        error: (error) => {
          console.error('Error loading event or brand:', error);
          this.showError();
        }
      });
  }

  showError() {
    this.isLoading = false;
    this.isError = true;
  }

  goBack() {
    window.history.back();
  }

  initializeTicketType() {
    if (!this.event) return;
    
    // If event has ticket types, find the first available (not sold out) one
    if (this.event.ticketTypes && this.event.ticketTypes.length > 0) {
      // Find first available ticket type (not sold out)
      const availableTicketType = this.event.ticketTypes.find(tt => !tt.is_sold_out);

      if (availableTicketType) {
        this.selectedTicketType = availableTicketType;
        this.ticketForm.patchValue({ ticket_type_id: this.selectedTicketType.id });
      } else {
        // All ticket types are sold out, use first one but don't auto-select it
        this.selectedTicketType = this.event.ticketTypes[0];
        // Don't set the form value so no ticket type is pre-selected
      }
    } else {
      // Fall back to legacy fields
      this.selectedTicketType = {
        id: null,
        name: this.event.ticket_naming || 'Regular',
        price: this.event.ticket_price || 0
      };
    }
    
    this.calculateTotal();
  }

  onTicketTypeChange() {
    const ticketTypeId = this.ticketForm.get('ticket_type_id')?.value;
    
    if (this.event?.ticketTypes) {
      this.selectedTicketType = this.event.ticketTypes.find(tt => tt.id == ticketTypeId) || this.selectedTicketType;
    }
    
    this.calculateTotal();
  }

  calculateTotal() {
    const numberOfTickets = this.ticketForm.get('number_of_entries')?.value || 0;
    const ticketPrice = this.selectedTicketType?.price || this.event?.ticket_price || 0;
    this.totalAmount = ticketPrice * numberOfTickets;
  }

  get isEventLoaded(): boolean {
    return this.event !== null;
  }

  canBuyTickets(): boolean {
    if (!this.event) return false;

    // Event is explicitly closed
    if (this.event.is_closed) return false;

    // Check remaining tickets (when max_tickets is set)
    const remainingTickets = this.event.remaining_tickets;
    if (remainingTickets !== null && remainingTickets !== undefined && remainingTickets <= 0) {
      return false;
    }

    // Check if all ticket types are sold out or unavailable
    if (this.event.ticketTypes && this.event.ticketTypes.length > 0) {
      const hasAvailableTicketType = this.event.ticketTypes.some(tt =>
        tt.is_available && !tt.is_sold_out
      );
      if (!hasAvailableTicketType) return false;
    }

    return true;
  }

  getRemainingTicketsDisplay(): number | null {
    if (!this.event) return null;

    const eventRemaining = this.event.remaining_tickets;
    const ticketTypeRemaining = this.selectedTicketType?.remaining_tickets;

    // If neither has a limit, don't display anything
    if ((eventRemaining === null || eventRemaining === undefined) &&
        (ticketTypeRemaining === null || ticketTypeRemaining === undefined)) {
      return null;
    }

    // If only event has a limit
    if (ticketTypeRemaining === null || ticketTypeRemaining === undefined) {
      return eventRemaining || null;
    }

    // If only ticket type has a limit
    if (eventRemaining === null || eventRemaining === undefined) {
      return ticketTypeRemaining;
    }

    // Both have limits - return the smaller (more restrictive) value
    return Math.min(eventRemaining, ticketTypeRemaining);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.ticketForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  formatPrice(price?: number): string {
    if (!price) return '0.00';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatEventDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatEventTime(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  formatVenueDisplay(event: PublicEvent): string {
    if (!event) return '';
    
    // If we have venue address, show structured format: "Venue Name, Address"
    if (event.venue_address && event.venue_address.trim()) {
      return `${event.venue}, ${event.venue_address}`;
    }
    
    // Fallback to just venue name
    return event.venue;
  }

  hasVenueAddress(event: PublicEvent): boolean {
    return !!(event?.venue_address && event.venue_address.trim());
  }

  hasVenueMapsLink(event: PublicEvent): boolean {
    if (!event) return false;
    
    // Only show maps link if we have specific location data (not just venue name)
    return !!(event.venue_maps_url && event.venue_maps_url.trim()) ||
           !!(event.venue_latitude && event.venue_longitude) ||
           !!(event.venue_address && event.venue_address.trim());
  }

  getVenueMapsLink(event: PublicEvent): string {
    if (!event) return '';
    
    // Only generate maps links for specific location data (not just venue name)
    if (event.venue_maps_url && event.venue_maps_url.trim()) {
      return event.venue_maps_url;
    } else if (event.venue_latitude && event.venue_longitude) {
      return `https://www.google.com/maps?q=${event.venue_latitude},${event.venue_longitude}`;
    } else if (event.venue_address && event.venue_address.trim()) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`;
    }
    return '';
  }

  onSubmit() {
    if (this.ticketForm.valid && this.event) {
      // Check if selected ticket type is sold out
      const selectedTicketTypeId = this.ticketForm.value.ticket_type_id;
      const selectedTicketType = this.event.ticketTypes?.find(tt => tt.id == selectedTicketTypeId);

      if (selectedTicketType && selectedTicketType.is_sold_out) {
        alert('The selected ticket type is sold out. Please choose a different ticket type.');
        return;
      }

      // Check if requested tickets exceed available limit
      const requestedTickets = this.ticketForm.value.number_of_entries;
      const availableTickets = this.getRemainingTicketsDisplay();
      if (availableTickets !== null && requestedTickets > availableTickets) {
        alert(`Only ${availableTickets} tickets are available. Please reduce the number of tickets.`);
        return;
      }

      this.isSubmitting = true;
      
      const purchaseRequest: TicketPurchaseRequest = {
        event_id: this.event.id,
        name: this.ticketForm.value.name,
        email_address: this.ticketForm.value.email_address,
        contact_number: this.ticketForm.value.contact_number,
        number_of_entries: this.ticketForm.value.number_of_entries,
        ticket_type_id: this.ticketForm.value.ticket_type_id || undefined,
        referral_code: this.ticketForm.value.referral_code
      };

      this.publicService.buyTicket(purchaseRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success && response.checkout_url) {
              // Redirect to PayMongo checkout
              window.location.href = response.checkout_url;
            }
          },
          error: (error) => {
            console.error('Error purchasing ticket:', error);
            this.isSubmitting = false;
            // Show error message to user
            alert('There was an error processing your ticket purchase. Please try again.');
          }
        });
    }
  }

  private updatePageMetadata(): void {
    if (!this.event) {
      return;
    }

    const brandName = this.currentBrand?.name || this.event.brand?.name;
    this.metaService.updateEventTicketMetadata(this.event, brandName);
  }

  openLightbox() {
    this.showLightbox = true;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeLightbox() {
    this.showLightbox = false;
    document.body.style.overflow = ''; // Restore scrolling
  }

  applySuggestedEmail() {
    if (this.emailTypoResult?.suggestedEmail) {
      this.ticketForm.patchValue({ email_address: this.emailTypoResult.suggestedEmail });
      this.emailTypoResult = null; // Clear the warning after applying
    }
  }

  checkEmailIssues() {
    const name = this.ticketForm.get('name')?.value;
    const email = this.ticketForm.get('email_address')?.value;

    if (email && typeof email === 'string' && email.includes('@')) {
      this.emailTypoResult = checkEmailIssues(email, name);
    } else {
      this.emailTypoResult = null;
    }
  }

}