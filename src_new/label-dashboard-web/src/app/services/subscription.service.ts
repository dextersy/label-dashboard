import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Plan {
  id: number;
  name: string;
  price_monthly: number;
  price_annual: number;
  limit_artists: number | null;
  limit_releases_per_artist: number | null;
  limit_press_campaigns_per_month: number | null;
  limit_sync_pitches_per_month: number | null;
  limit_storage_gb: number | null;
  limit_admin_users: number | null;
  default_event_transaction_fixed_fee: number;
  default_event_revenue_percentage_fee: number;
  default_event_fee_revenue_type: 'net' | 'gross';
  default_fundraiser_transaction_fixed_fee: number;
  default_fundraiser_revenue_percentage_fee: number;
  default_fundraiser_fee_revenue_type: 'net' | 'gross';
  feature_music_workspace: boolean;
  feature_campaigns_workspace: boolean;
  feature_sublabels: boolean;
  feature_artist_profiles: boolean;
  feature_music_releases: boolean;
  feature_press_campaigns: boolean;
  feature_sync_licensing: boolean;
  feature_events: boolean;
  feature_fundraisers: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface AdminPlan extends Plan {
  default_music_transaction_fixed_fee: number;
  default_music_revenue_percentage_fee: number;
  default_music_fee_revenue_type: 'net' | 'gross';
  is_active: boolean;
  is_default_free: boolean;
}

export type PlanInput = Partial<Omit<AdminPlan, 'id'>>;

export type InvoiceStatus = 'open' | 'paid' | 'void' | 'uncollectible';
export type BillingReason = 'subscription_create' | 'subscription_cycle' | 'subscription_update';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface SubscriptionInvoice {
  id: number;
  brand_id: number;
  plan_id: number;
  plan?: { id: number; name: string };
  billing_cycle: 'monthly' | 'annual';
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  billing_reason: BillingReason;
  period_start: string;
  period_end: string | null;
  paypal_subscription_id: string | null;
  paid_at: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: number;
  brand_id: number;
  invoice_id: number;
  invoice?: SubscriptionInvoice;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  paypal_transaction_id: string | null;
  paypal_subscription_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicesResponse {
  invoices: SubscriptionInvoice[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PaymentsResponse {
  payments: SubscriptionPayment[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EffectiveLimits {
  limit_artists: number | null;
  limit_releases_per_artist: number | null;
  limit_press_campaigns_per_month: number | null;
  limit_sync_pitches_per_month: number | null;
  limit_storage_gb: number | null;
  limit_admin_users: number | null;
}

export interface CurrentSubscription {
  plan_id: number;
  billing_cycle: 'monthly' | 'annual';
  status: 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'cancelled';
  started_at: string;
  ends_at: string | null;
  pending_plan_id: number | null;
  pending_billing_cycle: 'monthly' | 'annual' | null;
  effective_limits: EffectiveLimits;
}

export interface PlansResponse {
  plans: Plan[];
  currentSubscription: CurrentSubscription | null;
}

export interface BillingDetails {
  billing_company_name: string | null;
  billing_address: string | null;
  billing_tin: string | null;
}

export interface UsageResponse {
  limits: EffectiveLimits | null;
  usage: {
    artists: number;
    admin_users: number;
    releases_per_artist: Record<number, number>;
    press_campaigns_this_month: number;
    sync_pitches_this_month: number;
    storage_used_bytes: number;
  };
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly apiUrl = `${environment.apiUrl}/subscription`;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlansResponse> {
    return this.http.get<PlansResponse>(`${this.apiUrl}/plans`);
  }

  getUsage(): Observable<UsageResponse> {
    return this.http.get<UsageResponse>(`${this.apiUrl}/usage`);
  }

  initiateCheckout(planId: number, billingCycle: 'monthly' | 'annual'): Observable<{ checkout_url?: string; immediate?: boolean; downgrade_scheduled?: boolean; effective_at?: string | null }> {
    return this.http.post<{ checkout_url?: string; immediate?: boolean; downgrade_scheduled?: boolean; effective_at?: string | null }>(`${this.apiUrl}/checkout`, {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
  }

  cancelSubscription(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/cancel`, {});
  }

  cancelPendingChange(): Observable<{ checkout_url: string }> {
    return this.http.post<{ checkout_url: string }>(`${this.apiUrl}/cancel-pending-change`, {});
  }

  devOverridePlan(planId: number, billingCycle: 'monthly' | 'annual'): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/dev-override`, {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
  }

  getInvoices(page = 1): Observable<InvoicesResponse> {
    return this.http.get<InvoicesResponse>(`${this.apiUrl}/invoices`, { params: { page: String(page) } });
  }

  downloadInvoicePdf(invoiceId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  }

  getPayments(page = 1): Observable<PaymentsResponse> {
    return this.http.get<PaymentsResponse>(`${this.apiUrl}/payments`, { params: { page: String(page) } });
  }

  getBillingDetails(): Observable<BillingDetails> {
    return this.http.get<BillingDetails>(`${this.apiUrl}/billing-details`);
  }

  updateBillingDetails(data: Partial<BillingDetails>): Observable<BillingDetails> {
    return this.http.put<BillingDetails>(`${this.apiUrl}/billing-details`, data);
  }

  getAdminPlans(): Observable<{ plans: AdminPlan[] }> {
    return this.http.get<{ plans: AdminPlan[] }>(`${this.apiUrl}/admin/plans`);
  }

  createAdminPlan(data: PlanInput): Observable<{ plan: AdminPlan }> {
    return this.http.post<{ plan: AdminPlan }>(`${this.apiUrl}/admin/plans`, data);
  }

  updateAdminPlan(id: number, data: PlanInput): Observable<{ plan: AdminPlan }> {
    return this.http.put<{ plan: AdminPlan }>(`${this.apiUrl}/admin/plans/${id}`, data);
  }
}
