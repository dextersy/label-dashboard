import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BrandSettings {
  id: number;
  name: string; // Match backend response
  brand_website?: string;
  brand_color: string;
  logo_url?: string;
  favicon_url?: string;
  catalog_prefix?: string;
  release_submission_url?: string;
  paymongo_wallet_id?: string;
  payment_processing_fee_for_payouts?: number;
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
    // Get current user's brand_id from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.get<BrandSettings>(`${environment.apiUrl}/brands/${brandId}`, {
      headers: this.getAuthHeaders()
    });
  }

  updateBrandSettings(brandSettings: BrandSettings): Observable<any> {
    // Get current user's brand_id from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.put(`${environment.apiUrl}/brands/${brandId}`, brandSettings, {
      headers: this.getAuthHeaders()
    });
  }

  uploadBrandLogo(file: File): Observable<any> {
    // Get current user's brand_id from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    const formData = new FormData();
    formData.append('logo', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    return this.http.post(`${environment.apiUrl}/brands/${brandId}/logo`, formData, {
      headers: headers
    });
  }

  uploadFavicon(file: File): Observable<any> {
    // Get current user's brand_id from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    const formData = new FormData();
    formData.append('favicon', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    return this.http.post(`${environment.apiUrl}/brands/${brandId}/favicon`, formData, {
      headers: headers
    });
  }

  // Domains
  getDomains(): Observable<Domain[]> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.get<Domain[]>(`${environment.apiUrl}/brands/${brandId}/domains`, {
      headers: this.getAuthHeaders()
    });
  }

  addDomain(domainName: string): Observable<any> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.post(`${environment.apiUrl}/brands/${brandId}/domains`, 
      { domain_name: domainName }, 
      { headers: this.getAuthHeaders() }
    );
  }

  deleteDomain(domainName: string): Observable<any> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.delete(`${environment.apiUrl}/brands/${brandId}/domains/${encodeURIComponent(domainName)}`, {
      headers: this.getAuthHeaders()
    });
  }

  verifyDomain(domainName: string): Observable<any> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    return this.http.put(`${environment.apiUrl}/brands/${brandId}/domains/${encodeURIComponent(domainName)}/verify`, 
      {}, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Users Management
  getUsers(): Observable<User[]> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getUsers: Using mock response - endpoint not implemented');
    return of([
      {
        id: 1,
        username: 'admin',
        first_name: 'Admin',
        last_name: 'User',
        email_address: 'admin@example.com',
        last_logged_in: new Date().toISOString(),
        is_admin: true
      },
      {
        id: 2,
        username: 'artist1',
        first_name: 'Test',
        last_name: 'Artist',
        email_address: 'artist@example.com',
        last_logged_in: new Date(Date.now() - 86400000).toISOString(),
        is_admin: false
      }
    ]);
  }

  toggleAdminStatus(userId: number): Observable<any> {
    // Use existing users endpoint
    return this.http.post(`${environment.apiUrl}/users/toggle-admin`, { user_id: userId }, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(() => {
        console.warn('toggleAdminStatus: Using mock response - endpoint may not be implemented');
        return of({ message: 'Admin status updated successfully (mock)' });
      })
    );
  }

  getLoginAttempts(limit: number = 300): Observable<LoginAttempt[]> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getLoginAttempts: Using mock response - endpoint not implemented');
    return of([
      {
        username: 'admin',
        name: 'Admin User',
        date_and_time: new Date().toISOString(),
        result: 'Success',
        remote_ip: '127.0.0.1'
      },
      {
        username: 'artist1',
        name: 'Test Artist',
        date_and_time: new Date(Date.now() - 3600000).toISOString(),
        result: 'Success',
        remote_ip: '127.0.0.1'
      }
    ]);
  }

  // Summary View
  getEarningsSummary(startDate: string, endDate: string): Observable<EarningsSummary> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getEarningsSummary: Using mock response - endpoint not implemented');
    return of({
      physical_earnings: 15000,
      download_earnings: 8500,
      streaming_earnings: 45000,
      sync_earnings: 12000
    });
  }

  getPaymentsAndRoyaltiesSummary(startDate: string, endDate: string): Observable<any> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getPaymentsAndRoyaltiesSummary: Using mock response - endpoint not implemented');
    return of({
      total_payments: 25000,
      total_royalties: 80500,
      total_balance: 55500
    });
  }

  // Balance Summary
  getArtistBalances(): Observable<ArtistBalance[]> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getArtistBalances: Using mock response - endpoint not implemented');
    return of([
      {
        id: 1,
        name: 'Test Artist 1',
        total_royalties: 50000,
        total_payments: 15000,
        total_balance: 35000,
        payout_point: 25000,
        due_for_payment: true,
        hold_payouts: false
      },
      {
        id: 2,
        name: 'Test Artist 2',
        total_royalties: 30500,
        total_payments: 10000,
        total_balance: 20500,
        payout_point: 20000,
        due_for_payment: true,
        hold_payouts: true
      }
    ]);
  }

  getRecuperableExpenses(): Observable<any[]> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('getRecuperableExpenses: Using mock response - endpoint not implemented');
    return of([
      {
        release_title: 'Test Release 1',
        remaining_expense: 5000
      },
      {
        release_title: 'Test Release 2', 
        remaining_expense: 3500
      }
    ]);
  }

  payAllBalances(): Observable<any> {
    // TODO: Replace with actual API call when endpoint is implemented
    console.warn('payAllBalances: Using mock response - endpoint not implemented');
    return of({ message: 'All balances paid successfully (mock)' });
  }

  // Bulk Add Earnings
  bulkAddEarnings(earnings: BulkEarning[]): Observable<any> {
    // Use existing bulk earnings endpoint if available
    return this.http.post(`${environment.apiUrl}/financial/earnings/bulk`, { earnings }, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(() => {
        console.warn('bulkAddEarnings: Using mock response - endpoint may not be implemented');
        return of({ message: `${earnings.length} earnings added successfully (mock)` });
      })
    );
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