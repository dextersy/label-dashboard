import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { PublicService, PublicEvent, TicketPurchaseRequest } from '../../services/public.service';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { MetaService } from '../../services/meta.service';
import { CountdownNotificationComponent } from '../../shared/countdown-notification/countdown-notification.component';

// Angular Material imports (removed MatIconModule to prevent conflicts with FontAwesome)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';


@Component({
  selector: 'app-ticket-buy',
  standalone: true,
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
      event: this.publicService.getEvent(parseInt(eventId, 10))
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ brand, event }) => {
          this.currentBrand = brand;
          
          if (event.event) {
            this.event = event.event;
            
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

  calculateTotal() {
    const numberOfTickets = this.ticketForm.get('number_of_entries')?.value || 0;
    this.totalAmount = (this.event?.ticket_price || 0) * numberOfTickets;
  }

  get isEventLoaded(): boolean {
    return this.event !== null;
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
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  onSubmit() {
    if (this.ticketForm.valid && this.event) {
      this.isSubmitting = true;
      
      const purchaseRequest: TicketPurchaseRequest = {
        event_id: this.event.id,
        name: this.ticketForm.value.name,
        email_address: this.ticketForm.value.email_address,
        contact_number: this.ticketForm.value.contact_number,
        number_of_entries: this.ticketForm.value.number_of_entries,
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
}