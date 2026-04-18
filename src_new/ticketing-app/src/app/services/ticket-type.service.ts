import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TicketType, TicketTypeFormData } from '../models/ticket-type.model';

@Injectable({ providedIn: 'root' })
export class TicketTypeService {
  private readonly base = `${environment.apiUrl}/events/ticket-types`;

  constructor(private http: HttpClient) {}

  getTicketTypes(eventId: number): Observable<{ ticketTypes: TicketType[] }> {
    return this.http.get<{ ticketTypes: TicketType[] }>(this.base, {
      params: { event_id: eventId }
    });
  }

  createTicketType(eventId: number, data: TicketTypeFormData): Observable<{ ticketType: TicketType }> {
    return this.http.post<{ ticketType: TicketType }>(this.base, { event_id: eventId, ...data });
  }

  updateTicketType(id: number, data: TicketTypeFormData): Observable<{ ticketType: TicketType }> {
    return this.http.put<{ ticketType: TicketType }>(`${this.base}/${id}`, data);
  }

  deleteTicketType(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
