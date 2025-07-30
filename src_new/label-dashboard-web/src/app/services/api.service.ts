import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Artists
  getArtists(): Observable<any> {
    return this.http.get(`${this.baseUrl}/artists`, { headers: this.getAuthHeaders() });
  }

  // Brand Settings
  getBrandByDomain(domain: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/public/brand/domain/${domain}`);
  }

  // Password Reset
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/reset-password`, { token, password });
  }

  validateResetHash(hash: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/validate-reset-hash/${hash}`);
  }

  // Profile Management
  checkUsernameExists(username: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/profile/check-username`, { username }, { headers: this.getAuthHeaders() });
  }

  // Invite handling
  processInvite(inviteHash: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/invite/process`, { invite_hash: inviteHash });
  }

  getInviteData(inviteHash: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/invite/data/${inviteHash}`);
  }

  setupUserProfile(setupData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/invite/setup-profile`, setupData);
  }
}
