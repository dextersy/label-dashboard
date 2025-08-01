import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-referrals-tab.component.html',
  styleUrl: './event-referrals-tab.component.scss'
})
export class EventReferralsTabComponent {
  @Input() referrers: EventReferrer[] = [];
  @Input() eventTitle: string = '';
  @Input() isAdmin: boolean = false;
  @Input() loading: boolean = false;
  @Output() addReferrer = new EventEmitter<ReferrerForm>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  referrerForm: ReferrerForm = {
    name: '',
    referral_code: '',
    slug: ''
  };

  generateReferralCode(): void {
    if (this.referrerForm.name && this.eventTitle) {
      const cleanEventTitle = this.eventTitle.replace(/[^A-Z0-9]/gi, '');
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

  onSubmitReferrer(): void {
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

    this.addReferrer.emit({ ...this.referrerForm });
    this.resetForm();
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
}