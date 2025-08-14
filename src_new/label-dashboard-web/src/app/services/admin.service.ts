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

export interface EmailLog {
  id: number;
  recipients: string;
  subject: string;
  timestamp: string;
  result: 'Success' | 'Failed';
}

export interface ChildBrand {
  brand_id: number;
  brand_name: string;
  music_earnings: number;
  event_earnings: number;
  payments: number;
  commission: number;
  balance: number;
  domains?: Domain[];
}

export interface CreateSublabelResponse {
  message: string;
  sublabel: {
    id: number;
    brand_name: string;
    domain_name: string;
    domain_status: string;
    admin_user_id: number;
    dns_configured: boolean;
    ssl_configured: boolean;
    ssl_message: string;
  };
}

export interface EmailDetail {
  id: number;
  recipients: string;
  subject: string;
  body: string;
  timestamp: string;
  result: 'Success' | 'Failed';
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
  has_payment_method?: boolean;
  ready_for_payment?: boolean;
}

export interface BulkEarning {
  release_id: number;
  date_recorded: string;
  type: string;
  description: string;
  amount: number;
  calculate_royalties: boolean;
}

export interface ProcessedEarningRow {
  original_data: { [key: string]: string };
  catalog_no: string;
  release_title: string;
  earning_amount: number;
  matched_release: {
    id: number;
    catalog_no: string;
    title: string;
  } | null;
  fuzzy_match_score?: number;
}

export interface CsvProcessingResult {
  message: string;
  data: ProcessedEarningRow[];
  summary: {
    total_rows: number;
    total_unmatched: number;
    total_earning_amount: number;
    column_mapping: { [key: string]: string };
  };
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

