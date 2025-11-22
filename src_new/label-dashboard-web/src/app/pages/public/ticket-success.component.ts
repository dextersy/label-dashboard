import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicService, TicketDetails, TicketVerificationRequest, PublicEvent } from '../../services/public.service';


@Component({
    selector: 'app-ticket-success',
    imports: [CommonModule],
    templateUrl: './ticket-success.component.html',
    styleUrls: ['./ticket-success.component.scss']
})
export class TicketSuccessComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isLoading = true;
  isSuccess = false;
  isError = false;
  ticketDetails: TicketDetails | null = null;
  event: PublicEvent | null = null;

  constructor(
    private publicService: PublicService
  ) {}

  ngOnInit() {
    // Load ticket details from cookie (no route params needed)
    this.loadTicketFromCookie();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTicketFromCookie() {
    this.publicService.getTicketFromCookie()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success && response.ticket) {
            this.isSuccess = true;
            // Convert the ticket response to TicketDetails format
            this.ticketDetails = {
              ticket_code: response.ticket.ticket_code,
              name: response.ticket.name,
              number_of_entries: response.ticket.number_of_entries,
              status: response.ticket.status,
              event: {
                title: response.ticket.event?.title || '',
                date_and_time: response.ticket.event?.date_and_time || '',
                venue: response.ticket.event?.venue || ''
              }
            };
            // Store event data separately (only fields provided by backend or needed for display)
            if (response.ticket.event) {
              this.event = {
                id: response.ticket.event.id,
                title: response.ticket.event.title,
                date_and_time: response.ticket.event.date_and_time,
                venue: response.ticket.event.venue,
                venue_address: response.ticket.event.venue_address,
                venue_maps_url: response.ticket.event.venue_maps_url,
                poster_url: response.ticket.event.poster_url,
                ticket_price: response.ticket.price_per_ticket,
                ticket_naming: response.ticket.ticketType?.name || 'Regular',
                brand: response.ticket.event.brand ? {
                  id: response.ticket.event.brand.id,
                  name: response.ticket.event.brand.name,
                  color: response.ticket.event.brand.color,
                  logo_url: response.ticket.event.brand.logo_url
                } : undefined
              } as PublicEvent;
            }
          } else {
            this.isSuccess = false;
            this.showError();
          }
        },
        error: (error) => {
          console.error('Error loading ticket from cookie:', error);
          this.isLoading = false;
          this.isSuccess = false;
          this.showError();
        }
      });
  }

  downloadPDF() {
    this.publicService.downloadTicketPDF();
  }

  showError() {
    this.isLoading = false;
    this.isSuccess = false;
    this.isError = true;
  }

  formatEventDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  checkEmail() {
    // Open default email client
    window.location.href = 'mailto:';
  }

  goToEventPage() {
    // Navigate back to event info or close window
    window.history.back();
  }

  contactSupport() {
    const eventTitle = this.event?.title || (this.ticketDetails?.event?.title) || 'Unknown Event';
    const subject = `Problem with my ticket to ${eventTitle}`;
    
    window.location.href = `mailto:support@melt-records.com?subject=${encodeURIComponent(subject)}`;
  }

  shareOnFacebook() {
    if (!this.event?.buy_shortlink) return;
    
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.event.buy_shortlink)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  shareOnTwitter() {
    if (!this.event) return;
    
    const text = `Join me at ${this.event.title}! You can get your ticket here: ${this.event.buy_shortlink || ''}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }
}