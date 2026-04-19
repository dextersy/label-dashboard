import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  email_address?: string;
  first_name?: string;
  last_name?: string;
  brand_id: number;
  is_admin?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'your_scene_token';
  private readonly USER_KEY = 'your_scene_user';
  private readonly TEMP_TOKEN_KEY = 'your_scene_temp_token';
  private readonly NEEDS_TERMS_KEY = 'your_scene_needs_terms';
  private readonly NEEDS_BRAND_NAME_KEY = 'your_scene_needs_brand_name';
  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUser());

  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/ticketing/login`, { email, password }).pipe(
      tap((res: any) => this.handleAuthResponse(res))
    );
  }

  signup(data: { full_name: string; email: string; password: string; brand_name: string; terms_accepted: boolean }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/ticketing/signup`, data).pipe(
      tap((res: any) => this.handleAuthResponse(res))
    );
  }

  completeProfile(data: { username: string; terms_accepted?: boolean; brand_name?: string }): Observable<any> {
    const tempToken = this.getTempToken();
    return this.http.post(`${environment.apiUrl}/auth/complete-profile`, data, {
      headers: { Authorization: `Bearer ${tempToken}` }
    }).pipe(
      tap((res: any) => {
        this.clearTempToken();
        this.handleAuthResponse(res);
      })
    );
  }

  getMe(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/me`).pipe(
      tap((res: any) => {
        if (res.user) {
          this.currentUserSubject.next(res.user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TEMP_TOKEN_KEY);
    localStorage.removeItem(this.NEEDS_TERMS_KEY);
    localStorage.removeItem(this.NEEDS_BRAND_NAME_KEY);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getTempToken(): string | null {
    return localStorage.getItem(this.TEMP_TOKEN_KEY);
  }

  needsTerms(): boolean {
    return localStorage.getItem(this.NEEDS_TERMS_KEY) === 'true';
  }

  needsBrandName(): boolean {
    return localStorage.getItem(this.NEEDS_BRAND_NAME_KEY) === 'true';
  }

  /**
   * Redeems the one-time exchange code issued by the Google OAuth callback.
   * The code is posted to the backend which returns a JWT in the response body,
   * keeping all tokens out of URLs, logs, and browser history.
   */
  exchangeGoogleCode(code: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/ticketing/google/exchange`, { code }).pipe(
      tap((res: any) => this.handleAuthResponse(res))
    );
  }

  /** @deprecated Only kept for compatibility — use exchangeGoogleCode for Google OAuth. */
  storeToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /** @deprecated Only kept for compatibility — use exchangeGoogleCode for Google OAuth. */
  storeTempToken(tempToken: string, needsTerms: boolean): void {
    localStorage.setItem(this.TEMP_TOKEN_KEY, tempToken);
    localStorage.setItem(this.NEEDS_TERMS_KEY, needsTerms ? 'true' : 'false');
  }

  clearTempToken(): void {
    localStorage.removeItem(this.TEMP_TOKEN_KEY);
    localStorage.removeItem(this.NEEDS_TERMS_KEY);
    localStorage.removeItem(this.NEEDS_BRAND_NAME_KEY);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleAuthResponse(res: any): void {
    if (res.status === 'profile_incomplete') {
      // Store temp token separately — don't set as main auth token
      if (res.token) {
        localStorage.setItem(this.TEMP_TOKEN_KEY, res.token);
      }
      localStorage.setItem(this.NEEDS_TERMS_KEY, res.needs_terms ? 'true' : 'false');
      localStorage.setItem(this.NEEDS_BRAND_NAME_KEY, res.needs_brand_name ? 'true' : 'false');
      return;
    }

    if (res.token) {
      localStorage.setItem(this.TOKEN_KEY, res.token);
    }
    const user = res.user;
    if (user) {
      this.currentUserSubject.next(user);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  private loadUser(): User | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}
