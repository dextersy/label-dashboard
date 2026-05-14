export interface InAppNotification {
  id: number;
  type: string;
  title: string;
  message?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface GroupedNotification {
  type: string;
  count: number;
  title: string;
  link?: string;
  latestDate: string;
  notificationIds: number[];
}
