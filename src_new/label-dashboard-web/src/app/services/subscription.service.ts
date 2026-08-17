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
  effective_limits: EffectiveLimits;
}

export interface PlansResponse {
  plans: Plan[];
  currentSubscription: CurrentSubscription | null;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly apiUrl = `${environment.apiUrl}/subscription`;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlansResponse> {
    return this.http.get<PlansResponse>(`${this.apiUrl}/plans`);
  }

  initiateCheckout(planId: number, billingCycle: 'monthly' | 'annual'): Observable<{ checkout_url?: string; immediate?: boolean }> {
    return this.http.post<{ checkout_url?: string; immediate?: boolean }>(`${this.apiUrl}/checkout`, {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
  }

  cancelSubscription(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/cancel`, {});
  }

  devOverridePlan(planId: number, billingCycle: 'monthly' | 'annual'): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/dev-override`, {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
  }
}
