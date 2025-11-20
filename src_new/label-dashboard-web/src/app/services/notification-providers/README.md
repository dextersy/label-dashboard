# Notification System

## Overview

The notification system is a flexible, extensible framework for displaying app-wide notifications to users. It supports multiple notification types, custom actions, and automatic management.

## Architecture

- **AppNotificationService**: Central service that manages all notifications
- **NotificationProvider**: Interface for creating new notification sources
- **AppNotificationBannerComponent**: Generic UI component that displays notifications
- **Notification Providers**: Individual classes that provide specific notification types

## How to Add a New Notification Type

### 1. Create a Notification Provider

Create a new file in `src/app/services/notification-providers/`:

```typescript
import { Injectable } from '@angular/core';
import { AppNotification, NotificationProvider, NotificationAction } from '../../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class MyNotificationProvider implements NotificationProvider {

  constructor(/* inject dependencies */) {}

  async getNotifications(): Promise<AppNotification[]> {
    // Fetch data from API or other source
    // Return array of notifications

    return [{
      id: 'unique-notification-id',
      type: 'announcement', // or 'warning', 'info', 'success', 'invite'
      style: 'gradient-blue', // or 'gradient-purple', 'warning', 'info', 'success'
      icon: 'fa-bell', // Font Awesome icon class
      title: 'Your notification title',
      message: 'Optional description text',
      actions: [
        { label: 'Action 1', data: { /* custom data */ } },
        { label: 'Action 2', data: { /* custom data */ } }
      ],
      dismissible: true,
      priority: 50 // Higher = shown first
    }];
  }

  async handleAction(notificationId: string, action: NotificationAction): Promise<void> {
    // Only handle notifications we own
    if (notificationId !== 'unique-notification-id') {
      throw new Error('Not my notification');
    }

    // Handle the action
    const data = action.data;
    // ... perform action logic ...
  }
}
```

### 2. Register the Provider

In `app.component.ts`, import and register your provider:

```typescript
import { MyNotificationProvider } from './services/notification-providers/my-notification.provider';

constructor(
  // ... other dependencies
  private appNotificationService: AppNotificationService,
  private myNotificationProvider: MyNotificationProvider
) {
  // Register the provider
  this.appNotificationService.registerProvider(this.myNotificationProvider);
}
```

### 3. Done!

Your notifications will now automatically appear in the banner when they're available.

## Notification Styles

Available styles:
- `gradient-purple` - Purple gradient (default for invites)
- `gradient-blue` - Blue gradient
- `warning` - Red/pink gradient
- `info` - Blue gradient
- `success` - Green gradient

## Example: Announcement Notification

```typescript
@Injectable({ providedIn: 'root' })
export class AnnouncementNotificationProvider implements NotificationProvider {

  async getNotifications(): Promise<AppNotification[]> {
    // Check if there's a new feature to announce
    const hasNewFeature = await this.checkForNewFeatures();

    if (!hasNewFeature) {
      return [];
    }

    return [{
      id: 'new-feature-announcement',
      type: 'announcement',
      style: 'gradient-blue',
      icon: 'fa-rocket',
      title: 'New Feature Available!',
      message: 'Check out our new analytics dashboard',
      actions: [
        { label: 'View Now', data: { route: '/analytics' } }
      ],
      dismissible: true,
      priority: 75
    }];
  }

  async handleAction(notificationId: string, action: NotificationAction): Promise<void> {
    if (notificationId !== 'new-feature-announcement') {
      throw new Error('Not my notification');
    }

    // Navigate to the route
    this.router.navigate([action.data.route]);
  }
}
```

## Priority System

Notifications are sorted by priority (highest first):
- 100+ - Critical (pending invites)
- 75-99 - High priority
- 50-74 - Normal priority
- 25-49 - Low priority
- <25 - Very low priority

## Dismissal

Dismissed notifications are stored in `sessionStorage` and persist until the browser session ends.
