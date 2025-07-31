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

  async getEarnings(artistId: number, page: number = 1, limit: number = 20, filters: any = {}, sortBy?: string, sortDirection?: string, startDate?: string, endDate?: string): Promise<{earnings: Earning[], pagination: any}> {
    let queryParams = `page=${page}&limit=${limit}`;
    
    // Add date range parameters
    if (startDate && endDate) {
      queryParams += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
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

    const response = await this.http.get<{earnings: any[], pagination: any}>(`${environment.apiUrl}/financial/artists/${artistId}/earnings?${queryParams}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const earnings = response?.earnings || [];
    return {
      earnings: earnings.map(earning => ({
        id: earning.id,
        date_recorded: earning.date_recorded,
        release_title: earning.release?.title || '(No release)',
        description: earning.description || earning.type || 'Earning',
        amount: earning.amount
      })),
      pagination: response?.pagination || {}
    };
  }

  async getRoyalties(artistId: number, page: number = 1, limit: number = 20, filters: any = {}, sortBy?: string, sortDirection?: string, startDate?: string, endDate?: string): Promise<{royalties: Royalty[], pagination: any}> {
    let queryParams = `artist_id=${artistId}&page=${page}&limit=${limit}`;
    
    // Add date range parameters
    if (startDate && endDate) {
      queryParams += `&start_date=${startDate}&end_date=${endDate}`;
    }
    
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

    const response = await this.http.get<{royalties: any[], pagination: any}>(`${environment.apiUrl}/financial/royalties?${queryParams}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const royalties = response?.royalties || [];
    return {
      royalties: royalties.map(royalty => ({
        id: royalty.id,
        date_recorded: royalty.date_recorded,
        release_title: royalty.release?.title || '(No release)',
        description: royalty.description || 'Royalty',
        amount: royalty.amount
      })),
      pagination: response?.pagination || {}
    };
  }

  async getPayments(artistId: number, page: number = 1, limit: number = 10, filters: any = {}, sortBy?: string, sortDirection?: string): Promise<{payments: Payment[], pagination: any}> {
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
    
    const response = await this.http.get<{payments: any[], pagination: any}>(`${environment.apiUrl}/financial/artists/${artistId}/payments?${queryParams}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    const payments = response?.payments || [];
    return {
      payments: payments.map(payment => ({
        id: payment.id,
        date_paid: payment.date_paid,
        description: payment.description || 'Payment',
        paid_thru_type: payment.paid_thru_type || '',
        paid_thru_account_name: payment.paid_thru_account_name || '',
        paid_thru_account_number: payment.paid_thru_account_number || '',
        amount: payment.amount,
        payment_processing_fee: payment.payment_processing_fee || 0,
        payment_method_id: payment.payment_method_id,
        paymentMethod: payment.paymentMethod ? {
          id: payment.paymentMethod.id,
          type: payment.paymentMethod.type,
          account_name: payment.paymentMethod.account_name,
          account_number_or_email: payment.paymentMethod.account_number_or_email
        } : undefined
      })),
      pagination: response?.pagination || {}
    };
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

  async deletePaymentMethod(artistId: number, paymentMethodId: number): Promise<void> {
    await this.http.delete(`${environment.apiUrl}/artists/${artistId}/payment-methods/${paymentMethodId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async setDefaultPaymentMethod(artistId: number, paymentMethodId: number): Promise<void> {
    await this.http.put(`${environment.apiUrl}/artists/${artistId}/payment-methods/${paymentMethodId}/set-default`, {}, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async getDocuments(artistId: number): Promise<any[]> {
    const response = await this.http.get<{documents: any[]}>(`${environment.apiUrl}/artists/${artistId}/documents`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.documents || [];
  }

  async uploadDocument(artistId: number, file: File, title: string): Promise<any> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    });

    const response = await this.http.post<any>(`${environment.apiUrl}/artists/${artistId}/documents`, formData, {
      headers: headers
    }).toPromise();

    return response;
  }

  async deleteDocument(artistId: number, documentId: number): Promise<void> {
    await this.http.delete(`${environment.apiUrl}/artists/${artistId}/documents/${documentId}`, {
      headers: this.getAuthHeaders()
    }).toPromise();
  }

  async getReleaseInformation(artistId: number): Promise<any> {
    const response = await this.http.get<any>(`${environment.apiUrl}/artists/${artistId}/releases`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response;
  }

  async updateRoyalties(artistId: number, releases: any[]): Promise<any> {
    const response = await this.http.put<any>(`${environment.apiUrl}/artists/${artistId}/royalties`, {
      releases
    }, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response;
  }

  async addRecuperableExpense(releaseId: number, expenseData: any): Promise<any> {
    const response = await this.http.post<any>(`${environment.apiUrl}/releases/${releaseId}/expenses`, expenseData, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response;
  }

  async getWalletBalance(): Promise<number> {
    const response = await this.http.get<{balance: number}>(`${environment.apiUrl}/financial/wallet/balance`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return response?.balance || 0;
  }

  async getReleaseExpenses(releaseId: number, page: number = 1, limit: number = 10): Promise<{expenses: any[], pagination: any}> {
    const response = await this.http.get<{expenses: any[], pagination: any}>(`${environment.apiUrl}/releases/${releaseId}/expenses?page=${page}&limit=${limit}`, {
      headers: this.getAuthHeaders()
    }).toPromise();

    return {
      expenses: response?.expenses || [],
      pagination: response?.pagination || {}
    };
  }
}
