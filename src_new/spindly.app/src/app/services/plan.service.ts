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
  feature_music_workspace: boolean;
  feature_campaigns_workspace: boolean;
  feature_sublabels: boolean;
  feature_artist_profiles: boolean;
  feature_music_releases: boolean;
  feature_press_campaigns: boolean;
  feature_sync_licensing: boolean;
  feature_events: boolean;
  feature_fundraisers: boolean;
  is_default_free: boolean;
  sort_order: number;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  constructor(private http: HttpClient) {}

  getPublicPlans(): Observable<{ plans: Plan[] }> {
    return this.http.get<{ plans: Plan[] }>(`${environment.apiUrl}/subscription/plans/public`);
  }
}
