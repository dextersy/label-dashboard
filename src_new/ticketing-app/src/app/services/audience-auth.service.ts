import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AudienceUser {
  id: number;
  email_address: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
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

  private storeAuth(response: AudienceAuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  login(email: string, password: string): Observable<AudienceAuthResponse> {
    return this.http.post<AudienceAuthResponse>(`${this.apiUrl}/auth/audience/login`, { email, password })
      .pipe(tap(res => this.storeAuth(res)));
  }

  signup(email: string, password: string, first_name: string, last_name: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/audience/signup`, { email, password, first_name, last_name });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
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

  markEmailVerified(): void {
    const user = this.getUser();
    if (user) {
      user.email_verified = true;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
}
