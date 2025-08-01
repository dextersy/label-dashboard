import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: number;
  username: string;
  email_address: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  last_login?: string;
}

export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/profile`, {
      headers: this.getAuthHeaders()
    });
  }

  updateProfile(profileData: UpdateProfileRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/profile`, profileData, {
      headers: this.getAuthHeaders()
    });
  }

  changePassword(passwordData: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/profile/change-password`, passwordData, {
      headers: this.getAuthHeaders()
    });
  }
}