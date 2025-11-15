import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationMessage } from '../../services/notification.service';

@Component({
    selector: 'app-global-notification',
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

  closeNotification(event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent triggering click action when closing
    }
    this.notificationService.clear();
  }

  onNotificationClick(): void {
    if (this.currentNotification?.clickable && this.currentNotification.clickAction) {
      this.currentNotification.clickAction();
      this.closeNotification(); // Close notification after action
    }
  }

  getNotificationClass(): string {
    if (!this.currentNotification) return '';
    
    switch (this.currentNotification.type) {
      case 'success':
        return 'alert-success';
      case 'info':
        return 'alert-info';
      case 'warning':
        return 'alert-warning';
      case 'error':
      default:
        return 'alert-danger';
    }
  }

  getNotificationIcon(): string {
    if (!this.currentNotification) return '';
    
    switch (this.currentNotification.type) {
      case 'success':
        return 'fa-check-circle';
      case 'info':
        return 'fa-info-circle';
      case 'warning':
        return 'fa-exclamation-triangle';
      case 'error':
      default:
        return 'fa-exclamation-circle';
    }
  }

  getNotificationCaption(): string {
    if (!this.currentNotification) return '';
    
    switch (this.currentNotification.type) {
      case 'success':
        return 'Success!';
      case 'warning':
        return 'Warning!';
      case 'error':
        return 'Error!';
      case 'info':
      default:
        return ''; // No caption for info messages
    }
  }
}