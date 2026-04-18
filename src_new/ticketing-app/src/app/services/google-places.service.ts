import { Injectable, NgZone } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GooglePlacesPrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  formatted_phone_number?: string;
  website?: string;
  url?: string;
}

export interface VenueSelection {
  venue: string;
  google_place_id?: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
}

declare const google: any;

@Injectable({ providedIn: 'root' })
export class GooglePlacesService {
  private autocompleteService: any = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private ngZone: NgZone) {
    if (environment.googleMapsApiKey) {
      this.loadPromise = this.loadGoogleMapsAPI();
    }
  }

  private loadGoogleMapsAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google?.maps?.places) {
        this.autocompleteService = new google.maps.places.AutocompleteService();
        this.isLoaded = true;
        resolve();
        return;
      }

      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        existing.addEventListener('load', () => { this.initServices(); resolve(); });
        existing.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => { this.initServices(); resolve(); };
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }

  private initServices(): void {
    if (typeof google !== 'undefined' && google?.maps?.places) {
      this.autocompleteService = new google.maps.places.AutocompleteService();
      this.isLoaded = true;
    }
  }

  getPlacePredictions(input: string): Observable<GooglePlacesPrediction[]> {
    return new Observable(observer => {
      if (!environment.googleMapsApiKey) {
        observer.next([]);
        observer.complete();
        return;
      }

      const doSearch = () => {
        if (!this.autocompleteService) {
          observer.next([]);
          observer.complete();
          return;
        }
        this.autocompleteService.getPlacePredictions(
          { input, types: ['establishment'] },
          (predictions: any[] | null, status: string) => {
            this.ngZone.run(() => {
              if (status === 'OK' && predictions) {
                observer.next(predictions.map(p => ({
                  place_id: p.place_id || '',
                  description: p.description || '',
                  structured_formatting: {
                    main_text: p.structured_formatting?.main_text || '',
                    secondary_text: p.structured_formatting?.secondary_text || ''
                  }
                })));
              } else {
                observer.next([]);
              }
              observer.complete();
            });
          }
        );
      };

      if (this.isLoaded) {
        doSearch();
      } else if (this.loadPromise) {
        this.loadPromise.then(doSearch).catch(() => { observer.next([]); observer.complete(); });
      } else {
        observer.next([]);
        observer.complete();
      }
    });
  }

  getPlaceDetails(placeId: string): Observable<VenueSelection> {
    return new Observable(observer => {
      const doFetch = () => {
        const div = document.createElement('div');
        const svc = new google.maps.places.PlacesService(div);
        svc.getDetails(
          { placeId, fields: ['place_id', 'name', 'formatted_address', 'geometry', 'formatted_phone_number', 'website', 'url'] },
          (place: any, status: string) => {
            this.ngZone.run(() => {
              if (status === 'OK' && place) {
                observer.next({
                  venue: place.name || '',
                  google_place_id: place.place_id || '',
                  venue_address: place.formatted_address || '',
                  venue_latitude: place.geometry?.location?.lat() ?? undefined,
                  venue_longitude: place.geometry?.location?.lng() ?? undefined,
                  venue_phone: place.formatted_phone_number || undefined,
                  venue_website: place.website || undefined,
                  venue_maps_url: place.url || undefined,
                });
                observer.complete();
              } else {
                observer.error(new Error('Place details failed'));
              }
            });
          }
        );
      };

      if (this.isLoaded) {
        doFetch();
      } else if (this.loadPromise) {
        this.loadPromise.then(doFetch).catch(err => observer.error(err));
      } else {
        observer.error(new Error('Google Maps not configured'));
      }
    });
  }
}
