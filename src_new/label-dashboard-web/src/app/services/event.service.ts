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
  name: string;
  referral_code: string;
  tickets_sold: number;
  gross_amount_sold: number;
  net_amount_sold: number;
  referral_shortlink: string;
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
  private dataRefreshSubject = new BehaviorSubject<void>(undefined);
  public dataRefresh$ = this.dataRefreshSubject.asObservable();
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
   * Get tickets for a specific event with pagination and filtering
   */
  getEventTickets(
    eventId: number, 
    params?: {
      page?: number;
      per_page?: number;
      sort_column?: string;
      sort_direction?: 'asc' | 'desc';
      filters?: { [key: string]: string };
    }
  ): Observable<{ tickets: EventTicket[], pagination?: any }> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    const queryParams: any = { event_id: eventId.toString() };
    
    if (params) {
      if (params.page) queryParams.page = params.page.toString();
      if (params.per_page) queryParams.per_page = params.per_page.toString();
      if (params.sort_column) queryParams.sort_column = params.sort_column;
      if (params.sort_direction) queryParams.sort_direction = params.sort_direction;
      
      // Add filter parameters
      if (params.filters) {
        Object.keys(params.filters).forEach(key => {
          if (params.filters![key]) {
            queryParams[key] = params.filters![key];
          }
        });
      }
    }
    
    return this.http.get<{tickets: EventTicket[], pagination?: any}>(`${environment.apiUrl}/events/tickets`, {
      headers: this.getAuthHeaders(),
      params: queryParams
    }).pipe(
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
   * Cancel a ticket
   */
  cancelTicket(ticketId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets/cancel`, 
      { ticket_id: ticketId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Resend ticket email
   */
  resendTicket(ticketId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets/resend`, 
      { ticket_id: ticketId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Cancel all unpaid tickets for an event
   */
  cancelAllUnpaidTickets(eventId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets/cancel-all-unpaid`, 
      { event_id: eventId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Verify all payments for pending tickets in an event
   */
  verifyAllPayments(eventId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/events/tickets/verify-payments`, 
      { event_id: eventId },
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
   * Get event referrers for a specific event
   */
  getEventReferrers(eventId: number): Observable<EventReferrer[]> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.http.get<{referrers: EventReferrer[]}>(`${environment.apiUrl}/events/referrers`, {
      headers: this.getAuthHeaders(),
      params: { event_id: eventId.toString() }
    }).pipe(
      map(response => response.referrers),
      catchError(this.handleError)
    );
  }

  /**
   * Create a new event referrer
   */
  createEventReferrer(eventId: number, referrerData: { name: string; referral_code: string; slug: string }): Observable<EventReferrer> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.http.post<{referrer: EventReferrer}>(`${environment.apiUrl}/events/referrers`, {
      event_id: eventId,
      ...referrerData
    }, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.referrer),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing event referrer
   */
  updateEventReferrer(referrerId: number, referrerData: { name: string; referral_code: string }): Observable<EventReferrer> {
    if (!referrerId || isNaN(referrerId) || referrerId <= 0) {
      return throwError(() => new Error('Invalid referrer ID provided'));
    }
    
    return this.http.put<{referrer: EventReferrer}>(`${environment.apiUrl}/events/referrers/${referrerId}`, referrerData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.referrer),
      catchError(this.handleError)
    );
  }

  /**
   * Delete an event referrer
   */
  deleteEventReferrer(referrerId: number): Observable<any> {
    if (!referrerId || isNaN(referrerId) || referrerId <= 0) {
      return throwError(() => new Error('Invalid referrer ID provided'));
    }
    
    return this.http.delete(`${environment.apiUrl}/events/referrers/${referrerId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get ticket holders count for an event
   */
  getEventTicketHoldersCount(eventId: number): Observable<{recipients_count: number, total_confirmed_tickets: number}> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }
    
    return this.http.get<{recipients_count: number, total_confirmed_tickets: number}>(`${environment.apiUrl}/events/ticket-holders-count`, {
      headers: this.getAuthHeaders(),
      params: { event_id: eventId.toString() }
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Send email to all confirmed ticket holders for an event
   */
  sendEventEmail(eventId: number, emailData: { subject: string; message: string; include_banner?: boolean }): Observable<any> {
    if (!eventId || isNaN(eventId) || eventId <= 0) {
      return throwError(() => new Error('Invalid event ID provided'));
    }

    return this.http.post(`${environment.apiUrl}/events/send-email`, {
      event_id: eventId,
      ...emailData
    }, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Trigger data refresh for all tab components
   */
  triggerDataRefresh(): void {
    this.dataRefreshSubject.next();
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