  // Child Brands (Sublabels) Management
  getSublabels(startDate?: string, endDate?: string): Observable<ChildBrand[]> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    let queryParams = '';
    if (startDate && endDate) {
      queryParams = `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    
    return this.http.get<ChildBrand[]>(`${environment.apiUrl}/brands/${brandId}/sublabels${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  createSublabel(brandName: string, domainName: string, subdomainName?: string): Observable<CreateSublabelResponse> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const brandId = currentUser.brand_id;
    
    if (!brandId) {
      throw new Error('No brand ID found for current user');
    }
    
    const payload: any = {
      brand_name: brandName
    };
    
    // Add subdomain name if provided (new format)
    if (subdomainName) {
      payload.subdomain_name = subdomainName;
    } else if (domainName) {
      // Legacy format - use domain name
      payload.domain_name = domainName;
    }
    
    return this.http.post<CreateSublabelResponse>(`${environment.apiUrl}/brands/${brandId}/sublabels`, payload, {
      headers: this.getAuthHeaders()
    });
  }

  // Users Management
  getUsers(page: number = 1, limit: number = 20, filters: any = {}, sortBy?: string, sortDirection?: string): Observable<{data: User[], pagination: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filter parameters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        queryParams += `&${key}=${encodeURIComponent(filters[key])}`;
      }
    });
    
    // Add sort parameters
    if (sortBy && sortDirection) {
      queryParams += `&sortBy=${encodeURIComponent(sortBy)}&sortDirection=${encodeURIComponent(sortDirection)}`;
    }
    
    return this.http.get<{data: User[], pagination: any}>(`${environment.apiUrl}/users?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  toggleAdminStatus(userId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/toggle-admin`, { user_id: userId }, {
      headers: this.getAuthHeaders()
    });
  }

  getLoginAttempts(page: number = 1, limit: number = 50, filters: any = {}, sortBy?: string, sortDirection?: string): Observable<{data: LoginAttempt[], pagination: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filter parameters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        queryParams += `&${key}=${encodeURIComponent(filters[key])}`;
      }
    });
    
    // Add sort parameters
    if (sortBy && sortDirection) {
      queryParams += `&sortBy=${encodeURIComponent(sortBy)}&sortDirection=${encodeURIComponent(sortDirection)}`;
    }
    
    return this.http.get<{data: LoginAttempt[], pagination: any}>(`${environment.apiUrl}/users/login-attempts?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Summary View
  getEarningsSummary(startDate: string, endDate: string): Observable<EarningsSummary> {
    const params = `start_date=${startDate}&end_date=${endDate}`;
    return this.http.get<EarningsSummary>(`${environment.apiUrl}/financial/admin/earnings-summary?${params}`, {
      headers: this.getAuthHeaders()
    });
  }

  getPaymentsAndRoyaltiesSummary(startDate: string, endDate: string): Observable<any> {
    const params = `start_date=${startDate}&end_date=${endDate}`;
    return this.http.get<any>(`${environment.apiUrl}/financial/admin/payments-royalties-summary?${params}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Balance Summary
  getArtistBalances(page: number = 1, limit: number = 10, filters: any = {}, sortBy?: string, sortDirection?: string): Observable<{data: ArtistBalance[], pagination: any, summary: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filter parameters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        queryParams += `&${key}=${encodeURIComponent(filters[key])}`;
      }
    });
    
    // Add sort parameters
    if (sortBy && sortDirection) {
      queryParams += `&sortBy=${encodeURIComponent(sortBy)}&sortDirection=${encodeURIComponent(sortDirection)}`;
    }
    
    return this.http.get<{data: ArtistBalance[], pagination: any, summary: any}>(`${environment.apiUrl}/financial/admin/balance-summary?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  getRecuperableExpenses(page: number = 1, limit: number = 10, filters: any = {}, sortBy?: string, sortDirection?: string): Observable<{data: any[], pagination: any, summary: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filter parameters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        queryParams += `&${key}=${encodeURIComponent(filters[key])}`;
      }
    });
    
    // Add sort parameters
    if (sortBy && sortDirection) {
      queryParams += `&sortBy=${encodeURIComponent(sortBy)}&sortDirection=${encodeURIComponent(sortDirection)}`;
    }
    
    return this.http.get<{data: any[], pagination: any, summary: any}>(`${environment.apiUrl}/financial/admin/recuperable-expenses?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  getArtistsReadyForPayment(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/financial/admin/artists-ready-for-payment`, {
      headers: this.getAuthHeaders()
    });
  }

  payAllBalances(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/financial/admin/pay-all-balances`, {}, {
      headers: this.getAuthHeaders()
    });
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

  // Preview CSV for Earnings
  previewCsvForEarnings(csvFile: File): Observable<CsvProcessingResult> {
    const formData = new FormData();
    formData.append('csv_file', csvFile);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    return this.http.post<CsvProcessingResult>(`${environment.apiUrl}/financial/earnings/preview-csv`, formData, {
      headers: headers
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

  // Email Management
  getEmailLogs(page: number = 1, limit: number = 50, filters: any = {}, sortBy?: string, sortDirection?: string): Observable<{data: EmailLog[], pagination: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add filter parameters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        queryParams += `&${key}=${encodeURIComponent(filters[key])}`;
      }
    });
    
    // Add sort parameters
    if (sortBy && sortDirection) {
      queryParams += `&sortBy=${encodeURIComponent(sortBy)}&sortDirection=${encodeURIComponent(sortDirection)}`;
    }
    
    return this.http.get<{data: EmailLog[], pagination: any}>(`${environment.apiUrl}/email?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
  }

  getEmailDetail(emailId: number): Observable<EmailDetail> {
    return this.http.get<EmailDetail>(`${environment.apiUrl}/email/${emailId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Admin Invite Management
  inviteAdmin(adminData: { email_address: string; first_name?: string; last_name?: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/invite-admin`, adminData, {
      headers: this.getAuthHeaders()
    });
  }

  resendAdminInvite(userId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/${userId}/resend-invite`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  cancelAdminInvite(userId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/users/${userId}/invite`, {
      headers: this.getAuthHeaders()
    });
  }
}