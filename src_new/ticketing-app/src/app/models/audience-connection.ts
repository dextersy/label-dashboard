export type ConnectionStatus = 'pending' | 'accepted' | 'blocked';

export interface AudiencePublicProfile {
  id: number;
  first_name: string;
  last_name: string | null;
  last_name_initial: string | null;
  profile_photo_url: string | null;
  membership_tier: 'Silver' | 'Gold' | 'Platinum';
  city: string | null;
  music_genres: string[];
}

export interface ConnectionMeta {
  connection_id: number;
  status: ConnectionStatus;
  i_am_requester: boolean;
}

export interface AudienceConnectionItem {
  connection_id: number;
  user: AudiencePublicProfile;
}

export interface AudienceAttendee {
  user: AudiencePublicProfile;
  connection: ConnectionMeta | null;
}
