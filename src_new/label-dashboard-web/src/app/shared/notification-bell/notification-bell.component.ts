import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { InAppNotificationService } from '../../services/in-app-notification.service';
import { InAppNotification, GroupedNotification } from '../../models/in-app-notification.model';
import { IconComponent } from '../../components/shared/icon/icon.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  isOpen = false;
  unreadCount = 0;
  notifications: InAppNotification[] = [];
  groupedUnread: GroupedNotification[] = [];
  private subscription = new Subscription();

  constructor(
    private notificationService: InAppNotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadCount = count;
      })
    );
    this.subscription.add(
      this.notificationService.notifications$.subscribe(notifications => {
        this.notifications = notifications;
        this.groupedUnread = this.notificationService.getGroupedUnread();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-bell-wrapper')) {
      this.isOpen = false;
    }
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.notificationService.fetchNotifications();
    }
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead();
  }

  onGroupedClick(group: GroupedNotification): void {
    for (const id of group.notificationIds) {
      this.notificationService.markAsRead(id);
    }
    this.isOpen = false;
    if (group.link) {
      this.router.navigateByUrl(group.link);
    }
  }

  onNotificationClick(notification: InAppNotification): void {
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id);
    }
    this.isOpen = false;
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  getTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'earnings_posted': 'coins',
      'payment_made': 'payment',
      'payment_failed': 'x-circle',
      'sublabel_payment': 'payment',
      'release_submitted': 'upload',
      'release_pending': 'clock',
      'artist_updated': 'edit',
      'payment_method_updated': 'credit-card',
      'payout_point_updated': 'settings',
      'team_invite': 'user-plus',
      'user_invite': 'envelope',
      'login_success': 'lock',
      'login_failed_alert': 'warning',
      'ticket_purchased': 'ticket'
    };
    return iconMap[type] || 'info';
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  get recentRead(): InAppNotification[] {
    return this.notifications.filter(n => n.is_read).slice(0, 10);
  }
}
