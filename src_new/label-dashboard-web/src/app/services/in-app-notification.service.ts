import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { InAppNotification, GroupedNotification } from '../models/in-app-notification.model';

@Injectable({
  providedIn: 'root'
})
export class InAppNotificationService implements OnDestroy {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private notificationsSubject = new BehaviorSubject<InAppNotification[]>([]);
  private pollingInterval: any = null;

  unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();
  notifications$: Observable<InAppNotification[]> = this.notificationsSubject.asObservable();

  constructor(private apiService: ApiService) {}

  fetchNotifications(): void {
    this.apiService.getNotifications().subscribe({
      next: (response: any) => {
        this.notificationsSubject.next(response.notifications || []);
        this.unreadCountSubject.next(response.unread_count || 0);
      },
      error: (err: any) => {
        console.error('Failed to fetch notifications:', err);
      }
    });
  }

  private pollUnreadCount(): void {
    this.apiService.getUnreadNotificationCount().subscribe({
      next: (response: any) => {
        this.unreadCountSubject.next(response.count || 0);
      },
      error: (err: any) => {
        console.error('Failed to fetch unread count:', err);
      }
    });
  }

  markAsRead(id: number): void {
    this.apiService.markNotificationRead(id).subscribe({
      next: () => this.fetchNotifications(),
      error: (err: any) => console.error('Failed to mark notification as read:', err)
    });
  }

  markAllAsRead(): void {
    this.apiService.markAllNotificationsRead().subscribe({
      next: () => this.fetchNotifications(),
      error: (err: any) => console.error('Failed to mark all notifications as read:', err)
    });
  }

  markTypeAsRead(type: string): void {
    this.apiService.markNotificationsReadByType(type).subscribe({
      next: () => this.fetchNotifications(),
      error: (err: any) => console.error('Failed to mark notifications as read by type:', err)
    });
  }

  startPolling(intervalMs: number = 30000): void {
    this.pollUnreadCount();
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(() => this.pollUnreadCount(), intervalMs);
    }
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  getGroupedUnread(): GroupedNotification[] {
    const notifications = this.notificationsSubject.getValue();
    const unread = notifications.filter(n => !n.is_read);

    const groupMap = new Map<string, GroupedNotification>();

    for (const n of unread) {
      const existing = groupMap.get(n.type);
      if (existing) {
        existing.count++;
        existing.notificationIds.push(n.id);
        if (n.created_at > existing.latestDate) {
          existing.latestDate = n.created_at;
          existing.link = n.link;
        }
      } else {
        groupMap.set(n.type, {
          type: n.type,
          count: 1,
          title: n.title,
          link: n.link,
          latestDate: n.created_at,
          notificationIds: [n.id]
        });
      }
    }

    // Update title for grouped items
    for (const group of groupMap.values()) {
      if (group.count > 1) {
        group.title = `${group.count} new ${this.getTypeLabel(group.type).toLowerCase()} notifications`;
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'earnings_posted': 'Earnings posted',
      'payment_made': 'Payment made',
      'payment_failed': 'Payment failed',
      'sublabel_payment': 'Sublabel payment',
      'release_submitted': 'Release submitted',
      'release_pending': 'Release pending',
      'artist_updated': 'Artist updated',
      'payment_method_updated': 'Payout account updated',
      'payout_point_updated': 'Payout point updated',
      'team_invite': 'Team invite',
      'user_invite': 'Invite',
      'login_success': 'Login',
      'login_failed_alert': 'Security alert',
      'ticket_purchased': 'Ticket sold'
    };
    return labels[type] || type;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
