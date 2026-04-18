import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket } from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly base = `${environment.apiUrl}/events/tickets`;

  constructor(private http: HttpClient) {}

  getTickets(params?: { event_id?: number; search?: string; status_filter?: string; page?: number; per_page?: number }): Observable<{ tickets: Ticket[]; total: number }> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.event_id !== undefined) httpParams = httpParams.set('event_id', params.event_id);
      if (params.search) httpParams = httpParams.set('name', params.search);
      if (params.status_filter) httpParams = httpParams.set('status_filter', params.status_filter);
      if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
      if (params.per_page !== undefined) httpParams = httpParams.set('per_page', params.per_page);
    }
    return this.http.get<{ tickets: Ticket[]; total: number }>(this.base, { params: httpParams });
  }

  cancelTicket(id: number): Observable<any> {
    return this.http.post(`${this.base}/cancel`, { ticket_id: id });
  }

  refundTicket(id: number): Observable<any> {
    return this.http.post(`${this.base}/refund`, { ticket_id: id });
  }

  resendTicket(id: number): Observable<any> {
    return this.http.post(`${this.base}/resend`, { ticket_id: id });
  }

  exportCsvUrl(params?: { event_id?: number }): string {
    let query = '';
    if (params?.event_id) query = `?event_id=${params.event_id}`;
    return `${this.base}/csv${query}`;
  }
}
