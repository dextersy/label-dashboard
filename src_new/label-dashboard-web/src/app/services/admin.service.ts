import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BrandSettings {
  id: number;
  brand_name: string;
  brand_website: string;
  brand_color: string;
  logo_url?: string;
  favicon_url?: string;
  catalog_prefix: string;
  release_submission_url: string;
  paymongo_wallet_id?: string;
  payment_processing_fee_for_payouts: number;
}

export interface Domain {
  domain_name: string;
  status: string;
  brand_id: number;
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email_address: string;
  last_logged_in?: string;
  is_admin: boolean;
}

export interface LoginAttempt {
  username: string;
  name: string;
  date_and_time: string;
  result: string;
  remote_ip: string;
}

export interface EarningsSummary {
  physical_earnings: number;
  download_earnings: number;
  streaming_earnings: number;
  sync_earnings: number;
}

export interface ArtistBalance {
  id: number;
  name: string;
  total_royalties: number;
  total_payments: number;
  total_balance: number;
  payout_point: number;
  due_for_payment: boolean;
  hold_payouts: boolean;
}

export interface BulkEarning {
  release_id: number;
  date_recorded: string;
  type: string;
  description: string;
  amount: number;
  calculate_royalties: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Brand Settings
  getBrandSettings(): Observable<BrandSettings> {
    return this.http.get<BrandSettings>(`${environment.apiUrl}/admin/brand-settings`, {
      headers: this.getAuthHeaders()
    });
  }

  updateBrandSettings(brandSettings: BrandSettings): Observable<any> {
    return this.http.put(`${environment.apiUrl}/admin/brand-settings`, brandSettings, {
      headers: this.getAuthHeaders()
    });
  }

  uploadBrandLogo(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    return this.http.post(`${environment.apiUrl}/admin/brand-settings/logo`, formData, {
      headers: headers
    });
  }

  uploadFavicon(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('favicon', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    return this.http.post(`${environment.apiUrl}/admin/brand-settings/favicon`, formData, {
      headers: headers
    });
  }

  // Domains
  getDomains(): Observable<Domain[]> {
    return this.http.get<Domain[]>(`${environment.apiUrl}/admin/domains`, {
      headers: this.getAuthHeaders()
    });
  }

  addDomain(domainName: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/domains`, { domain_name: domainName }, {
      headers: this.getAuthHeaders()
    });
  }

  deleteDomain(domainName: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin/domains/${domainName}`, {
      headers: this.getAuthHeaders()
    });
  }

  verifyDomain(domainName: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/domains/${domainName}/verify`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  // Users Management
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/admin/users`, {
      headers: this.getAuthHeaders()
    });
  }

  toggleAdminStatus(userId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/users/${userId}/toggle-admin`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  getLoginAttempts(limit: number = 300): Observable<LoginAttempt[]> {
    return this.http.get<LoginAttempt[]>(`${environment.apiUrl}/admin/login-attempts?limit=${limit}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Summary View
  getEarningsSummary(startDate: string, endDate: string): Observable<EarningsSummary> {
    return this.http.get<EarningsSummary>(`${environment.apiUrl}/admin/earnings-summary?start_date=${startDate}&end_date=${endDate}`, {
      headers: this.getAuthHeaders()
    });
  }

  getPaymentsAndRoyaltiesSummary(startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/admin/payments-royalties-summary?start_date=${startDate}&end_date=${endDate}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Balance Summary
  getArtistBalances(): Observable<ArtistBalance[]> {
    return this.http.get<ArtistBalance[]>(`${environment.apiUrl}/admin/artist-balances`, {
      headers: this.getAuthHeaders()
    });
  }

  getRecuperableExpenses(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/admin/recuperable-expenses`, {
      headers: this.getAuthHeaders()
    });
  }

  payAllBalances(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/pay-all-balances`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  // Bulk Add Earnings
  bulkAddEarnings(earnings: BulkEarning[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin/bulk-add-earnings`, { earnings }, {
      headers: this.getAuthHeaders()
    });
  }

  // Wallet Balance
  getWalletBalance(): Observable<number> {
    return this.http.get<{balance: number}>(`${environment.apiUrl}/financial/wallet/balance`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.balance)
    );
  }
}