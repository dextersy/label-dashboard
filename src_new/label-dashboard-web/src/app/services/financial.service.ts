import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FinancialSummary, Earning, Royalty, Payment, PaymentMethod, PayoutSettings } from '../pages/financial/financial.component';

@Injectable({
  providedIn: 'root'
})
export class FinancialService {

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  async getFinancialSummary(artistId: number): Promise<FinancialSummary> {
    const response = await this.http.get<any>(`${environment.apiUrl}/financial/summary/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return {
      currentBalance: response.current_balance,
      totalEarnings: response.total_earnings,
      totalRoyalties: response.total_royalties,
      totalPayments: response.total_payments
    };
  }

  async getEarnings(artistId: number): Promise<Earning[]> {
    const response = await this.http.get<{earnings: any[]}>(`${environment.apiUrl}/financial/earnings/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.earnings || [];
  }

  async getRoyalties(artistId: number): Promise<Royalty[]> {
    const response = await this.http.get<{royalties: any[]}>(`${environment.apiUrl}/financial/royalties/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.royalties || [];
  }

  async getPayments(artistId: number): Promise<Payment[]> {
    const response = await this.http.get<{payments: any[]}>(`${environment.apiUrl}/financial/payments/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.payments || [];
  }

  async getPaymentMethods(artistId: number): Promise<PaymentMethod[]> {
    const response = await this.http.get<{paymentMethods: any[]}>(`${environment.apiUrl}/financial/payment-methods/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.paymentMethods || [];
  }

  async getPayoutSettings(artistId: number): Promise<PayoutSettings> {
    const response = await this.http.get<any>(`${environment.apiUrl}/financial/payout-settings/${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return {
      payout_point: response.payout_point,
      hold_payouts: response.hold_payouts
    };
  }

  async createRoyalty(artistId: number, royaltyData: any): Promise<void> {
    await this.http.post(`${environment.apiUrl}/financial/royalties`, {
      artist_id: artistId,
      ...royaltyData
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async createPayment(artistId: number, paymentData: any): Promise<void> {
    await this.http.post(`${environment.apiUrl}/financial/payments`, {
      artist_id: artistId,
      ...paymentData
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async createEarning(artistId: number, earningData: any): Promise<void> {
    await this.http.post(`${environment.apiUrl}/financial/earnings`, {
      artist_id: artistId,
      ...earningData
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async addPaymentMethod(artistId: number, paymentMethodData: any): Promise<void> {
    await this.http.post(`${environment.apiUrl}/financial/payment-methods`, {
      artist_id: artistId,
      ...paymentMethodData
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async updatePayoutSettings(artistId: number, payoutSettings: PayoutSettings): Promise<void> {
    await this.http.put(`${environment.apiUrl}/financial/payout-settings/${artistId}`, payoutSettings, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }
}
