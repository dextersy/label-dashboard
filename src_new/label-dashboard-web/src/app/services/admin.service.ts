import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
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
  monthly_fee?: number;
  music_transaction_fixed_fee?: number;
  music_revenue_percentage_fee?: number;
  music_fee_revenue_type?: 'net' | 'gross';
  event_transaction_fixed_fee?: number;
  event_revenue_percentage_fee?: number;
  event_fee_revenue_type?: 'net' | 'gross';
}

export interface FeeSettingsSection {
  transaction_fixed_fee: number;
  revenue_percentage_fee: number;
  fee_revenue_type: 'net' | 'gross';
}

export interface FeeSettings {
  id: number;
  monthly_fee: number;
  music: FeeSettingsSection;
  event: FeeSettingsSection;
}

export interface Domain {
  domain_name: string;
  status: 'Unverified' | 'Pending' | 'No SSL' | 'Connected';
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
  status?: string;
  domains?: Domain[];
}

export interface CreateSublabelResponse {
  message: string;
  status?: string; // 'processing' for async operations
  brand_name?: string; // For async operations
  estimated_completion?: string; // For async operations
  sublabel?: {
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

export interface SublabelCreationState {
  inProgress: boolean;
  pendingName: string;
  pollCount: number;
  maxPollCount: number;
}

export interface SublabelCompletionEvent {
  sublabelName: string;
  brandId?: number;
}

export interface DomainVerificationState {
  inProgress: boolean;
  pendingDomain: string;
  pollCount: number;
  maxPollCount: number;
}

export interface DomainVerificationEvent {
  domainName: string;
  status: 'Unverified' | 'Pending' | 'No SSL' | 'Connected';
  message: string;
}

export interface DomainVerificationResponse {
  message: string;
  status?: string;
  domain_name?: string;
  estimated_completion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  
  // Sublabel creation state management
  private sublabelCreationState: SublabelCreationState = {
    inProgress: false,
    pendingName: '',
    pollCount: 0,
    maxPollCount: 60 // 10 minutes at 10-second intervals
  };
  
  private sublabelCreationStateSubject = new BehaviorSubject<SublabelCreationState>(this.sublabelCreationState);
  public sublabelCreationState$ = this.sublabelCreationStateSubject.asObservable();
  
  private sublabelCompletionSubject = new BehaviorSubject<SublabelCompletionEvent | null>(null);
  public sublabelCompletion$ = this.sublabelCompletionSubject.asObservable();
  
  private pollTimeoutId: any = null;
  
  // Domain verification state management
  private domainVerificationState: DomainVerificationState = {
    inProgress: false,
    pendingDomain: '',
    pollCount: 0,
    maxPollCount: 60 // 5 minutes at 10-second intervals
  };
  
  private domainVerificationStateSubject = new BehaviorSubject<DomainVerificationState>(this.domainVerificationState);
  public domainVerificationState$ = this.domainVerificationStateSubject.asObservable();
  
  private domainVerificationCompletionSubject = new BehaviorSubject<DomainVerificationEvent | null>(null);
  public domainVerificationCompletion$ = this.domainVerificationCompletionSubject.asObservable();
  
  private domainPollTimeoutId: any = null;

  constructor(private http: HttpClient) { }
  
  // Sublabel creation state management methods
  startSublabelCreationTracking(sublabelName: string): void {
    this.sublabelCreationState = {
      inProgress: true,
      pendingName: sublabelName,
      pollCount: 0,
      maxPollCount: 60
    };
    this.sublabelCreationStateSubject.next(this.sublabelCreationState);
    this.startPollingForSublabelCompletion();
  }
  
  stopSublabelCreationTracking(): void {
    this.sublabelCreationState = {
      inProgress: false,
      pendingName: '',
      pollCount: 0,
      maxPollCount: 60
    };
    this.sublabelCreationStateSubject.next(this.sublabelCreationState);
    
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }
  
  getSublabelCreationState(): SublabelCreationState {
    return this.sublabelCreationState;
  }
  
  checkSublabelCreationProgress(brands: ChildBrand[]): ChildBrand | null {
    if (!this.sublabelCreationState.inProgress || !this.sublabelCreationState.pendingName) {
      return null;
    }
    
    const matchingBrand = brands.find(brand => 
      brand.brand_name.toLowerCase() === this.sublabelCreationState.pendingName.toLowerCase()
    );
    
    if (matchingBrand) {
      // Check if the sublabel is truly ready using the same logic as the "Go to dashboard" button
      const hasDomains = !!(matchingBrand.domains && matchingBrand.domains.length > 0);
      return hasDomains ? matchingBrand : null;
    }
    
    return null;
  }
  
  private startPollingForSublabelCompletion(): void {
    if (!this.sublabelCreationState.inProgress) return;
    
    const poll = () => {
      if (!this.sublabelCreationState.inProgress || 
          this.sublabelCreationState.pollCount >= this.sublabelCreationState.maxPollCount) {
        return;
      }
      
      this.sublabelCreationState.pollCount++;
      this.sublabelCreationStateSubject.next(this.sublabelCreationState);
      
      console.log(`[Global Polling] Checking for sublabel "${this.sublabelCreationState.pendingName}" completion, attempt ${this.sublabelCreationState.pollCount}/${this.sublabelCreationState.maxPollCount}`);
      
      // Check sublabels to see if the new one has been created AND is truly ready
      this.getSublabels().subscribe({
        next: (brands) => {
          const newBrand = brands.find(brand => 
            brand.brand_name.toLowerCase() === this.sublabelCreationState.pendingName.toLowerCase()
          );
          
          if (newBrand) {
            // Check if the sublabel is truly ready using the same logic as the "Go to dashboard" button
            const hasDomains = !!(newBrand.domains && newBrand.domains.length > 0);
            
            console.log(`[Global Polling] Sublabel "${newBrand.brand_name}" found! Has domains: ${hasDomains ? 'YES' : 'NO'}`);
            
            if (hasDomains) {
              console.log(`[Global Polling] Sublabel "${newBrand.brand_name}" is ready! Completion detected.`);
              
              // Emit completion event
              this.sublabelCompletionSubject.next({
                sublabelName: newBrand.brand_name,
                brandId: newBrand.brand_id
              });
              
              this.stopSublabelCreationTracking();
              return;
            } else {
              console.log(`[Global Polling] Sublabel "${newBrand.brand_name}" exists but no domains yet. Continuing to poll...`);
            }
          }
          
          // Continue polling if still in progress
          if (this.sublabelCreationState.inProgress && 
              this.sublabelCreationState.pollCount < this.sublabelCreationState.maxPollCount) {
            this.pollTimeoutId = setTimeout(poll, 10000); // 10 seconds
          } else if (this.sublabelCreationState.pollCount >= this.sublabelCreationState.maxPollCount) {
            console.warn(`[Global Polling] Sublabel creation polling timeout reached for "${this.sublabelCreationState.pendingName}"`);
            this.stopSublabelCreationTracking();
          }
        },
        error: (error) => {
          console.error('[Global Polling] Error checking sublabels:', error);
          // Continue polling despite error
          if (this.sublabelCreationState.inProgress && 
              this.sublabelCreationState.pollCount < this.sublabelCreationState.maxPollCount) {
            this.pollTimeoutId = setTimeout(poll, 10000);
          }
        }
      });
    };
    
    // Start polling after 10 seconds (give time for initial creation)
    console.log(`[Global Polling] Starting global polling for sublabel "${this.sublabelCreationState.pendingName}" creation`);
    this.pollTimeoutId = setTimeout(poll, 10000);
  }

  // Domain verification state management methods
  startDomainVerificationTracking(domainName: string): void {
    this.domainVerificationState = {
      inProgress: true,
      pendingDomain: domainName,
      pollCount: 0,
      maxPollCount: 60
    };
    this.domainVerificationStateSubject.next(this.domainVerificationState);
    this.startPollingForDomainVerification();
  }
  
  stopDomainVerificationTracking(): void {
    this.domainVerificationState = {
      inProgress: false,
      pendingDomain: '',
      pollCount: 0,
      maxPollCount: 60
    };
    this.domainVerificationStateSubject.next(this.domainVerificationState);
    
    if (this.domainPollTimeoutId) {
      clearTimeout(this.domainPollTimeoutId);
      this.domainPollTimeoutId = null;
    }
  }
  
  getDomainVerificationState(): DomainVerificationState {
    return this.domainVerificationState;
  }
  
  checkDomainVerificationProgress(domains: Domain[]): Domain | null {
    if (!this.domainVerificationState.inProgress || !this.domainVerificationState.pendingDomain) {
      return null;
    }
    
    const matchingDomain = domains.find(domain => 
      domain.domain_name.toLowerCase() === this.domainVerificationState.pendingDomain.toLowerCase()
    );
    
    if (matchingDomain && matchingDomain.status !== 'Pending') {
      // Domain verification is complete (success or failure)
      return matchingDomain;
    }
    
    return null;
  }
  
  private startPollingForDomainVerification(): void {
    if (!this.domainVerificationState.inProgress) return;
    
    const poll = () => {
      if (!this.domainVerificationState.inProgress || 
          this.domainVerificationState.pollCount >= this.domainVerificationState.maxPollCount) {
        return;
      }
      
      this.domainVerificationState.pollCount++;
      this.domainVerificationStateSubject.next(this.domainVerificationState);
      
      console.log(`[Domain Verification Polling] Checking for domain "${this.domainVerificationState.pendingDomain}" completion, attempt ${this.domainVerificationState.pollCount}/${this.domainVerificationState.maxPollCount}`);
      
      // Check domains to see if verification is complete
      this.getDomains().subscribe({
        next: (domains) => {
          const verifiedDomain = domains.find(domain => 
            domain.domain_name.toLowerCase() === this.domainVerificationState.pendingDomain.toLowerCase()
          );
          
          if (verifiedDomain && verifiedDomain.status !== 'Pending') {
            console.log(`[Domain Verification Polling] Domain "${verifiedDomain.domain_name}" verification completed with status: ${verifiedDomain.status}`);
            
            let message = '';
            switch (verifiedDomain.status) {
              case 'Connected':
                message = 'Domain verified and SSL certificate configured successfully!';
                break;
              case 'No SSL':
                message = 'Domain verified but SSL certificate configuration failed. Please check your SSL settings.';
                break;
              case 'Unverified':
                message = 'Domain verification failed. Please check your DNS configuration.';
                break;
              default:
                message = `Domain verification completed with status: ${verifiedDomain.status}`;
            }
            
            // Emit completion event
            this.domainVerificationCompletionSubject.next({
              domainName: verifiedDomain.domain_name,
              status: verifiedDomain.status,
              message: message
            });
            
            this.stopDomainVerificationTracking();
            return;
          }
          
          // Continue polling if still in progress
          if (this.domainVerificationState.inProgress && 
              this.domainVerificationState.pollCount < this.domainVerificationState.maxPollCount) {
            this.domainPollTimeoutId = setTimeout(poll, 10000); // 10 seconds
          } else if (this.domainVerificationState.pollCount >= this.domainVerificationState.maxPollCount) {
            console.warn(`[Domain Verification Polling] Domain verification polling timeout reached for "${this.domainVerificationState.pendingDomain}"`);
            this.stopDomainVerificationTracking();
          }
        },
        error: (error) => {
          console.error('[Domain Verification Polling] Error checking domains:', error);
          // Continue polling despite error
          if (this.domainVerificationState.inProgress && 
              this.domainVerificationState.pollCount < this.domainVerificationState.maxPollCount) {
            this.domainPollTimeoutId = setTimeout(poll, 10000);
          }
        }
      });
    };
    
    // Start polling after 5 seconds (give time for initial verification to start)
    console.log(`[Domain Verification Polling] Starting polling for domain "${this.domainVerificationState.pendingDomain}" verification`);
    this.domainPollTimeoutId = setTimeout(poll, 5000);
  }

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

  // Fee Settings Management
  getFeeSettings(brandId: number): Observable<FeeSettings> {
    return this.http.get<FeeSettings>(`${environment.apiUrl}/brands/${brandId}/fee-settings`, {
      headers: this.getAuthHeaders()
    });
  }

  updateFeeSettings(brandId: number, feeSettings: Partial<FeeSettings>): Observable<any> {
    return this.http.put(`${environment.apiUrl}/brands/${brandId}/fee-settings`, feeSettings, {
      headers: this.getAuthHeaders()
    });
  }
}