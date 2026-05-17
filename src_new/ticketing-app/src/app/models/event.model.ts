export interface Event {
  id: number;
  title: string;
  description?: string;
  venue?: string;
  date_and_time: string;
  close_time?: string;
  status: 'draft' | 'published' | 'past';
  poster_url?: string;
  brand_id: number;
  tickets_sold?: number;
  total_revenue?: number;
  verification_pin?: string;
  verification_link?: string;
  buy_shortlink?: string;
  rsvp_link?: string;
  // Venue details
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
  // Payment methods
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_card: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  // Purchase settings
  countdown_display: 'always' | '1_week' | '3_days' | '1_day' | 'never';
  show_tickets_remaining: boolean;
  ticket_naming?: string;
  // Walk-in
  walk_in_enabled: boolean;
  walk_in_supports_cash: boolean;
  walk_in_supports_gcash: boolean;
  walk_in_supports_card: boolean;
  walk_in_max_count: number;
  // Tagging & listing
  event_type?: 'concert' | 'festival' | 'club_night' | 'open_mic' | 'dj_set' | 'listening_party' | 'album_launch' | 'workshop' | 'meetup' | 'other' | null;
  ticketing_enabled?: boolean;
  external_ticket_link?: string | null;
  listed_on_ticketing?: boolean;
  tags?: EventTag[];
  created_at?: string;
  updated_at?: string;
}

export interface EventTag {
  id: number;
  name: string;
  is_custom: boolean;
}

export interface EventFormData {
  title: string;
  description?: string;
  venue?: string;
  date_and_time: string;
  close_time?: string;
  poster?: File;
  ticket_price?: string;
  supports_gcash?: boolean;
  supports_qrph?: boolean;
  supports_card?: boolean;
  supports_ubp?: boolean;
  supports_dob?: boolean;
  supports_maya?: boolean;
  supports_grabpay?: boolean;
  countdown_display?: string;
  show_tickets_remaining?: boolean;
  ticket_naming?: string;
  walk_in_enabled?: boolean;
  walk_in_supports_cash?: boolean;
  walk_in_supports_gcash?: boolean;
  walk_in_supports_card?: boolean;
  walk_in_max_count?: number;
  // Tagging & listing
  event_type?: string;
  ticketing_enabled?: boolean;
  external_ticket_link?: string;
  tags?: number[]; // array of tag IDs
  // Google Places venue fields
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number | string;
  venue_longitude?: number | string;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
}
