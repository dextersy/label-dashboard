import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../../components/shared/icon/icon.component';

export interface VenueLocationData {
  venue: string;
  venue_address?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  venue_phone?: string;
  venue_website?: string;
  venue_maps_url?: string;
}

@Component({
  selector: 'app-venue-location-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="modal fade show" style="display: block;" tabindex="-1" *ngIf="isOpen">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <app-icon name="map-pin" class="tw-mr-2" />
              {{ venueData?.venue || 'Venue Location' }}
            </h5>
            <button type="button" class="btn-close" (click)="close()"></button>
          </div>
          
          <div class="modal-body p-0">
            <!-- Loading indicator -->
            <div *ngIf="isLoadingMap" class="d-flex justify-content-center align-items-center p-4">
              <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
              <span class="ms-2">Loading map...</span>
            </div>
            
            <!-- Error message -->
            <div *ngIf="mapError" class="alert alert-warning m-3">
              <app-icon name="warning" class="tw-mr-2" />
              {{ mapError }}
            </div>
            
            <!-- Google Maps container -->
            <div #mapContainer 
                 class="map-container" 
                 [style.display]="isLoadingMap || mapError ? 'none' : 'block'">
            </div>
            
            <!-- Venue information -->
            <div class="venue-info p-3 border-top" *ngIf="venueData">
              <div class="row">
                <div class="col-md-8">
                  <h6 class="mb-2">
                    <app-icon name="map-pin" class="tw-text-primary tw-mr-2" />
                    {{ venueData.venue }}
                  </h6>
                  <p class="text-muted mb-2" *ngIf="venueData.venue_address">
                    <app-icon name="map-pin" class="tw-mr-2" />
                    {{ venueData.venue_address }}
                  </p>
                  <div class="contact-info" *ngIf="venueData.venue_phone || venueData.venue_website">
                    <p class="mb-1" *ngIf="venueData.venue_phone">
                      <app-icon name="phone" class="tw-mr-2" />
                      <a [href]="'tel:' + venueData.venue_phone" class="text-decoration-none">
                        {{ venueData.venue_phone }}
                      </a>
                    </p>
                    <p class="mb-1" *ngIf="venueData.venue_website">
                      <app-icon name="globe" class="tw-mr-2" />
                      <a [href]="venueData.venue_website" target="_blank" class="text-decoration-none">
                        Visit Website
                      </a>
                    </p>
                  </div>
                </div>
                <div class="col-md-4 text-end">
                  <button 
                    type="button" 
                    class="btn btn-outline-primary btn-sm me-2"
                    *ngIf="canGetDirections()"
                    (click)="getDirections()">
                    <app-icon name="map-pin" class="tw-mr-1" />
                    Directions
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-primary btn-sm"
                    *ngIf="venueData.venue_maps_url"
                    (click)="openInGoogleMaps()">
                    <app-icon name="external-link" class="tw-mr-1" />
                    Open in Maps
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="close()">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal backdrop -->
    <div class="modal-backdrop fade show" *ngIf="isOpen" (click)="close()"></div>
  `,
  styles: [`
    .modal {
      z-index: 1060;
    }
    .modal-backdrop {
      z-index: 1050;
    }
    .map-container {
      height: 400px;
      width: 100%;
    }
    .venue-info {
      background-color: #f8f9fa;
    }
    .contact-info a {
      color: #6c757d;
    }
    .contact-info a:hover {
      color: #495057;
    }
  `]
})
export class VenueLocationModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Input() venueData: VenueLocationData | null = null;
  @Output() modalClose = new EventEmitter<void>();
  
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;
  
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  isLoadingMap = false;
  mapError: string | null = null;
  
  constructor(private ngZone: NgZone) {}
  
  ngOnInit(): void {
    // Initialize map when modal opens
    if (this.isOpen && this.venueData && this.hasLocationData()) {
      this.initializeMap();
    }
  }
  
  ngOnDestroy(): void {
    this.cleanupMap();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (this.isOpen && this.venueData && this.hasLocationData()) {
      // Small delay to ensure the modal DOM is rendered
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    } else if (!this.isOpen) {
      this.cleanupMap();
    }
  }
  
  private hasLocationData(): boolean {
    return !!(this.venueData?.venue_latitude && this.venueData?.venue_longitude);
  }
  
  private async initializeMap(): Promise<void> {
    if (!this.venueData || !this.hasLocationData()) {
      this.mapError = 'Location coordinates are not available for this venue.';
      return;
    }
    
    this.isLoadingMap = true;
    this.mapError = null;
    
    try {
      // Load Google Maps API if not already loaded
      await this.loadGoogleMapsAPI();
      
      // Wait for the map container to be available
      if (!this.mapContainer) {
        throw new Error('Map container not found');
      }
      
      const position = {
        lat: this.venueData.venue_latitude!,
        lng: this.venueData.venue_longitude!
      };
      
      // Initialize the map
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: position,
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });
      
      // Add marker for the venue
      this.marker = new google.maps.Marker({
        position: position,
        map: this.map,
        title: this.venueData.venue,
        animation: google.maps.Animation.DROP
      });
      
      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: this.createInfoWindowContent()
      });
      
      this.marker.addListener('click', () => {
        infoWindow.open(this.map, this.marker);
      });
      
      // Auto-open info window
      infoWindow.open(this.map, this.marker);
      
      this.isLoadingMap = false;
    } catch (error) {
      console.error('Error initializing map:', error);
      this.mapError = 'Failed to load the map. Please try again.';
      this.isLoadingMap = false;
    }
  }
  
  private createInfoWindowContent(): string {
    if (!this.venueData) return '';
    
    let content = `<div class="venue-info-window">
      <h6 class="mb-2"><strong>${this.venueData.venue}</strong></h6>`;
    
    if (this.venueData.venue_address) {
      content += `<p class="mb-1 text-muted">${this.venueData.venue_address}</p>`;
    }
    
    if (this.venueData.venue_phone) {
      content += `<p class="mb-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.12 6.12l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${this.venueData.venue_phone}</p>`;
    }
    
    content += '</div>';
    return content;
  }
  
  private loadGoogleMapsAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
        return;
      }
      
      // Check if script is already loading
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', reject);
        return;
      }
      
      // Load the Google Maps API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.getApiKey()}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      
      document.head.appendChild(script);
    });
  }
  
  private getApiKey(): string {
    // TODO: Add your Google Maps API key to environment configuration
    // This should match the key used in the GooglePlacesService
    return 'YOUR_GOOGLE_MAPS_API_KEY';
  }
  
  private cleanupMap(): void {
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }
    if (this.map) {
      this.map = null;
    }
  }
  
  canGetDirections(): boolean {
    return this.hasLocationData() && 'geolocation' in navigator;
  }
  
  getDirections(): void {
    if (!this.hasLocationData()) return;
    
    const destination = `${this.venueData!.venue_latitude},${this.venueData!.venue_longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, '_blank');
  }
  
  openInGoogleMaps(): void {
    if (this.venueData?.venue_maps_url) {
      window.open(this.venueData.venue_maps_url, '_blank');
    } else if (this.hasLocationData()) {
      const url = `https://www.google.com/maps/search/?api=1&query=${this.venueData!.venue_latitude},${this.venueData!.venue_longitude}`;
      window.open(url, '_blank');
    }
  }
  
  close(): void {
    this.modalClose.emit();
    this.cleanupMap();
  }
}