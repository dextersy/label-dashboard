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
  eventId: string | null = null;
  event: PublicEvent | null = null;

  constructor(
    private route: ActivatedRoute,
    private publicService: PublicService
  ) {}

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.eventId = params['id'];
      if (this.eventId) {
        this.loadEventDetails();
      }
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const ticketCode = params['ticket_code'];
      const sessionId = params['session_id'];
      
      if (ticketCode) {
        this.checkTicketStatus(ticketCode);
      } else if (sessionId) {
        // Handle PayMongo success callback
        this.handlePaymentSuccess(sessionId);
      } else {
        // No ticket code or session ID, show generic success
        this.showGenericSuccess();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkTicketStatus(ticketCode: string) {
    const requestData: TicketVerificationRequest = { 
      ticket_code: ticketCode 
    };
    if (this.eventId) {
      requestData.event_id = parseInt(this.eventId, 10);
    }

    this.publicService.verifyTicket(requestData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.valid && response.ticket) {
            this.isSuccess = true;
            this.ticketDetails = response.ticket;
          } else {
            this.isSuccess = false;
          }
        },
        error: (error) => {
          console.error('Error checking ticket status:', error);
          this.isLoading = false;
          this.isSuccess = false;
        }
      });
  }

  handlePaymentSuccess(sessionId: string) {
    // For now, just show loading and then success
    // In a real implementation, you might verify the session with your backend
    setTimeout(() => {
      this.isLoading = false;
      this.isSuccess = true;
    }, 2000);
  }

  loadEventDetails() {
    if (!this.eventId) {
      this.showError();
      return;
    }
    
    this.publicService.getEvent(parseInt(this.eventId, 10))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.event) {
            this.event = response.event;
          } else {
            this.showError();
          }
        },
        error: (error) => {
          console.error('Error loading event details:', error);
          this.showError();
        }
      });
  }

  showGenericSuccess() {
    setTimeout(() => {
      this.isLoading = false;
      this.isSuccess = true;
    }, 1000);
  }

  showError() {
    this.isLoading = false;
    this.isSuccess = false;
    this.isError = true;
  }

  refreshStatus() {
    this.isLoading = true;
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const ticketCode = params['ticket_code'];
      if (ticketCode) {
        this.checkTicketStatus(ticketCode);
      } else {
        this.showGenericSuccess();
      }
    });
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