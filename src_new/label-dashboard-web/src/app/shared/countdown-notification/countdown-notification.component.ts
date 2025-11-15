import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-countdown-notification',
    imports: [CommonModule],
    templateUrl: './countdown-notification.component.html',
    styleUrl: './countdown-notification.component.scss'
})
export class CountdownNotificationComponent implements OnInit, OnDestroy {
  @Input() eventDate!: string;
  @Input() closeTime?: string;
  @Input() eventTitle!: string;
  @Input() brandColor: string = '#6f42c1';

  timeLeft: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } = { days: 0, hours: 0, minutes: 0, seconds: 0 };

  private interval: any;

  ngOnInit() {
    this.startCountdown();
  }

  ngOnDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private startCountdown() {
    this.updateCountdown();
    this.interval = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown() {
    const now = new Date().getTime();
    // Use close time if available, otherwise fall back to event date
    const targetTime = this.closeTime ? new Date(this.closeTime).getTime() : new Date(this.eventDate).getTime();
    const distance = targetTime - now;

    if (distance > 0) {
      this.timeLeft = {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      };
    } else {
      // Ticket sales have closed
      this.timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      if (this.interval) {
        clearInterval(this.interval);
      }
    }
  }

  get hasTimeLeft(): boolean {
    return this.timeLeft.days > 0 || this.timeLeft.hours > 0 || 
           this.timeLeft.minutes > 0 || this.timeLeft.seconds > 0;
  }
}