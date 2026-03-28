import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PublicEvent {
  id: number;
  title: string;
  description?: string;
  date_and_time: string;
  close_time?: string;
  venue: string;
  poster_url?: string;
  ticket_price: number;
  ticket_naming: string;
  max_tickets?: number;
  remaining_tickets?: number;
  is_closed: boolean;
  show_countdown: boolean;
  show_tickets_remaining: boolean;
  supports_card: boolean;
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  buy_shortlink?: string;
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
  walk_in_enabled?: boolean;
  walkInTypes?: Array<{
    name: string;
    price: number;
    remaining_slots: number | null;
  }>;
  brand?: {
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
  };
  ticketTypes?: Array<{
    id: number;
    name: string;
    price: number;
    max_tickets?: number;
    start_date?: string | null;
    end_date?: string | null;
    is_available?: boolean;
    is_sold_out?: boolean;
    remaining_tickets?: number | null;
    sold_count?: number;
    special_instructions?: string | null;
  }>;
}

export interface TicketPurchaseRequest {
  event_id: number;
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  ticket_type_id?: number;
  referral_code?: string;
}

export interface TicketPurchaseResponse {
  success: boolean;
  ticket_id: number;
  ticket_code: string;
  total_amount: number;
  url: string;
  message: string;
}

export interface TicketDetails {
  ticket_code: string;
  name: string;
  number_of_entries: number;
  number_of_claimed_entries?: number;
  remaining_entries?: number;
  status: string;
  event: {
    id?: number;
    title: string;
    date_and_time: string;
    venue: string;
  };
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  ticket: {
    id: number;
    ticket_code: string;
    name: string;
    number_of_entries: number;
    number_of_claimed_entries: number;
    remaining_entries: number;
    event: {
      id: number;
      title: string;
      date_and_time: string;
      venue: string;
    };
  };
}

export interface BrandInfo {
  domain: string;
  brand: {
    id: number;
    name: string;
    logo_url?: string;
    brand_color?: string;
    brand_website?: string;
    favicon_url?: string;
    release_submission_url?: string;
    catalog_prefix?: string;
  };
}

export interface PublicEventsList {
  brands: Array<{
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
    events: Array<{
      id: number;
      title: string;
      date_and_time: string;
      venue: string;
      poster_url?: string;
      ticket_price: number;
      ticket_naming?: string;
      buy_shortlink?: string;
      is_closed: boolean;
    }>;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class PublicService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get event details for public ticket purchasing
   */
  getEvent(eventId: number): Observable<{ event: PublicEvent }> {
    return this.http.get<{ event: PublicEvent }>(`${this.apiUrl}/public/events/${eventId}`);
  }

  /**
   * Purchase a ticket for an event
   */
  buyTicket(request: TicketPurchaseRequest): Observable<TicketPurchaseResponse> {
    return this.http.post<TicketPurchaseResponse>(`${this.apiUrl}/public/tickets/buy`, request, { withCredentials: true });
  }

  /**
   * Get brand information by domain
   */
  getBrandByDomain(domain: string): Observable<BrandInfo> {
    return this.http.get<BrandInfo>(`${this.apiUrl}/public/brand/domain/${domain}`);
  }

  /**
   * Get public event information by ID (without PIN requirement)
   */
  getPublicEventInfo(eventId: number): Observable<{
    event: {
      id: number;
      title: string;
      date_and_time: string;
      venue: string;
      poster_url?: string;
      brand?: {
        id: number;
        name: string;
        color: string;
        logo_url: string;
      };
    };
  }> {
    return this.http.get<{
      event: {
        id: number;
        title: string;
        date_and_time: string;
        venue: string;
        poster_url?: string;
        brand?: {
          id: number;
          name: string;
          color: string;
          logo_url: string;
        };
      };
    }>(`${this.apiUrl}/public/events/${eventId}/info`);
  }

  /**
   * Get all public events for a domain (brand and its sublabels)
   */
  getAllEventsForDomain(domain: string): Observable<PublicEventsList> {
    return this.http.get<PublicEventsList>(`${this.apiUrl}/public/events/domain/${domain}`);
  }

  /**
   * Get public EPK (Electronic Press Kit) for an artist
   */
  getArtistEPK(artistId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/epk/${artistId}`);
  }

  /**
   * Get release player data for public playback
   */
  getReleasePlayer(artistId: number, releaseId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/player/${artistId}/${releaseId}`);
  }

  /**
   * Get available ticket types for public purchase (excludes sold out and unavailable based on date range)
   */
  getAvailableTicketTypes(eventId: number): Observable<{ ticketTypes: Array<{
    id: number;
    name: string;
    price: number;
    max_tickets: number;
    start_date?: string | null;
    end_date?: string | null;
    is_available: boolean;
    is_sold_out: boolean;
    remaining_tickets?: number | null;
    sold_count: number;
  }> }> {
    return this.http.get<{ ticketTypes: Array<{
      id: number;
      name: string;
      price: number;
      max_tickets: number;
      start_date?: string | null;
      end_date?: string | null;
      is_available: boolean;
      is_sold_out: boolean;
      remaining_tickets?: number | null;
      sold_count: number;
    }> }>(`${this.apiUrl}/public/events/ticket-types/available?event_id=${eventId}`);
  }

