import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface TicketVerificationRequest {
  ticket_code: string;
  event_id?: number;
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

export interface TicketVerificationResponse {
  valid: boolean;
  ticket?: TicketDetails;
  message: string;
}

export interface CheckInRequest {
  event_id: number;
  verification_pin: string;
  ticket_code: string;
  entries_to_claim: number;
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
    return this.http.post<TicketPurchaseResponse>(`${this.apiUrl}/public/tickets/buy`, request);
  }

  /**
   * Verify a ticket by code
   */
  verifyTicket(request: TicketVerificationRequest): Observable<TicketVerificationResponse> {
    return this.http.post<TicketVerificationResponse>(`${this.apiUrl}/public/tickets/verify`, request);
  }

  /**
   * Get brand information by domain
   */
  getBrandByDomain(domain: string): Observable<BrandInfo> {
    return this.http.get<BrandInfo>(`${this.apiUrl}/public/brand/domain/${domain}`);
  }

  /**
   * Check verification PIN for an event
   */
  checkPin(eventId: number, pin: string): Observable<{
    valid: boolean;
    message: string;
    event?: {
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
    return this.http.post<{
      valid: boolean;
      message: string;
      event?: {
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
    }>(`${this.apiUrl}/public/tickets/check-pin`, {
      event_id: eventId,
      pin
    });
  }

  /**
   * Get ticket details by code and event
   */
  getTicketFromCode(eventId: number, verificationPin: string, ticketCode: string): Observable<{
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
      };
    };
  }> {
    return this.http.post<{
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
        };
      };
    }>(`${this.apiUrl}/public/tickets/get-from-code`, {
      event_id: eventId,
      verification_pin: verificationPin,
      ticket_code: ticketCode
    });
  }

  /**
   * Check in ticket entries
   */
  checkInTicket(request: CheckInRequest): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.apiUrl}/public/tickets/check-in`, request);
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
}