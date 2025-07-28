import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface BrandSettings {
  id: number | null;
  name: string;
  logo_url?: string;
  brand_color: string;
  brand_website?: string;
  favicon_url?: string;
  domain?: string;
  release_submission_url?: string;
  catalog_prefix?: string;
}

export interface BrandApiResponse {
  domain: string;
  brand: {
    id: number;
    name: string;
    logo_url?: string;
    brand_color: string;
    brand_website?: string;
    favicon_url?: string;
    release_submission_url?: string;
    catalog_prefix?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private brandSettingsSubject = new BehaviorSubject<BrandSettings | null>(null);
  public brandSettings$ = this.brandSettingsSubject.asObservable();

  constructor(private apiService: ApiService) {
    this.loadBrandSettingsFromStorage();
  }

  private loadBrandSettingsFromStorage(): void {
    const stored = localStorage.getItem('brand_settings');
    if (stored) {
      try {
        const brandSettings = JSON.parse(stored);
        this.brandSettingsSubject.next(brandSettings);
      } catch (error) {
        console.error('Error parsing stored brand settings:', error);
      }
    }
  }

  loadBrandByDomain(domain?: string): Observable<BrandSettings> {
    const currentDomain = domain || window.location.hostname;
    
    return new Observable(observer => {
      this.apiService.getBrandByDomain(currentDomain).subscribe({
        next: (response: BrandApiResponse) => {
          const brandSettings: BrandSettings = {
            id: response.brand.id,
            name: response.brand.name,
            logo_url: response.brand.logo_url,
            brand_color: response.brand.brand_color,
            brand_website: response.brand.brand_website,
            favicon_url: response.brand.favicon_url,
            domain: response.domain,
            release_submission_url: response.brand.release_submission_url,
            catalog_prefix: response.brand.catalog_prefix
          };
          localStorage.setItem('brand_settings', JSON.stringify(brandSettings));
          this.brandSettingsSubject.next(brandSettings);
          observer.next(brandSettings);
          observer.complete();
        },
        error: (error) => {
          console.error('Error loading brand settings:', error);
          observer.error(error);
        }
      });
    });
  }

  getCurrentBrandSettings(): BrandSettings | null {
    return this.brandSettingsSubject.value;
  }

  clearBrandSettings(): void {
    localStorage.removeItem('brand_settings');
    this.brandSettingsSubject.next(null);
  }
}
