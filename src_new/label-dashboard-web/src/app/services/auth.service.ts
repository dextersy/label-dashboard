import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface User {
  id: number;
  username: string;
  email_address: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  brand_id: number;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser') || localStorage.getItem('user_data') || 'null';
    const userData = JSON.parse(storedUser);
    
    this.currentUserSubject = new BehaviorSubject<User | null>(userData);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string, brandId: number = 1): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
      username,
      password,
      brand_id: brandId
    }).pipe(map(response => {
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      return response;
    }));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user ? user.is_admin : false;
  }

  // Refresh user data from backend and update local state
  refreshUserData(): Observable<User> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token available');
    }

    return this.http.get<{user: User}>(`${this.apiUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).pipe(map(response => {
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      return response.user;
    }));
  }

  // Update user data without making HTTP request (used by guards)
  updateUserData(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }
}