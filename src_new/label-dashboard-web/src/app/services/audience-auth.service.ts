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
}

export interface AudienceAuthResponse {
  token: string;
  user: AudienceUser;
  claimed_tickets_count: number;
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

  storeSession(token: string, user: AudienceUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private storeAuth(response: AudienceAuthResponse): void {
    this.storeSession(response.token, response.user);
  }

  login(email: string, password: string): Observable<AudienceAuthResponse> {
    return this.http.post<AudienceAuthResponse>(`${this.apiUrl}/auth/audience/login`, { email, password })
      .pipe(tap(res => this.storeAuth(res)));
  }

  signup(email: string, password: string, first_name: string, last_name: string): Observable<AudienceAuthResponse> {
    return this.http.post<AudienceAuthResponse>(`${this.apiUrl}/auth/audience/signup`, { email, password, first_name, last_name })
      .pipe(tap(res => this.storeAuth(res)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  exchangeGoogleCode(code: string): Observable<AudienceAuthResponse> {
    return this.http.post<AudienceAuthResponse>(`${this.apiUrl}/auth/audience/google/exchange`, { code })
      .pipe(tap(res => this.storeAuth(res)));
  }

  claimTicketsByEmail(): Observable<{ claimed_tickets_count: number }> {
    const token = this.getToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ claimed_tickets_count: number }>(`${this.apiUrl}/public/audience/claim`, {}, { headers });
  }

  /** Reads a ys_auth payload from the URL fragment (Google popup fallback), clears it, and stores the session. */
  consumeAuthFragment(): AudienceAuthResponse | null {
    const hash = window.location.hash;
    if (!hash.startsWith('#ys_auth=')) return null;
    try {
      const data = JSON.parse(decodeURIComponent(hash.slice('#ys_auth='.length)));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (data.type === 'ys_auth' && data.token && data.user) {
        this.storeSession(data.token, data.user);
        return data as AudienceAuthResponse;
      }
    } catch {}
    return null;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
