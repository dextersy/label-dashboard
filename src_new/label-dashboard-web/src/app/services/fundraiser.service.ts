import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';

export interface Fundraiser {
  id: number;
  brand_id: number;
  title: string;
  description?: string;
  poster_url?: string;
  status: 'draft' | 'published' | 'closed';
  totalRaised?: number;
  donationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFundraiserForm {
  title: string;
  description?: string;
  poster_file?: File;
  status?: 'draft' | 'published' | 'closed';
}

export interface Donation {
  id: number;
  fundraiser_id: number;
  name: string;
  email: string;
  contact_number?: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  processing_fee?: number;
  platform_fee?: number;
  payment_reference?: string;
  anonymous: boolean;
  order_timestamp?: string;
  date_paid?: string;
  createdAt?: string;
  fundraiser?: {
    id: number;
    title: string;
  };
}

export interface DonationSummary {
  totalDonations: number;
  totalRaised: number;
  totalProcessingFees: number;
  totalPlatformFees?: number;
  netAmount: number;
}

export interface DonationPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class FundraiserService {
  private selectedFundraiserSubject = new BehaviorSubject<Fundraiser | null>(null);
  public selectedFundraiser$ = this.selectedFundraiserSubject.asObservable();
  private dataRefreshSubject = new BehaviorSubject<void>(undefined);
  public dataRefresh$ = this.dataRefreshSubject.asObservable();
  private readonly SELECTED_FUNDRAISER_KEY = 'melt_selected_fundraiser';

  constructor(private http: HttpClient) {
    // Load previously selected fundraiser from localStorage on service init
    this.loadSelectedFundraiserFromStorage();
  }

  /**
   * Load previously selected fundraiser from localStorage
   */
  private loadSelectedFundraiserFromStorage(): void {
    try {
      const storedFundraiser = localStorage.getItem(this.SELECTED_FUNDRAISER_KEY);
      if (storedFundraiser) {
        const fundraiser = JSON.parse(storedFundraiser);
        this.selectedFundraiserSubject.next(fundraiser);
      }
    } catch (error) {
      console.warn('Failed to load selected fundraiser from storage:', error);
      localStorage.removeItem(this.SELECTED_FUNDRAISER_KEY);
    }
  }

  /**
   * Save selected fundraiser to localStorage
   */
  private saveSelectedFundraiserToStorage(fundraiser: Fundraiser | null): void {
    try {
      if (fundraiser) {
        localStorage.setItem(this.SELECTED_FUNDRAISER_KEY, JSON.stringify(fundraiser));
      } else {
        localStorage.removeItem(this.SELECTED_FUNDRAISER_KEY);
      }
    } catch (error) {
      console.warn('Failed to save selected fundraiser to storage:', error);
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getAuthHeadersForFormData(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData - let browser set it with boundary
    });
  }

  /**
   * Get all fundraisers for the current user's brand
   */
  getFundraisers(): Observable<Fundraiser[]> {
    return this.http.get<{ fundraisers: Fundraiser[] }>(`${environment.apiUrl}/fundraisers`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraisers),
      catchError(this.handleError)
    );
  }

  /**
   * Get a specific fundraiser by ID
   */
  getFundraiser(fundraiserId: number): Observable<Fundraiser> {
    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return throwError(() => new Error('Invalid fundraiser ID provided'));
    }

