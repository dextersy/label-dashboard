import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Event, EventFormData, EventTag } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly base = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}

  getEvents(): Observable<Event[]> {
    return this.http.get<{ events: Event[] }>(this.base).pipe(map(r => r.events));
  }

  getEvent(id: number): Observable<Event> {
    return this.http.get<{ event: Event }>(`${this.base}/${id}`).pipe(map(r => r.event));
  }

  createEvent(data: EventFormData): Observable<{ event: Event }> {
    const formData = this.toFormData(data);
    return this.http.post<{ event: Event }>(this.base, formData);
  }

  updateEvent(id: number, data: EventFormData): Observable<{ event: Event }> {
    const formData = this.toFormData(data);
    return this.http.put<{ event: Event }>(`${this.base}/${id}`, formData);
  }

  publishEvent(id: number): Observable<any> {
    return this.http.post(`${this.base}/${id}/publish`, {});
  }

  unpublishEvent(id: number): Observable<any> {
    return this.http.post(`${this.base}/${id}/unpublish`, {});
  }

  getTags(): Observable<EventTag[]> {
    return this.http.get<{ tags: EventTag[] }>(`${this.base}/tags`).pipe(map(r => r.tags));
  }

  createTag(name: string): Observable<EventTag> {
    return this.http.post<{ tag: EventTag }>(`${this.base}/tags`, { name }).pipe(map(r => r.tag));
  }

  refreshPin(id: number): Observable<{ verification_pin: string }> {
    return this.http.post<{ verification_pin: string }>(`${this.base}/${id}/refresh-pin`, {});
  }

  getTicketSummary(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => httpParams = httpParams.set(k, params[k]));
    }
    return this.http.get(`${this.base}/ticket-summary`, { params: httpParams });
  }

  getTicketHoldersCount(eventId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/ticket-holders-count`, {
      params: new HttpParams().set('event_id', eventId)
    });
  }

  getPendingTickets(params: { event_id: number; page?: number; per_page?: number; search?: string }): Observable<{ tickets: any[]; total: number }> {
    let httpParams = new HttpParams().set('event_id', params.event_id).set('status_filter', 'pending');
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.per_page) httpParams = httpParams.set('per_page', params.per_page);
    if (params.search) httpParams = httpParams.set('name', params.search);
    return this.http.get<{ tickets: any[]; total: number }>(`${this.base}/tickets`, { params: httpParams });
  }

  getPendingCsvUrl(eventId: number): string {
    return `${this.base}/tickets/pending/csv?event_id=${eventId}`;
  }

  markTicketPaid(ticketIds: number[]): Observable<any> {
    return this.http.post(`${this.base}/tickets/mark-paid`, { ticket_ids: ticketIds });
  }

  cancelAllUnpaid(eventId: number): Observable<any> {
    return this.http.post(`${this.base}/tickets/cancel-all-unpaid`, { event_id: eventId });
  }

  verifyPayments(eventId: number): Observable<any> {
    return this.http.post(`${this.base}/tickets/verify-payments`, { event_id: eventId });
  }

  sendEmail(data: { event_id: number; subject: string; body: string }): Observable<any> {
    return this.http.post(`${this.base}/send-email`, data);
  }

  sendTestEmail(data: { event_id: number; subject: string; body: string; test_email: string }): Observable<any> {
    return this.http.post(`${this.base}/send-test-email`, data);
  }

  private toFormData(data: EventFormData): FormData {
    const fd = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof File) {
          fd.append(key, value);
        } else if (typeof value === 'boolean') {
          fd.append(key, value ? '1' : '0');
        } else if (Array.isArray(value)) {
          value.forEach(item => fd.append(key + '[]', String(item)));
        } else {
          fd.append(key, String(value));
        }
      }
    });
    return fd;
  }
}
