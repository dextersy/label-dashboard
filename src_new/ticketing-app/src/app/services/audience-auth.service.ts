import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AudienceUser {
  id: number;
  email_address: string;
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  profile_photo_url?: string;
  membership_id?: string;
  membership_tier?: string;
  email_verified?: boolean;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  age_confirmed_at?: string | null;
}

export interface AudienceAuthResponse {
  token: string;
  user: AudienceUser;
  claimed_tickets_count: number;
  needs_terms_acceptance?: boolean;
}

const TOKEN_KEY = 'ys_audience_token';
const USER_KEY = 'ys_audience_user';

@Injectable({ providedIn: 'root' })
export class AudienceAuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUser(): AudienceUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private storeAuth(response: AudienceAuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  login(email: string, password: string): Observable<AudienceAuthResponse> {
    return this.http.post<AudienceAuthResponse>(`${this.apiUrl}/auth/audience/login`, { email, password })
      .pipe(tap(res => this.storeAuth(res)));
  }

  signup(email: string, password: string, first_name: string, last_name: string, terms_accepted: boolean, privacy_accepted: boolean, age_confirmed: boolean): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/audience/signup`, { email, password, first_name, last_name, terms_accepted, privacy_accepted, age_confirmed });
  }

  acceptTerms(terms_accepted: boolean, privacy_accepted: boolean, age_confirmed: boolean): Observable<AudienceUser> {
    const headers = this.getAuthHeaders();
    return this.http.post<AudienceUser>(`${this.apiUrl}/auth/audience/accept-terms`, { terms_accepted, privacy_accepted, age_confirmed }, { headers })
      .pipe(tap(user => this.updateStoredUser(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  toggleEventLike(eventId: number): Observable<{ liked: boolean; like_count: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ liked: boolean; like_count: number }>(
      `${this.apiUrl}/public/audience/events/${eventId}/like`, {}, { headers }
    );
  }

  getLikedEvents(): Observable<{ liked_event_ids: number[] }> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ liked_event_ids: number[] }>(`${this.apiUrl}/public/audience/me/liked-events`, { headers });
  }

  getTickets(): Observable<{ tickets: any[] }> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ tickets: any[] }>(`${this.apiUrl}/public/audience/me/tickets`, { headers });
  }

  downloadTicketPDF(ticketCode: string): Observable<Blob> {
    const headers = this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/public/audience/tickets/${ticketCode}/pdf`, {
      headers,
      responseType: 'blob'
    });
  }

  verifyEmail(token: string): Observable<AudienceAuthResponse & { message: string }> {
    return this.http.get<AudienceAuthResponse & { message: string }>(`${this.apiUrl}/auth/audience/verify-email`, { params: { token } })
      .pipe(tap(res => this.storeAuth(res)));
  }

  resendVerification(): Observable<{ message: string }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/audience/resend-verification`, {}, { headers });
  }

  resendVerificationByEmail(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/audience/resend-verification-by-email`, { email });
  }

  getMe(): Observable<AudienceUser> {
    const headers = this.getAuthHeaders();
    return this.http.get<AudienceUser>(`${this.apiUrl}/auth/audience/me`, { headers })
      .pipe(tap(user => this.updateStoredUser(user)));
  }

  updateProfile(data: { first_name: string; last_name: string; contact_number?: string }): Observable<AudienceUser> {
    const headers = this.getAuthHeaders();
    return this.http.patch<AudienceUser>(`${this.apiUrl}/auth/audience/me`, data, { headers })
      .pipe(tap(user => this.updateStoredUser(user)));
  }

  uploadProfilePhoto(file: File): Observable<AudienceUser> {
    const headers = this.getAuthHeaders();
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<AudienceUser>(`${this.apiUrl}/auth/audience/me/photo`, formData, { headers })
      .pipe(tap(user => this.updateStoredUser(user)));
  }

  updateStoredUser(user: AudienceUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  markEmailVerified(): void {
    const user = this.getUser();
    if (user) {
      user.email_verified = true;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
}
