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
    const response = await this.http.get<any>(`${environment.apiUrl}/financial/summary?artist_id=${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const summary = response.summary;
    return {
      currentBalance: summary.current_balance,
      totalEarnings: summary.total_earnings,
      totalRoyalties: summary.total_royalties,
      totalPayments: summary.total_payments
    };
  }

  async getEarnings(artistId: number): Promise<Earning[]> {
    const response = await this.http.get<{earnings: any[]}>(`${environment.apiUrl}/financial/artists/${artistId}/earnings`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const earnings = response?.earnings || [];
    return earnings.map(earning => ({
      id: earning.id,
      date_recorded: earning.date_recorded,
      release_title: earning.release?.title || '(No release)',
      description: earning.description || earning.type || 'Earning',
      amount: earning.amount
    }));
  }

  async getRoyalties(artistId: number): Promise<Royalty[]> {
    const response = await this.http.get<{royalties: any[]}>(`${environment.apiUrl}/financial/royalties?artist_id=${artistId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const royalties = response?.royalties || [];
    return royalties.map(royalty => ({
      id: royalty.id,
      date_recorded: royalty.date_recorded,
      release_title: royalty.release?.title || '(No release)',
      description: royalty.description || 'Royalty',
      amount: royalty.amount
    }));
  }

  async getPayments(artistId: number): Promise<Payment[]> {
    const response = await this.http.get<{payments: any[]}>(`${environment.apiUrl}/financial/artists/${artistId}/payments`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const payments = response?.payments || [];
    return payments.map(payment => ({
      id: payment.id,
      date_paid: payment.date_paid,
      description: payment.description || 'Payment',
      paid_thru_type: payment.paid_thru_type || '',
      paid_thru_account_name: payment.paid_thru_account_name || '',
      paid_thru_account_number: payment.paid_thru_account_number || '',
      amount: payment.amount,
      payment_processing_fee: payment.payment_processing_fee || 0
    }));
  }

  async getPaymentMethods(artistId: number): Promise<PaymentMethod[]> {
    const response = await this.http.get<{paymentMethods: any[]}>(`${environment.apiUrl}/artists/${artistId}/payment-methods`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const paymentMethods = response?.paymentMethods || [];
    return paymentMethods.map(method => ({
      id: method.id,
      type: method.type,
      account_name: method.account_name,
      account_number_or_email: method.account_number_or_email,
      is_default_for_artist: method.is_default_for_artist
    }));
  }

  async getPayoutSettings(artistId: number): Promise<PayoutSettings> {
    const response = await this.http.get<any>(`${environment.apiUrl}/artists/${artistId}/payout-settings`, {
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
    await this.http.post(`${environment.apiUrl}/artists/${artistId}/payment-methods`, {
      ...paymentMethodData
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async updatePayoutSettings(artistId: number, payoutSettings: PayoutSettings): Promise<void> {
    await this.http.put(`${environment.apiUrl}/artists/${artistId}/payout-settings`, payoutSettings, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }
}
