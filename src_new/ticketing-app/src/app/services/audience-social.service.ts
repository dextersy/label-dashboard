import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AudienceConnectionItem,
  AudienceAttendee,
  AudiencePublicProfile,
  ConnectionMeta,
} from '../models/audience-connection';
import { AudienceNotification } from '../models/audience-notification';

@Injectable({ providedIn: 'root' })
export class AudienceSocialService {
  private readonly base = `${environment.apiUrl}/public/audience/social`;
  private readonly notifBase = `${environment.apiUrl}/public/audience/notifications`;

  constructor(private http: HttpClient) {}

  private headers(): { headers: HttpHeaders } {
    const token = localStorage.getItem('ys_audience_token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  // ─── Connections ────────────────────────────────────────────────────────────

  getConnections(): Observable<{ connections: AudienceConnectionItem[] }> {
    return this.http.get<{ connections: AudienceConnectionItem[] }>(
      `${this.base}/connections`,
      this.headers(),
    );
  }

  getPendingRequests(): Observable<{ pending: AudienceConnectionItem[] }> {
    return this.http.get<{ pending: AudienceConnectionItem[] }>(
      `${this.base}/connections/pending`,
      this.headers(),
    );
  }

  sendRequest(userId: number): Observable<{ connection_id: number; status: string }> {
    return this.http.post<{ connection_id: number; status: string }>(
      `${this.base}/connections/request`,
      { user_id: userId },
      this.headers(),
    );
  }

  acceptRequest(connectionId: number): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.base}/connections/${connectionId}/accept`,
      {},
      this.headers(),
    );
  }

  declineRequest(connectionId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/connections/${connectionId}/decline`,
      {},
      this.headers(),
    );
  }

  removeConnection(connectionId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/connections/${connectionId}`,
      this.headers(),
    );
  }

  blockUser(connectionId: number): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.base}/connections/${connectionId}/block`,
      {},
      this.headers(),
    );
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  discoverAtEvent(eventId: number): Observable<{ attendees: AudienceAttendee[] }> {
    return this.http.get<{ attendees: AudienceAttendee[] }>(
      `${this.base}/discover/event/${eventId}`,
      this.headers(),
    );
  }

  getUserProfile(userId: number): Observable<{ user: AudiencePublicProfile; connection: ConnectionMeta | null }> {
    return this.http.get<{ user: AudiencePublicProfile; connection: ConnectionMeta | null }>(
      `${this.base}/users/${userId}`,
      this.headers(),
    );
  }

  // ─── Notifications ──────────────────────────────────────────────────────────

  getNotifications(limit = 30, offset = 0): Observable<{ total: number; notifications: AudienceNotification[] }> {
    return this.http.get<{ total: number; notifications: AudienceNotification[] }>(
      `${this.notifBase}?limit=${limit}&offset=${offset}`,
      this.headers(),
    );
  }

  getUnreadCount(): Observable<{ unread_count: number }> {
    return this.http.get<{ unread_count: number }>(
      `${this.notifBase}/unread-count`,
      this.headers(),
    );
  }

  markRead(notifId: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.notifBase}/${notifId}/read`,
      {},
      this.headers(),
    );
  }

  markAllRead(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.notifBase}/read-all`,
      {},
      this.headers(),
    );
  }
}
