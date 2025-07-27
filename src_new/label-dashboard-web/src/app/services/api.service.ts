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

  // Authentication
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { username, password });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { headers: this.getAuthHeaders() });
  }

  // Financial
  getFinancialSummary(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financial/summary`, { headers: this.getAuthHeaders() });
  }

  getEarnings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financial/earnings`, { headers: this.getAuthHeaders() });
  }

  getRoyalties(): Observable<any> {
    return this.http.get(`${this.baseUrl}/financial/royalties`, { headers: this.getAuthHeaders() });
  }

  // Artists
  getArtists(): Observable<any> {
    return this.http.get(`${this.baseUrl}/artists`, { headers: this.getAuthHeaders() });
  }

  // Events
  getEvents(): Observable<any> {
    return this.http.get(`${this.baseUrl}/events`, { headers: this.getAuthHeaders() });
  }

  // Brand Settings
  getBrandByDomain(domain: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/public/brand/domain/${domain}`);
  }

  getBrandSettings(brandId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/brands/${brandId}`, { headers: this.getAuthHeaders() });
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
  getProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/profile`, { headers: this.getAuthHeaders() });
  }

  updateProfile(profileData: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/profile`, profileData, { headers: this.getAuthHeaders() });
  }

  changePassword(passwordData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/profile/change-password`, passwordData, { headers: this.getAuthHeaders() });
  }

  checkUsernameExists(username: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/profile/check-username`, { username }, { headers: this.getAuthHeaders() });
  }

  // Invite handling (matching setprofile.php functionality)
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
