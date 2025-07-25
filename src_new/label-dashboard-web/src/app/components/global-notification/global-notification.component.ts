import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationMessage } from '../../services/notification.service';

@Component({
  selector: 'app-global-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-notification.component.html',
  styleUrl: './global-notification.component.scss'
})
export class GlobalNotificationComponent implements OnInit, OnDestroy {
  currentNotification: NotificationMessage | null = null;
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notification$.subscribe(
      notification => {
        this.currentNotification = notification;
        
        // Auto-hide after 5 seconds
        if (notification) {
          setTimeout(() => {
            if (this.currentNotification === notification) {
              this.closeNotification();
            }
          }, 5000);
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  closeNotification(): void {
    this.notificationService.clear();
  }

  getNotificationClass(): string {
    if (!this.currentNotification) return '';
    return this.currentNotification.type === 'success' ? 'alert-success' : 'alert-danger';
  }

  getNotificationIcon(): string {
    if (!this.currentNotification) return '';
    return this.currentNotification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  }
}