  /**
   * Get ticket details from cookie (for success page)
   * Uses unified endpoint that supports both cookie and code-based authentication
   */
  getTicketFromCookie(): Observable<{
    success: boolean;
    ticket: {
      id: number;
      ticket_code: string;
      name: string;
      email_address: string;
      contact_number: string;
      number_of_entries: number;
      status: string;
      price_per_ticket: number;
      total_price: number;
      order_timestamp: string;
      date_paid: string;
      event?: {
        id: number;
        title: string;
        date_and_time: string;
        venue: string;
        venue_address?: string;
        venue_maps_url?: string;
        poster_url?: string;
        buy_shortlink?: string;
        brand?: {
          id: number;
          name: string;
          color?: string;
          logo_url?: string;
        };
      };
      ticketType?: {
        id: number;
        name: string;
        price: number;
      };
    };
  }> {
    // POST with empty body - endpoint will use cookie for authentication
    return this.http.post<any>(`${this.apiUrl}/public/tickets/details`, {}, { withCredentials: true });
  }

  /**
   * Download ticket PDF (uses cookie for authentication)
   * Returns Observable for error handling
   */
  downloadTicketPDF(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/public/tickets/pdf`, {
      responseType: 'blob',
      withCredentials: true
    });
  }

  /**
   * Get fundraiser details for public donation page
   */
  getFundraiser(fundraiserId: number): Observable<{
    fundraiser: {
      id: number;
      title: string;
      description?: string;
      poster_url?: string;
      brand?: {
        id: number;
        name: string;
        color?: string;
        logo_url?: string;
      };
    };
  }> {
    return this.http.get<any>(`${this.apiUrl}/public/fundraiser/${fundraiserId}`);
  }

  /**
   * Make a donation to a fundraiser
   */
  makeDonation(request: {
    fundraiser_id: number;
    name: string;
    email: string;
    contact_number?: string;
    amount: number;
    anonymous: boolean;
  }): Observable<{
    success: boolean;
    donation_id: number;
    checkout_url: string;
    message: string;
  }> {
    return this.http.post<any>(`${this.apiUrl}/public/donation/donate`, request);
  }

  // ─── Scanner Session Methods ───

  private scannerHeaders(token: string): { headers: HttpHeaders } {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  scannerLogin(eventId: number, pin: string): Observable<{
    token: string;
    event: {
      id: number;
      title: string;
      date_and_time: string;
      venue: string;
      poster_url?: string;
      brand?: {
        id: number;
        name: string;
        color: string;
        logo_url: string;
      };
    };
  }> {
    return this.http.post<any>(`${this.apiUrl}/scanner/login`, { event_id: eventId, pin });
  }

  scannerGetTicket(token: string, ticketCode: string): Observable<{
    ticket: {
      id: number;
      ticket_code: string;
      name: string;
      email_address: string;
      number_of_entries: number;
      number_of_claimed_entries: number;
      remaining_entries: number;
      status: string;
      event: {
        id: number;
        title: string;
        date_and_time: string;
        venue: string;
      };
      referrer?: {
        name: string;
        code: string;
      };
      ticketType?: {
        id: number;
        name: string;
        price: number;
        special_instructions_for_scanner?: string | null;
      };
    };
  }> {
    return this.http.post<any>(`${this.apiUrl}/scanner/ticket`, { ticket_code: ticketCode }, this.scannerHeaders(token));
  }

  scannerCheckIn(token: string, ticketCode: string, entriesToClaim: number): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.apiUrl}/scanner/check-in`, {
      ticket_code: ticketCode,
      entries_to_claim: entriesToClaim
    }, this.scannerHeaders(token));
  }

  scannerGetWalkInTypes(token: string): Observable<{
    walkInTypes: Array<{
      id: number;
      name: string;
      price: number;
      max_slots: number;
      sold_count: number;
      remaining_slots: number | null;
    }>;
    payment_methods: {
      cash: boolean;
      gcash: boolean;
      card: boolean;
    };
    walk_in_max_count: number;
    total_sold_count: number;
  }> {
    return this.http.post<any>(`${this.apiUrl}/scanner/walk-in/types`, {}, this.scannerHeaders(token));
  }

  scannerRegisterWalkIn(token: string, data: {
    payment_method: string;
    payment_reference?: string;
    items: Array<{ walk_in_type_id: number; quantity: number }>;
  }): Observable<{
    success: boolean;
    message: string;
    transaction: any;
  }> {
    return this.http.post<any>(`${this.apiUrl}/scanner/walk-in/register`, data, this.scannerHeaders(token));
  }
}