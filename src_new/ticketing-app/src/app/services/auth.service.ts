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
  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUser());

  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/ticketing/login`, { email, password }).pipe(
      tap((res: any) => this.handleAuthResponse(res))
    );
  }

  signup(data: { full_name: string; email: string; password: string; brand_name: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/ticketing/signup`, data).pipe(
      tap((res: any) => this.handleAuthResponse(res))
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
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleAuthResponse(res: any): void {
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
