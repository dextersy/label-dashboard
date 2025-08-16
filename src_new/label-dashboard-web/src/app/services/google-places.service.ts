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
  types: string[];
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  website?: string;
  url?: string;
  types: string[];
  photos?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class GooglePlacesService {
  private autocompleteService: google.maps.places.AutocompleteService | null = null;
  private isGoogleMapsLoaded = false;
  private isNewApiAvailable = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private ngZone: NgZone) {
    this.initializeGooglePlaces();
  }

  private async initializeGooglePlaces(): Promise<void> {
    try {
      if (typeof google !== 'undefined' && google.maps) {
        await this.initializeServices();
        return;
      }

      // Check if API key is available
      if (!environment.googleMapsApiKey) {
        console.warn('Google Maps API key not configured. Venue autocomplete will not work.');
        return;
      }

      // Load Google Maps API if not already loaded
      if (!this.isGoogleMapsLoaded) {
        await this.loadGoogleMapsAPI();
      }
    } catch (error) {
      console.error('Failed to initialize Google Places:', error);
    }
  }

  private loadGoogleMapsAPI(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        await this.initializeServices();
        resolve();
        return;
      }

      // Check if script is already loading
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', async () => {
          await this.initializeServices();
          resolve();
        });
        existingScript.addEventListener('error', reject);
        return;
      }

      // Load the Google Maps API with Places library
      // Try loading with new async loading first, fallback to standard loading
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.getApiKey()}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = async () => {
        this.isGoogleMapsLoaded = true;
        await this.initializeServices();
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Google Maps API'));
      };
      
      document.head.appendChild(script);
    });
  }

  private getApiKey(): string {
    return environment.googleMapsApiKey;
  }

  private async initializeServices(): Promise<void> {
    try {
      if (typeof google !== 'undefined' && google.maps) {
        // Try the new dynamic import method first
        if (google.maps.importLibrary) {
          try {
            // Try the new AutocompleteSuggestion API first
            const placesLib = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
            if (placesLib.AutocompleteSuggestion) {
              // New API is available, but we still need AutocompleteService as fallback
              if (placesLib.AutocompleteService) {
                this.autocompleteService = new placesLib.AutocompleteService();
              }
              this.isNewApiAvailable = true;
              return;
            } else if (placesLib.AutocompleteService) {
              // Fallback to AutocompleteService within new API
              this.autocompleteService = new placesLib.AutocompleteService();
              this.isNewApiAvailable = true;
              return;
            }
          } catch (importError) {
            this.isNewApiAvailable = false;
          }
        }
        
        // Fallback to legacy API if new method not available or fails
        if (google.maps.places && google.maps.places.AutocompleteService) {
          this.autocompleteService = new google.maps.places.AutocompleteService();
        }
      }
    } catch (error) {
      console.error('Failed to initialize Google Places services:', error);
    }
  }

  /**
   * Get place predictions based on input text
   */
  getPlacePredictions(input: string): Observable<GooglePlacesPrediction[]> {
    return new Observable(observer => {
      // Return empty results if API key not configured
      if (!environment.googleMapsApiKey) {
        observer.next([]);
        observer.complete();
        return;
      }

      if (!this.autocompleteService && !this.isNewApiAvailable) {
        this.initializeGooglePlaces().then(() => {
          this.performSearch(input, observer);
        }).catch(error => {
          console.error('Failed to initialize Google Places for search:', error);
          observer.next([]);
          observer.complete();
        });
      } else {
        this.performSearch(input, observer);
      }
    });
  }

  private async performSearch(input: string, observer: any): Promise<void> {
    try {
      // Try the new AutocompleteSuggestion API first if available
      if (this.isNewApiAvailable && google.maps.importLibrary) {
        try {
          const placesLib = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
          
          if (placesLib.AutocompleteSuggestion) {
            const request = {
              input: input,
              includedPrimaryTypes: ['restaurant', 'bar', 'night_club', 'tourist_attraction', 'establishment']
            };

            const suggestions = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
            
            this.ngZone.run(() => {
              const formattedPredictions: GooglePlacesPrediction[] = suggestions.suggestions.map((suggestion: any) => ({
                place_id: suggestion.placePrediction?.placeId || '',
                description: suggestion.placePrediction?.text?.text || '',
                structured_formatting: {
                  main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
                  secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || ''
                },
                types: suggestion.placePrediction?.types || []
              }));
              observer.next(formattedPredictions);
              observer.complete();
            });
            return;
          }
        } catch (newApiError) {
          // Fall back to legacy API
        }
      }

      // Fallback to legacy AutocompleteService
      if (!this.autocompleteService) {
        observer.error(new Error('Google Places Autocomplete service not available'));
        return;
      }

      const request = {
        input: input,
        types: ['establishment'], // Focus on businesses/venues
        componentRestrictions: { country: [] } // Allow worldwide search
      };

      this.autocompleteService.getPlacePredictions(request, (predictions: google.maps.places.QueryAutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
        this.ngZone.run(() => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formattedPredictions: GooglePlacesPrediction[] = predictions.map((prediction: google.maps.places.QueryAutocompletePrediction) => ({
              place_id: prediction.place_id || '',
              description: prediction.description || '',
              structured_formatting: {
                main_text: (prediction as any).structured_formatting?.main_text || '',
                secondary_text: (prediction as any).structured_formatting?.secondary_text || ''
              },
              types: (prediction as any).types || []
            }));
            observer.next(formattedPredictions);
          } else {
            observer.next([]);
          }
          observer.complete();
        });
      });
    } catch (error) {
      this.ngZone.run(() => {
        observer.error(error);
      });
    }
  }

  /**
   * Get detailed place information by place ID using the new Places API
   */
  getPlaceDetails(placeId: string): Observable<GooglePlaceDetails> {
    return new Observable(observer => {
      // Return error if API key not configured
      if (!environment.googleMapsApiKey) {
        observer.error(new Error('Google Maps API key not configured'));
        return;
      }

      if (!this.isGoogleMapsLoaded) {
        this.initializeGooglePlaces().then(() => {
          this.fetchPlaceDetails(placeId, observer);
        }).catch(error => {
          console.error('Failed to initialize Google Places for details:', error);
          observer.error(error);
        });
      } else {
        this.fetchPlaceDetails(placeId, observer);
      }
    });
  }

  private async fetchPlaceDetails(placeId: string, observer: any): Promise<void> {
    try {
      // Try the new Places API first
      if (google.maps.importLibrary) {
        try {
          const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;

          const place = new Place({
            id: placeId,
            requestedLanguage: 'en',
          });

          // Fetch the required fields using the new API
          await place.fetchFields({
            fields: [
              'id',
              'displayName',
              'formattedAddress',
              'location',
              'nationalPhoneNumber',
              'websiteURI',
              'googleMapsURI',
              'types'
            ]
          });

          this.ngZone.run(() => {
            const placeDetails: GooglePlaceDetails = {
              place_id: place.id || '',
              name: place.displayName || '',
              formatted_address: place.formattedAddress || '',
              geometry: {
                location: {
                  lat: place.location?.lat() || 0,
                  lng: place.location?.lng() || 0
                }
              },
              formatted_phone_number: place.nationalPhoneNumber || undefined,
              website: place.websiteURI || undefined,
              url: place.googleMapsURI || undefined,
              types: place.types || [],
              photos: []
            };
            observer.next(placeDetails);
            observer.complete();
          });
          return;
        } catch (newApiError) {
          // Fall back to legacy API
        }
      }

      // Fallback to legacy PlacesService
      this.fetchPlaceDetailsLegacy(placeId, observer);
    } catch (error) {
      this.ngZone.run(() => {
        console.error('Failed to fetch place details:', error);
        observer.error(error);
      });
    }
  }

  private fetchPlaceDetailsLegacy(placeId: string, observer: any): void {
    // Create a dummy div for legacy PlacesService
    const dummyDiv = document.createElement('div');
    const legacyPlacesService = new google.maps.places.PlacesService(dummyDiv);

    const request = {
      placeId: placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry.location',
        'formatted_phone_number',
        'website',
        'url',
        'types'
      ]
    };

    legacyPlacesService.getDetails(request, (place: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
      this.ngZone.run(() => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const placeDetails: GooglePlaceDetails = {
            place_id: place.place_id || '',
            name: place.name || '',
            formatted_address: place.formatted_address || '',
            geometry: {
              location: {
                lat: place.geometry?.location?.lat() || 0,
                lng: place.geometry?.location?.lng() || 0
              }
            },
            formatted_phone_number: place.formatted_phone_number || undefined,
            website: place.website || undefined,
            url: place.url || undefined,
            types: place.types || [],
            photos: place.photos || []
          };
          observer.next(placeDetails);
        } else {
          observer.error(new Error(`Legacy Places API failed with status: ${status}`));
        }
        observer.complete();
      });
    });
  }

  /**
   * Convert place details to venue data structure for events
   */
  convertPlaceToVenueData(place: GooglePlaceDetails): {
    venue: string;
    google_place_id: string;
    venue_address: string;
    venue_latitude: number;
    venue_longitude: number;
    venue_phone?: string;
    venue_website?: string;
    venue_maps_url?: string;
  } {
    return {
      venue: place.name,
      google_place_id: place.place_id,
      venue_address: place.formatted_address,
      venue_latitude: place.geometry.location.lat,
      venue_longitude: place.geometry.location.lng,
      venue_phone: place.formatted_phone_number,
      venue_website: place.website,
      venue_maps_url: place.url
    };
  }
}