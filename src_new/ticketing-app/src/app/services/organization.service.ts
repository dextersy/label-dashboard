import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrgSettings {
  id: number;
  name: string;
  logo_url?: string;
  brand_color?: string;
  brand_website?: string;
}

export interface EventFeeSettings {
  transaction_fixed_fee: number;
  revenue_percentage_fee: number;
  fee_revenue_type: 'net' | 'gross';
}

export interface FeeSettings {
  event: EventFeeSettings;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private http: HttpClient) {}

  getSettings(brandId: number): Observable<OrgSettings> {
    return this.http.get<OrgSettings>(`${environment.apiUrl}/brands/${brandId}`);
  }

  updateSettings(brandId: number, data: { name: string; brand_color?: string; brand_website?: string | null }): Observable<{ brand: OrgSettings }> {
    return this.http.put<{ brand: OrgSettings }>(`${environment.apiUrl}/brands/${brandId}`, data);
  }

  getFeeSettings(brandId: number): Observable<FeeSettings> {
    return this.http.get<FeeSettings>(`${environment.apiUrl}/brands/${brandId}/fee-settings`);
  }

  uploadLogo(brandId: number, file: File): Observable<{ logo_url: string }> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<{ logo_url: string }>(`${environment.apiUrl}/brands/${brandId}/logo`, fd);
  }
}