    return this.http.get<{ fundraiser: Fundraiser }>(`${environment.apiUrl}/fundraisers/${fundraiserId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Set the currently selected fundraiser
   */
  setSelectedFundraiser(fundraiser: Fundraiser | null): void {
    this.selectedFundraiserSubject.next(fundraiser);
    this.saveSelectedFundraiserToStorage(fundraiser);
  }

  /**
   * Get the currently selected fundraiser
   */
  getSelectedFundraiser(): Fundraiser | null {
    return this.selectedFundraiserSubject.value;
  }

  /**
   * Create a new fundraiser
   */
  createFundraiser(data: CreateFundraiserForm): Observable<Fundraiser> {
    const formData = new FormData();
    formData.append('title', data.title);
    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.status) {
      formData.append('status', data.status);
    }
    if (data.poster_file) {
      formData.append('poster', data.poster_file);
    }

    return this.http.post<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers`, formData, {
      headers: this.getAuthHeadersForFormData()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing fundraiser
   */
  updateFundraiser(fundraiserId: number, data: Partial<CreateFundraiserForm> & { poster_url?: string }): Observable<Fundraiser> {
    const formData = new FormData();
    if (data.title !== undefined) {
      formData.append('title', data.title);
    }
    if (data.description !== undefined) {
      formData.append('description', data.description);
    }
    if (data.status !== undefined) {
      formData.append('status', data.status);
    }
    if (data.poster_url !== undefined) {
      formData.append('poster_url', data.poster_url);
    }
    if (data.poster_file) {
      formData.append('poster', data.poster_file);
    }

    return this.http.put<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers/${fundraiserId}`, formData, {
      headers: this.getAuthHeadersForFormData()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Publish a fundraiser
   */
  publishFundraiser(fundraiserId: number): Observable<Fundraiser> {
    return this.http.post<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers/${fundraiserId}/publish`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Unpublish a fundraiser
   */
  unpublishFundraiser(fundraiserId: number): Observable<Fundraiser> {
    return this.http.post<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers/${fundraiserId}/unpublish`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Close a fundraiser
   */
  closeFundraiser(fundraiserId: number): Observable<Fundraiser> {
    return this.http.post<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers/${fundraiserId}/close`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Reopen a closed fundraiser
   */
  reopenFundraiser(fundraiserId: number): Observable<Fundraiser> {
    return this.http.post<{ fundraiser: Fundraiser; message: string }>(`${environment.apiUrl}/fundraisers/${fundraiserId}/reopen`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.fundraiser),
      catchError(this.handleError)
    );
  }

  /**
   * Get donations for a fundraiser with pagination and filtering
   */
  getDonations(params?: {
    fundraiser_id?: number;
    page?: number;
    limit?: number;
    status_filter?: string;
    search?: string;
    sort_field?: string;
    sort_order?: string;
    start_date?: string;
    end_date?: string;
    filters?: { [key: string]: string };
  }): Observable<{ donations: Donation[]; pagination: DonationPagination; summary: DonationSummary }> {
    let queryParams = new URLSearchParams();

    if (params?.fundraiser_id) {
      queryParams.set('fundraiser_id', params.fundraiser_id.toString());
    }
    if (params?.page) {
      queryParams.set('page', params.page.toString());
    }
    if (params?.limit) {
      queryParams.set('limit', params.limit.toString());
    }
    if (params?.status_filter) {
      queryParams.set('status_filter', params.status_filter);
    }
    if (params?.search) {
      queryParams.set('search', params.search);
    }
    if (params?.sort_field) {
      queryParams.set('sort_field', params.sort_field);
    }
    if (params?.sort_order) {
      queryParams.set('sort_order', params.sort_order);
    }
    if (params?.start_date) {
      queryParams.set('start_date', params.start_date);
    }
    if (params?.end_date) {
      queryParams.set('end_date', params.end_date);
    }
    // Handle search filters from PaginatedTableComponent
    if (params?.filters) {
      Object.keys(params.filters).forEach(key => {
        const value = params.filters![key];
        if (value && value.trim()) {
          // Map specific filter fields to search parameter
          if (key === 'name' || key === 'email') {
            // Append to search
            const currentSearch = queryParams.get('search') || '';
            queryParams.set('search', (currentSearch ? currentSearch + ' ' : '') + value);
          }
        }
      });
    }

    const queryString = queryParams.toString();
    const url = `${environment.apiUrl}/fundraisers/donations${queryString ? '?' + queryString : ''}`;

    return this.http.get<{ donations: Donation[]; pagination: DonationPagination; summary: DonationSummary }>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get donation summary
   */
  getDonationSummary(fundraiserId?: number): Observable<DonationSummary> {
    let url = `${environment.apiUrl}/fundraisers/donations/summary`;
    if (fundraiserId) {
      url += `?fundraiser_id=${fundraiserId}`;
    }

    return this.http.get<{ summary: DonationSummary }>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.summary),
      catchError(this.handleError)
    );
  }

  /**
   * Trigger a data refresh for all listening components
   */
  triggerDataRefresh(): void {
    this.dataRefreshSubject.next();
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    console.error('FundraiserService Error:', error);
    let errorMessage = 'An error occurred';
    if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => new Error(errorMessage));
  }
}
