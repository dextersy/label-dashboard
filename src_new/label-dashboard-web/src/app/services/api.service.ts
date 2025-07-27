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
}
