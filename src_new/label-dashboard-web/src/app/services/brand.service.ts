import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface BrandSettings {
  id: string | null;
  name: string;
  logo: string;
  color: string;
  favicon: string;
  website: string;
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
        next: (brandSettings) => {
          localStorage.setItem('brand_settings', JSON.stringify(brandSettings));
          this.brandSettingsSubject.next(brandSettings);
          observer.next(brandSettings);
          observer.complete();
        },
        error: (error) => {
          console.error('Error loading brand settings:', error);
          const defaultSettings: BrandSettings = {
            id: null,
            name: 'Label Dashboard',
            logo: 'assets/img/default-logo.png',
            color: '#667eea',
            favicon: 'assets/img/default.ico',
            website: currentDomain
          };
          this.brandSettingsSubject.next(defaultSettings);
          observer.next(defaultSettings);
          observer.complete();
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
