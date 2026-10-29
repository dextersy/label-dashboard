import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PayoutMethod {
  id: number;
  brand_id: number;
  type: string;
  account_name: string;
  account_number_or_email: string;
  is_default_for_brand: boolean;
  bank_code: string;
}

export interface Payout {
  id: number;
  amount: number;
  description?: string;
  date_paid: string;
  paid_thru_type?: string;
  paid_thru_account_name?: string;
  paid_thru_account_number?: string;
  payment_method_id?: number;
  reference_number?: string;
  payment_processing_fee?: number;
  status: string;
  paymentMethod?: PayoutMethod;
}

export interface BalanceSummary {
  net_event_earnings: number;
  total_payments: number;
  receivable_balance: number;
}

export interface PayoutSettings {
  payout_schedule: '1st_and_16th' | '1st_of_month' | 'every_friday' | null;
  payout_on_event_close: boolean;
  payout_threshold: number | null;
}

@Injectable({ providedIn: 'root' })
export class PayoutsService {
  constructor(private http: HttpClient) {}

  getBalance(brandId: number): Observable<BalanceSummary> {
    return this.http.get<BalanceSummary>(`${environment.apiUrl}/brands/${brandId}/finance/dashboard`);
  }

  getPayoutMethods(brandId: number): Observable<{ paymentMethods: PayoutMethod[] }> {
    return this.http.get<{ paymentMethods: PayoutMethod[] }>(`${environment.apiUrl}/brands/${brandId}/payment-methods`);
  }

  addPayoutMethod(brandId: number, data: {
    type: string;
    account_name: string;
    account_number_or_email: string;
    bank_code?: string;
    is_default_for_brand?: boolean;
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/brands/${brandId}/payment-methods`, data);
  }

  setDefaultPayoutMethod(brandId: number, id: number): Observable<any> {
    return this.http.put(`${environment.apiUrl}/brands/${brandId}/payment-methods/${id}/set-default`, {});
  }

  deletePayoutMethod(brandId: number, id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/brands/${brandId}/payment-methods/${id}`);
  }

  getPayoutHistory(brandId: number, page = 1, limit = 10): Observable<{ payments: Payout[]; pagination: any }> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<{ payments: Payout[]; pagination: any }>(`${environment.apiUrl}/brands/${brandId}/payments`, { params });
  }

  getSupportedBanks(): Observable<{ bank_code: string; bank_name: string }[]> {
    return this.http.get<{ bank_code: string; bank_name: string }[]>(`${environment.apiUrl}/brands/supported-banks`);
  }

  getPayoutSettings(brandId: number): Observable<PayoutSettings> {
    return this.http.get<PayoutSettings>(`${environment.apiUrl}/brands/${brandId}/payout-settings`);
  }

  updatePayoutSettings(brandId: number, settings: Partial<PayoutSettings>): Observable<PayoutSettings> {
    return this.http.put<PayoutSettings>(`${environment.apiUrl}/brands/${brandId}/payout-settings`, settings);
  }
}
