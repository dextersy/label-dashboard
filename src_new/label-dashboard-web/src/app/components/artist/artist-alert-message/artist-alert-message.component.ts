import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AlertMessage {
  type: 'success' | 'error';
  message: string;
  action?: string;
}

@Component({
  selector: 'app-artist-alert-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artist-alert-message.component.html',
  styleUrl: './artist-alert-message.component.scss'
})
export class ArtistAlertMessageComponent implements OnInit, OnDestroy {
  @Input() alert: AlertMessage | null = null;
  
  private fadeTimeout: any;

  ngOnInit(): void {
    if (this.alert) {
      this.startFadeTimer();
    }
  }

  ngOnDestroy(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
  }

  private startFadeTimer(): void {
    this.fadeTimeout = setTimeout(() => {
      this.closeAlert();
    }, 2500);
  }

  closeAlert(): void {
    this.alert = null;
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
  }

  getAlertClass(): string {
    if (!this.alert) return '';
    return this.alert.type === 'success' ? 'alert-success' : 'alert-danger';
  }

  getAlertIcon(): string {
    if (!this.alert) return '';
    return this.alert.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
  }
}