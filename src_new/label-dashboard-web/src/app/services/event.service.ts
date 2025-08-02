import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { CreateEventForm } from '../components/events/create-event-modal/create-event-modal.component';

export interface Event {
  id: number;
  brand_id: number;
  title: string;
  date_and_time: string;
  venue: string;
  description?: string;
  poster_url?: string;
  rsvp_link?: string;
  ticket_price: number;
  buy_shortlink?: string;
  close_time?: string;
  verification_pin: string;
  verification_link: string;
  supports_gcash: boolean;
  supports_qrph: boolean;
  supports_card: boolean;
  supports_ubp: boolean;
  supports_dob: boolean;
  supports_maya: boolean;
  supports_grabpay: boolean;
  max_tickets?: number;
  ticket_naming: string;
  tickets?: EventTicket[];
  referrers?: EventReferrer[];
}

export interface EventTicket {
  id: number;
  event_id: number;
  name: string;
  email_address: string;
  contact_number?: string;
  number_of_entries: number;
  number_of_claimed_entries: number;
  ticket_code: string;
  status: string;
  price_per_ticket: number;
  payment_processing_fee: number;
  payment_link?: string;
  referrer_id?: number;
  order_timestamp: string;
}

export interface EventReferrer {
  id: number;
  event_id: number;
  name: string;
  referral_code: string;
  sales_made: number;
  total_earnings: number;
}

export interface EventSummary {
  total_tickets_sold: number;
  total_revenue: number;
  pending_orders: number;
  active_referrers: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private selectedEventSubject = new BehaviorSubject<Event | null>(null);
  public selectedEvent$ = this.selectedEventSubject.asObservable();
  private readonly SELECTED_EVENT_KEY = 'melt_selected_event';

  constructor(private http: HttpClient) {
    // Load previously selected event from localStorage on service init
    this.loadSelectedEventFromStorage();
  }
  
  /**
   * Load previously selected event from localStorage
   */
  private loadSelectedEventFromStorage(): void {
    try {
      const storedEvent = localStorage.getItem(this.SELECTED_EVENT_KEY);
      if (storedEvent) {
        const event = JSON.parse(storedEvent);
        this.selectedEventSubject.next(event);
      }
    } catch (error) {
      console.warn('Failed to load selected event from storage:', error);
      localStorage.removeItem(this.SELECTED_EVENT_KEY);
    }
  }
  
  /**
   * Save selected event to localStorage
   */
  private saveSelectedEventToStorage(event: Event | null): void {
    try {
      if (event) {
        localStorage.setItem(this.SELECTED_EVENT_KEY, JSON.stringify(event));
      } else {
        localStorage.removeItem(this.SELECTED_EVENT_KEY);
      }
    } catch (error) {
      console.warn('Failed to save selected event to storage:', error);
    }
  }

  private getAuthHeaders(contentType?: string): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    const headers: any = {
      'Authorization': `Bearer ${token}`
    };
    
    if (contentType) {
      headers['Content-Type'] = contentType;
    } else {
      headers['Content-Type'] = 'application/json';
    }
    
