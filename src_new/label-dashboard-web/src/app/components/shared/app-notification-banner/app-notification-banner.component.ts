import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AppNotification, NotificationAction } from '../../../models/notification.model';
import { AppNotificationService } from '../../../services/app-notification.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-notification-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-notification-banner.component.html',
  styleUrls: ['./app-notification-banner.component.scss']
})
export class AppNotificationBannerComponent implements OnInit, OnDestroy {
  notifications: AppNotification[] = [];
  processingActions = new Map<string, boolean>(); // Track which actions are processing
  private subscription?: Subscription;

  constructor(
    private notificationService: AppNotificationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Only show notifications if user is logged in
    if (!this.authService.isLoggedIn()) {
      return;
    }

    // Subscribe to notifications
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => {
        console.log('[AppNotificationBanner] Received notifications:', notifications);
        this.notifications = notifications;
      }
    );

    // Initial load
    this.notificationService.refreshNotifications();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handleAction(notification: AppNotification, action: NotificationAction): Promise<void> {
    const actionKey = `${notification.id}-${action.label}`;

    // Prevent double-clicks
    if (this.processingActions.get(actionKey)) {
      return;
    }

    // Mark as processing
    this.processingActions.set(actionKey, true);

    try {
      await this.notificationService.handleAction(notification.id, action);
    } catch (error) {
      console.error('[AppNotificationBanner] Error handling action:', error);
    } finally {
      this.processingActions.set(actionKey, false);
    }
  }

  dismiss(notification: AppNotification): void {
    if (!notification.dismissible) {
      return;
    }
    this.notificationService.dismissNotification(notification.id);
  }

  isActionProcessing(notification: AppNotification, action: NotificationAction): boolean {
    const actionKey = `${notification.id}-${action.label}`;
    return this.processingActions.get(actionKey) || false;
  }

  getStyleClass(notification: AppNotification): string {
    return `notification-${notification.style}`;
  }

  getIconClass(notification: AppNotification): string {
    return `fas ${notification.icon}`;
  }
}
