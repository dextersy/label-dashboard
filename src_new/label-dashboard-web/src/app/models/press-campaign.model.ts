export interface PressCampaignArtistPhoto {
  id: number;
  campaign_id: number;
  path: string;
  label?: string;
  sort_order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PressCampaignArtist {
  id: number;
  name: string;
  bio?: string;
  profile_photo?: string;
  images?: { id: number; path: string; credits?: string; display_order?: number }[];
}

export interface PressCampaignRelease {
  id: number;
  title: string;
  catalog_no?: string;
  cover_art?: string;
  release_date?: string;
  liner_notes?: string;
  artists?: { id: number; name: string; bio?: string; profile_photo?: string }[];
  songs?: PressCampaignSong[];
}

export interface PressCampaignSong {
  id: number;
  title: string;
  isrc?: string;
  duration?: number;
  audio_file_mp3?: string;
  track_number?: number;
  authors?: { id: number; songwriter?: { id: number; name: string } }[];
  composers?: { id: number; songwriter?: { id: number; name: string } }[];
}

export interface PressCampaignEvent {
  id: number;
  title: string;
  date_and_time?: string;
  venue?: string;
  venue_address?: string;
  poster_url?: string;
  description?: string;
  status?: string;
}

export interface PressCampaign {
  id: number;
  brand_id: number;
  title: string;
  writeup?: string;
  campaign_type: 'release' | 'event';
  release_id?: number;
  artist_id?: number;
  event_id?: number;
  cover_art?: string;
  mp3_file?: string;
  public_slug: string;
  status: 'Draft' | 'Published';
  created_by: number;
  createdAt?: string;
  updatedAt?: string;
  artist?: PressCampaignArtist;
  release?: PressCampaignRelease;
  event?: PressCampaignEvent;
  artistPhotos?: PressCampaignArtistPhoto[];
  creator?: { id: number; first_name?: string; last_name?: string; username?: string };
}

export interface PressCampaignPagination {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}
