import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppNotification, NotificationProvider, NotificationAction } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class AppNotificationService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$: Observable<AppNotification[]> = this.notificationsSubject.asObservable();

  private providers: NotificationProvider[] = [];
  private dismissedNotifications = new Set<string>();

  constructor() {
    // Load dismissed notifications from sessionStorage
    const dismissed = sessionStorage.getItem('dismissed_notifications');
    if (dismissed) {
      this.dismissedNotifications = new Set(JSON.parse(dismissed));
    }
  }

  /**
   * Register a notification provider
   */
  registerProvider(provider: NotificationProvider): void {
    this.providers.push(provider);
  }

  /**
   * Fetch and aggregate notifications from all providers
   */
  async refreshNotifications(): Promise<void> {
    try {
      const allNotifications: AppNotification[] = [];

      // Fetch from all providers
      for (const provider of this.providers) {
        const notifications = await provider.getNotifications();
        allNotifications.push(...notifications);
      }

      // Filter out dismissed notifications
      const visibleNotifications = allNotifications.filter(
        n => !this.dismissedNotifications.has(n.id)
      );

      // Sort by priority (highest first)
      visibleNotifications.sort((a, b) => b.priority - a.priority);

      this.notificationsSubject.next(visibleNotifications);
    } catch (error) {
      console.error('[AppNotificationService] Error refreshing notifications:', error);
    }
  }

  /**
   * Handle an action on a notification
   */
  async handleAction(notificationId: string, action: NotificationAction): Promise<void> {
    // Find the provider that owns this notification
    for (const provider of this.providers) {
      try {
        await provider.handleAction(notificationId, action);
        // Refresh notifications after action is handled
        await this.refreshNotifications();
        return;
      } catch (error) {
        // Provider doesn't own this notification, try next one
        continue;
      }
    }
    console.warn('[AppNotificationService] No provider found for notification:', notificationId);
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(notificationId: string): void {
    this.dismissedNotifications.add(notificationId);

    // Save to sessionStorage
    sessionStorage.setItem(
      'dismissed_notifications',
      JSON.stringify(Array.from(this.dismissedNotifications))
    );

    // Refresh to update UI
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next(
      current.filter(n => n.id !== notificationId)
    );
  }

  /**
   * Clear all dismissed notifications (useful on logout)
   */
  clearDismissed(): void {
    this.dismissedNotifications.clear();
    sessionStorage.removeItem('dismissed_notifications');
  }

  /**
   * Get current notifications synchronously
   */
  getCurrentNotifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }
}