    return new HttpHeaders(headers);
  }

  private getAuthHeadersForFormData(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData - let browser set it with boundary
    });
  }

  /**
   * Get all events for the current user's brand
   */
  getEvents(): Observable<Event[]> {
    return this.http.get<{events: Event[]}>(`${environment.apiUrl}/events`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.events),
      catchError(this.handleError)
    );
  }

  /**
   * Get a specific event by ID
   */
  getEvent(eventId: number): Observable<Event> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.http.get<{event: Event}>(`${environment.apiUrl}/events/${eventId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.event),
      catchError(this.handleError)
    );
  }

  /**
   * Set the currently selected event
   */
  setSelectedEvent(event: Event | null): void {
    this.selectedEventSubject.next(event);
    this.saveSelectedEventToStorage(event);
    
    // Also notify the backend about the selection
    if (event) {
      this.notifyBackendEventSelection(event.id).subscribe({
        next: () => console.log('Backend notified of event selection'),
        error: (error) => console.error('Failed to notify backend:', error)
      });
    }
  }

  /**
   * Get the currently selected event
   */
  getSelectedEvent(): Event | null {
    return this.selectedEventSubject.value;
  }

  /**
   * Notify backend about event selection (for session management)
   */
  private notifyBackendEventSelection(eventId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/set-selected`, 
      { event_id: eventId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get tickets for a specific event
   */
  getEventTickets(eventId: number): Observable<EventTicket[]> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.http.get<{tickets: EventTicket[]}>(`${environment.apiUrl}/events/tickets`, {
      headers: this.getAuthHeaders(),
      params: { event_id: eventId.toString() }
    }).pipe(
      map(response => response.tickets),
      catchError(this.handleError)
    );
  }

  /**
   * Get event summary/statistics
   */
  getEventSummary(eventId: number): Observable<EventSummary> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.getEventTickets(eventId).pipe(
      map(tickets => {
        const confirmedTickets = tickets.filter(t => 
          t.status === 'Ticket sent.' || t.status === 'Payment confirmed'
        );
        const pendingTickets = tickets.filter(t => 
          t.status === 'New' || t.status === 'Payment pending'
        );

        const totalTicketsSold = confirmedTickets.reduce((sum, ticket) => 
          sum + ticket.number_of_entries, 0
        );

        const totalRevenue = confirmedTickets.reduce((sum, ticket) => 
          sum + (ticket.price_per_ticket * ticket.number_of_entries - ticket.payment_processing_fee), 0
        );

        return {
          total_tickets_sold: totalTicketsSold,
          total_revenue: totalRevenue,
          pending_orders: pendingTickets.length,
          active_referrers: 0 // Will be calculated separately if needed
        };
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new event
   */
  createEvent(eventData: CreateEventForm | Partial<Event>): Observable<Event> {
    // Check if eventData has a poster_file property
    const formEventData = eventData as CreateEventForm;
    
    if (formEventData.poster_file) {
      // Use FormData for file upload
      const formData = new FormData();
      
      // Add all form fields
      formData.append('title', formEventData.title);
      formData.append('date_and_time', formEventData.date_and_time);
      formData.append('venue', formEventData.venue);
      formData.append('description', formEventData.description || '');
      formData.append('ticket_price', formEventData.ticket_price.toString());
      formData.append('close_time', formEventData.close_time || '');
      formData.append('rsvp_link', formEventData.rsvp_link || '');
      formData.append('slug', formEventData.slug);
      
      // Add the poster file
      formData.append('poster', formEventData.poster_file);
      
      return this.http.post<{event: Event}>(`${environment.apiUrl}/events`, formData, {
        headers: this.getAuthHeadersForFormData()
      }).pipe(
        map(response => response.event),
        catchError(this.handleError)
      );
    } else {
      // Use regular JSON for non-file uploads
      return this.http.post<{event: Event}>(`${environment.apiUrl}/events`, eventData, {
        headers: this.getAuthHeaders()
      }).pipe(
        map(response => response.event),
        catchError(this.handleError)
      );
    }
  }

  /**
   * Update an existing event
   */
  updateEvent(eventId: number, eventData: Partial<Event>): Observable<Event> {
    return this.http.put<{event: Event}>(`${environment.apiUrl}/events/${eventId}`, eventData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.event),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing event with file upload
   */
  updateEventWithFile(eventId: number, formData: FormData): Observable<Event> {
    return this.http.put<{event: Event}>(`${environment.apiUrl}/events/${eventId}`, formData, {
      headers: this.getAuthHeadersForFormData()
    }).pipe(
      map(response => response.event),
      catchError(this.handleError)
    );
  }

  /**
   * Add a ticket to an event
   */
  addTicket(ticketData: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets`, ticketData, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Mark a ticket as paid
   */
  markTicketPaid(ticketId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets/mark-paid`, 
      { ticket_id: ticketId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Refresh verification PIN for an event
   */
  refreshVerificationPIN(eventId: number): Observable<{verification_pin: string}> {
    return this.http.post<{verification_pin: string}>(`${environment.apiUrl}/events/${eventId}/refresh-pin`, 
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Clear all cached data (useful for logout)
   */
  clearCache(): void {
    this.selectedEventSubject.next(null);
    localStorage.removeItem(this.SELECTED_EVENT_KEY);
  }
  
  /**
   * Get events with enhanced error information
   */
  getEventsWithRetry(retries: number = 3): Observable<Event[]> {
    return this.getEvents().pipe(
      catchError((error) => {
        if (retries > 0) {
          console.warn(`Event service error, retrying... (${retries} attempts left)`);
          return this.getEventsWithRetry(retries - 1);
        }
        return this.handleError(error);
      })
    );
  }
  
  private handleError(error: any): Observable<never> {
    console.error('Event service error:', error);
    
    let errorMessage = 'An error occurred';
    if (error.status === 0) {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.status === 401) {
      errorMessage = 'You are not authorized to access this resource. Please log in again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to access events.';
    } else if (error.status === 404) {
      errorMessage = 'Events not found.';
    } else if (error.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}