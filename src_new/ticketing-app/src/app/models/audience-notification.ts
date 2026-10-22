export type AudienceNotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'invite_joined';

export interface AudienceNotificationActor {
  id: number;
  first_name: string;
  last_name: string | null;
  profile_photo_url: string | null;
}

export interface AudienceNotification {
  id: number;
  audience_user_id: number;
  type: AudienceNotificationType;
  title: string;
  message: string | null;
  link: string | null;
  actor_id: number | null;
  actor: AudienceNotificationActor | null;
  is_read: boolean;
  created_at: string;
}
