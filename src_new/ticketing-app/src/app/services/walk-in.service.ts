import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WalkInType, WalkInTypeFormData } from '../models/walk-in-type.model';
import { WalkInTransaction } from '../models/walk-in-transaction.model';

@Injectable({ providedIn: 'root' })
export class WalkInService {
  private readonly base = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}

  getWalkInTypes(eventId: number): Observable<{ walkInTypes: WalkInType[] }> {
    return this.http.get<{ walkInTypes: WalkInType[] }>(`${this.base}/walk-in-types`, {
      params: { event_id: eventId }
    });
  }

  createWalkInType(eventId: number, data: WalkInTypeFormData): Observable<{ walkInType: WalkInType }> {
    return this.http.post<{ walkInType: WalkInType }>(`${this.base}/walk-in-types`, { event_id: eventId, ...data });
  }

  updateWalkInType(id: number, data: WalkInTypeFormData): Observable<{ walkInType: WalkInType }> {
    return this.http.put<{ walkInType: WalkInType }>(`${this.base}/walk-in-types/${id}`, data);
  }

  deleteWalkInType(id: number): Observable<any> {
    return this.http.delete(`${this.base}/walk-in-types/${id}`);
  }

  getWalkInTransactions(params: { event_id: number; page?: number; per_page?: number }): Observable<{ transactions: WalkInTransaction[]; total: number }> {
    let httpParams = new HttpParams().set('event_id', params.event_id);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.per_page) httpParams = httpParams.set('per_page', params.per_page);
    return this.http.get<{ transactions: WalkInTransaction[]; total: number }>(`${this.base}/walk-in-transactions`, { params: httpParams });
  }
}
