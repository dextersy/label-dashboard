import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { EventPublishedService, EventPublishedModalData, EventPublishedModalState } from '../../../services/event-published.service';
import { downloadQRCode } from '../../../utils/qr-utils';

@Component({
  selector: 'app-event-published-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-published-modal.component.html',
  styleUrls: ['./event-published-modal.component.scss']
})
export class EventPublishedModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isVisible = false;
  data: EventPublishedModalData | null = null;
  copySuccess = false;

  constructor(private eventPublishedService: EventPublishedService) {}

  ngOnInit() {
    this.eventPublishedService.modalState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: EventPublishedModalState) => {
        this.isVisible = state.isVisible;
        this.data = state.data;
        this.copySuccess = false; // Reset copy success when modal opens
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.eventPublishedService.close();
  }

  copyLink() {
    if (!this.data?.buyLink) return;

    navigator.clipboard.writeText(this.data.buyLink).then(() => {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  }

  shareOnFacebook() {
    if (!this.data?.buyLink) return;
    
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.data.buyLink)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  downloadBuyLinkQR() {
    if (!this.data?.buyLink) return;

    const eventSlug = (this.data.eventTitle || 'Event').replace(/[^a-z0-9]/gi, '-');
    downloadQRCode(this.data.buyLink, `Event-${eventSlug}`).catch(err => {
      console.error('Failed to generate QR code:', err);
    });
  }

  shareOnTwitter() {
    if (!this.data) return;

    const text = `Check out ${this.data.eventTitle}! Get your tickets here: ${this.data.buyLink}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }
}
