import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventService, Event, EventReferrer as ServiceEventReferrer } from '../../../services/event.service';
import { downloadQRCode } from '../../../utils/qr-utils';

export interface EventReferrer {
  id: number;
  name: string;
  referral_code: string;
  tickets_sold: number;
  gross_amount_sold: number;
  net_amount_sold: number;
  referral_shortlink: string;
}

export interface ReferrerForm {
  name: string;
  referral_code: string;
  slug: string;
}

@Component({
    selector: 'app-event-referrals-tab',
    imports: [CommonModule, FormsModule],
    templateUrl: './event-referrals-tab.component.html',
    styleUrl: './event-referrals-tab.component.scss'
})
export class EventReferralsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  referrers: EventReferrer[] = [];
  loading = false;
  
  referrerForm: ReferrerForm = {
    name: '',
    referral_code: '',
    slug: ''
  };

  private subscriptions = new Subscription();

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadEventReferrers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadEventReferrers();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEventReferrers(): void {
    if (!this.selectedEvent) {
      this.referrers = [];
      return;
    }

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEventReferrers(this.selectedEvent.id).subscribe({
        next: (referrers) => {
          this.referrers = referrers.map(referrer => this.convertServiceReferrerToComponentReferrer(referrer));
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load event referrers:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to load event referrers'
          });
          this.loading = false;
        }
      })
    );
  }

  private convertServiceReferrerToComponentReferrer(referrer: ServiceEventReferrer): EventReferrer {
    return {
      id: referrer.id,
      name: referrer.name,
      referral_code: referrer.referral_code,
      tickets_sold: referrer.tickets_sold,
      gross_amount_sold: referrer.gross_amount_sold,
      net_amount_sold: referrer.net_amount_sold,
      referral_shortlink: referrer.referral_shortlink
    };
  }

  generateReferralCode(): void {
    if (this.referrerForm.name && this.selectedEvent?.title) {
      const cleanEventTitle = this.selectedEvent.title.replace(/[^A-Z0-9]/gi, '');
      const cleanReferrerName = this.referrerForm.name.replace(/[^A-Z0-9]/gi, '');
      this.referrerForm.referral_code = `${cleanEventTitle}-${cleanReferrerName}`;
      this.generateSlug();
    }
  }

  generateSlug(): void {
    if (this.referrerForm.referral_code) {
      const cleanCode = this.referrerForm.referral_code.replace(/[^A-Z0-9]/gi, '');
      this.referrerForm.slug = `Buy${cleanCode}`;
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.alertMessage.emit({
        type: 'success',
        text: 'Referral link copied to clipboard!'
      });
    }).catch(() => {
      this.alertMessage.emit({
        type: 'error',
        text: 'Failed to copy referral link to clipboard.'
      });
    });
  }

  downloadReferralQR(referralShortlink: string, referralCode: string): void {
    downloadQRCode(referralShortlink, `Referral-${referralCode}`).catch(err => {
      console.error('Failed to generate QR code:', err);
      this.alertMessage.emit({ type: 'error', text: 'Failed to generate QR code.' });
    });
  }

  onSubmitReferrer(): void {
    if (!this.selectedEvent) return;
    
    // Basic validation
    if (!this.referrerForm.name || !this.referrerForm.referral_code || !this.referrerForm.slug) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Please fill in all required fields.'
      });
      return;
    }

    // Check for duplicate referral codes
    const duplicate = this.referrers.find(r => r.referral_code === this.referrerForm.referral_code);
    if (duplicate) {
      this.alertMessage.emit({
        type: 'error',
        text: 'A referrer with this referral code already exists.'
      });
      return;
    }

    this.subscriptions.add(
      this.eventService.createEventReferrer(this.selectedEvent.id, this.referrerForm).subscribe({
        next: (newReferrer) => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Referrer added successfully!'
          });
          this.referrers.push(this.convertServiceReferrerToComponentReferrer(newReferrer));
          this.resetForm();
        },
        error: (error) => {
          console.error('Failed to create referrer:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error.message || 'Failed to create referrer'
          });
        }
      })
    );
  }

  resetForm(): void {
    this.referrerForm = {
      name: '',
      referral_code: '',
      slug: ''
    };
  }

  getTotalTicketsSold(): number {
    return this.referrers.reduce((total, referrer) => total + referrer.tickets_sold, 0);
  }

  getTotalGrossSales(): number {
    return this.referrers.reduce((total, referrer) => total + referrer.gross_amount_sold, 0);
  }

  getTotalNetSales(): number {
    return this.referrers.reduce((total, referrer) => total + referrer.net_amount_sold, 0);
  }

  isEventPast(): boolean {
    if (!this.selectedEvent || !this.selectedEvent.date_and_time) {
      return false;
    }

    const eventDate = new Date(this.selectedEvent.date_and_time);
    const now = new Date();

    return now > eventDate;
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}