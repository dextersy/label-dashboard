import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LabelFinanceDashboard {
  net_music_earnings: number;
  net_event_earnings: number;
  total_payments: number;
  receivable_balance: number;
  breakdown: {
    music: {
      gross_earnings: number;
      royalties: number;
      platform_fees: number;
      net_earnings: number;
    };
    event: {
      sales: number;
      platform_fees: number;
      processing_fees: number;
      net_earnings: number;
    };
    artist_payments: number;
  };
}

export interface LabelFinanceBreakdown {
  type: 'music' | 'event';
  breakdown: Array<{
    release_title?: string;
    event_name?: string;
    gross_earnings?: number;
    sales?: number;
    royalties?: number;
    platform_fees: number;
    processing_fees?: number;
    net_earnings: number;
  }>;
}

export interface LabelPaymentMethod {
  id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  bank_code: string;
  is_default_for_brand: boolean;
}

export interface LabelPayment {
  id: number;
  description?: string;
  amount: number;
  date_paid: string;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
  payment_method_id?: number;
  reference_number?: string;
  payment_processing_fee?: number;
  paymentMethod?: LabelPaymentMethod;
}

export interface LabelPaymentsResponse {
  payments: LabelPayment[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LabelFinanceService {
  private apiUrl = `${environment.apiUrl}/brands`;

  constructor(private http: HttpClient) { }

  getDashboard(brandId: number, startDate?: string, endDate?: string): Observable<LabelFinanceDashboard> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);

    return this.http.get<LabelFinanceDashboard>(`${this.apiUrl}/${brandId}/finance/dashboard`, { params });
  }

  getBreakdown(brandId: number, type: 'music' | 'event', startDate?: string, endDate?: string): Observable<LabelFinanceBreakdown> {
    let params = new HttpParams().set('type', type);
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);

    return this.http.get<LabelFinanceBreakdown>(`${this.apiUrl}/${brandId}/finance/breakdown`, { params });
  }

  getPayments(
    brandId: number,
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc',
    startDate?: string,
    endDate?: string,
    description?: string
  ): Observable<LabelPaymentsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (sortBy) params = params.set('sortBy', sortBy);
    if (sortDirection) params = params.set('sortDirection', sortDirection);
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    if (description) params = params.set('description', description);

    return this.http.get<LabelPaymentsResponse>(`${this.apiUrl}/${brandId}/payments`, { params });
  }
}