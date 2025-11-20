import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface User {
  id: number;
  username: string;
  email_address: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_superadmin: boolean;
  brand_id: number;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
  status?: string; // 'profile_incomplete' when user needs to complete profile
}

export interface ProfileIncompleteUser {
  id: number;
  email_address: string;
  first_name?: string;
  last_name?: string;
  brand_id: number;
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
      // Check if profile is incomplete
      if (response.status === 'profile_incomplete') {
        // Store temporary token for profile completion
        localStorage.setItem('temp_auth_token', response.token);
        localStorage.setItem('temp_user_data', JSON.stringify(response.user));
        // Don't update current user or auth token
        return response;
      }

      // Normal login - profile is complete
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      return response;
    }));
  }

  completeProfile(username: string, firstName?: string, lastName?: string): Observable<LoginResponse> {
    const tempToken = localStorage.getItem('temp_auth_token');
    if (!tempToken) {
      return throwError(() => new Error('No temporary token found. Please log in again.'));
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/complete-profile`, {
      username,
      first_name: firstName,
      last_name: lastName
    }, {
      headers: { 'Authorization': `Bearer ${tempToken}` }
    }).pipe(map(response => {
      // Clear temporary storage
      localStorage.removeItem('temp_auth_token');
      localStorage.removeItem('temp_user_data');

      // Store full auth token and user data
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      return response;
    }));
  }

  getTempUserData(): ProfileIncompleteUser | null {
    const tempData = localStorage.getItem('temp_user_data');
    return tempData ? JSON.parse(tempData) : null;
  }

  clearTempAuthData(): void {
    localStorage.removeItem('temp_auth_token');
    localStorage.removeItem('temp_user_data');
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    // Clear temp auth data to prevent stale data issues
    this.clearTempAuthData();
    this.currentUserSubject.next(null);
  }

  // Force logout due to session timeout or authorization error
  forceLogout(): void {
    this.logout();
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

  isSuperadmin(): boolean {
    const user = this.currentUserValue;
    return user ? user.is_superadmin : false;
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

  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
  }
}