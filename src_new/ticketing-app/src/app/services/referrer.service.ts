import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EventReferrer, ReferrerFormData } from '../models/event-referrer.model';

@Injectable({ providedIn: 'root' })
export class ReferrerService {
  private readonly base = `${environment.apiUrl}/events/referrers`;

  constructor(private http: HttpClient) {}

  getReferrers(eventId: number): Observable<{ referrers: EventReferrer[] }> {
    return this.http.get<{ referrers: EventReferrer[] }>(this.base, {
      params: { event_id: eventId }
    });
  }

  createReferrer(eventId: number, data: ReferrerFormData): Observable<{ referrer: EventReferrer }> {
    return this.http.post<{ referrer: EventReferrer }>(this.base, { event_id: eventId, ...data });
  }

  updateReferrer(id: number, data: ReferrerFormData): Observable<{ referrer: EventReferrer }> {
    return this.http.put<{ referrer: EventReferrer }>(`${this.base}/${id}`, data);
  }

  deleteReferrer(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
