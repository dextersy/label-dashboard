export type NotificationType = 'invite' | 'announcement' | 'warning' | 'info' | 'success';

export type NotificationStyle = 'gradient-purple' | 'gradient-blue' | 'warning' | 'info' | 'success';

export interface NotificationAction {
  label: string;
  data?: any;
  processing?: boolean;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  style: NotificationStyle;
  icon: string;
  title: string;
  message?: string;
  actions?: NotificationAction[];
  dismissible: boolean;
  priority: number; // Higher number = higher priority
}

export interface NotificationProvider {
  getNotifications(): Promise<AppNotification[]>;
  handleAction(notificationId: string, action: NotificationAction): Promise<void>;
}
