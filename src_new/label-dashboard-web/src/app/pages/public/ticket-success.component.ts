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
  isDownloading = false;
  downloadError = false;
  ticketDetails: TicketDetails | null = null;
  event: Partial<PublicEvent> | null = null;

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
              };
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
    if (this.isDownloading) return; // Prevent multiple simultaneous downloads

    this.isDownloading = true;
    this.downloadError = false;

    this.publicService.downloadTicketPDF()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.isDownloading = false;

          // Sanitize ticket code for filename (match backend sanitization)
          const ticketCode = this.ticketDetails?.ticket_code || 'download';
          const sanitizedCode = ticketCode.replace(/[^A-Z0-9]/gi, '');

          // Create a blob URL and trigger download
          const url = window.URL.createObjectURL(blob);
          let link: HTMLAnchorElement | null = null;

          try {
            link = document.createElement('a');
            link.href = url;
            link.download = `ticket-${sanitizedCode}.pdf`;
            document.body.appendChild(link);
            link.click();
          } finally {
            // Always cleanup, even if download fails
            if (link) {
              try {
                document.body.removeChild(link);
              } catch (e) {
                // Element may not be in DOM if error occurred before appendChild
              }
            }
            window.URL.revokeObjectURL(url);
          }
        },
        error: (error) => {
          console.error('Error downloading PDF:', error);
          this.isDownloading = false;
          this.downloadError = true;
          // Error message is displayed inline via downloadError state
        }
      });
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

  /**
   * Calculate contrasting text color (white or black) based on background color luminance
   */
  getContrastingColor(hexColor?: string): string {
    if (!hexColor) return '#ffffff';

    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate luminance using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
}