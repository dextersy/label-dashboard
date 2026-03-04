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

  static setCssVars(brandColor: string): void {
    document.documentElement.style.setProperty('--brand-color', brandColor);
    const hex = brandColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    document.documentElement.style.setProperty('--brand-color-text', luminance > 0.5 ? '#1a1a1a' : '#ffffff');

    // Precomputed tints (brand color blended with white) for gradient usage
    document.documentElement.style.setProperty('--brand-color-rgb', `${r}, ${g}, ${b}`);
    const tint = (c: number, a: number) => Math.round(c * a + 255 * (1 - a));
    const hex6 = (rv: number, gv: number, bv: number) =>
      `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
    document.documentElement.style.setProperty('--brand-color-tint-8',  hex6(tint(r, 0.08), tint(g, 0.08), tint(b, 0.08)));
    document.documentElement.style.setProperty('--brand-color-tint-14', hex6(tint(r, 0.14), tint(g, 0.14), tint(b, 0.14)));
    document.documentElement.style.setProperty('--brand-color-tint-20', hex6(tint(r, 0.20), tint(g, 0.20), tint(b, 0.20)));
    document.documentElement.style.setProperty('--brand-color-tint-22', hex6(tint(r, 0.22), tint(g, 0.22), tint(b, 0.22)));
    document.documentElement.style.setProperty('--brand-color-tint-30', hex6(tint(r, 0.30), tint(g, 0.30), tint(b, 0.30)));
    document.documentElement.style.setProperty('--brand-color-tint-38', hex6(tint(r, 0.38), tint(g, 0.38), tint(b, 0.38)));
  }

  getCurrentBrandSettings(): BrandSettings | null {
    return this.brandSettingsSubject.value;
  }

  clearBrandSettings(): void {
    localStorage.removeItem('brand_settings');
    this.brandSettingsSubject.next(null);
  }

  refreshBrandSettings(): Observable<BrandSettings> {
    // Refresh brand settings from the server and update all subscribers
    return this.loadBrandByDomain();
  }

  updateBrandSettings(updatedSettings: BrandSettings): void {
    // Update local state and localStorage with new settings
    localStorage.setItem('brand_settings', JSON.stringify(updatedSettings));
    this.brandSettingsSubject.next(updatedSettings);
  }
}
