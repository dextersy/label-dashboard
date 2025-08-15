import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, forwardRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { GooglePlacesService, GooglePlacesPrediction, GooglePlaceDetails } from '../../../services/google-places.service';
import { Subject, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';

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

@Component({
  selector: 'app-venue-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VenueAutocompleteComponent),
      multi: true
    }
  ],
  template: `
    <div class="venue-autocomplete-container" [class.has-error]="hasError">
      <div class="input-group">
        <input
          #searchInput
          type="text"
          class="form-control"
          [placeholder]="placeholder"
          [value]="displayValue"
          (input)="onInputChange($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          [class.is-invalid]="hasError"
          autocomplete="off"
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          *ngIf="selectedVenue && selectedVenue.google_place_id"
          (click)="clearSelection()"
          title="Clear selection">
          <i class="fa fa-times"></i>
        </button>
      </div>
      
      <!-- Loading indicator -->
      <div class="text-muted small mt-1" *ngIf="isLoading">
        <i class="fa fa-spinner fa-spin me-1"></i>Searching places...
      </div>
      
      <!-- Manual entry option -->
      <div class="form-text small mt-1" *ngIf="showDropdown && predictions.length === 0 && searchQuery.length > 2 && !isLoading">
        No places found. You can enter the venue name manually.
      </div>
      
      <!-- Selected venue info -->
      <div class="selected-venue-info mt-2" *ngIf="selectedVenue && selectedVenue.google_place_id">
        <div class="card card-body bg-light small">
          <div class="d-flex align-items-start">
            <i class="fa fa-map-marker-alt text-primary me-2 mt-1"></i>
            <div class="flex-grow-1">
              <div class="fw-semibold">{{ selectedVenue.venue }}</div>
              <div class="text-muted" *ngIf="selectedVenue.venue_address">{{ selectedVenue.venue_address }}</div>
              <div class="mt-1" *ngIf="selectedVenue.venue_phone || selectedVenue.venue_website">
                <span class="badge bg-secondary me-1" *ngIf="selectedVenue.venue_phone">
                  <i class="fa fa-phone me-1"></i>{{ selectedVenue.venue_phone }}
                </span>
                <a [href]="selectedVenue.venue_website" target="_blank" 
                   class="badge bg-primary text-decoration-none" 
                   *ngIf="selectedVenue.venue_website">
                  <i class="fa fa-globe me-1"></i>Website
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .venue-autocomplete-container {
      position: relative;
      z-index: 1000;
    }
    
    .dropdown-menu {
      display: block !important;
      position: fixed !important;
      z-index: 99999 !important;
      background: white !important;
      border: 1px solid #dee2e6 !important;
      border-radius: 0.375rem !important;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
      min-width: 200px !important;
    }
    
    .venue-autocomplete-dropdown {
      border: 1px solid #ccc !important;
      border-radius: 4px !important;
      background: white !important;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
    }
    
    .dropdown-item {
      border: none !important;
      padding: 0.75rem 1rem !important;
      text-align: left !important;
      background: white !important;
      width: 100% !important;
      display: block !important;
      color: #333 !important;
    }
    
    .dropdown-item:hover {
      background-color: #f8f9fa !important;
      color: #333 !important;
    }
    
    .dropdown-item.active {
      background-color: #0d6efd !important;
      color: white !important;
    }
    
    .selected-venue-info .card {
      border: 1px solid #e9ecef;
    }
    
    .has-error .form-control {
      border-color: #dc3545;
    }
  `]
})
export class VenueAutocompleteComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() placeholder = 'Search for a venue...';
  @Input() required = false;
  @Input() hasError = false;
  @Output() venueSelected = new EventEmitter<VenueSelection>();
  
  @ViewChild('searchInput', { static: true }) searchInput!: ElementRef<HTMLInputElement>;
  
  searchQuery = '';
  displayValue = '';
  predictions: GooglePlacesPrediction[] = [];
  selectedVenue: VenueSelection | null = null;
  showDropdown = false;
  isLoading = false;
  selectedIndex = -1;
  dropdownTop = 0;
  dropdownLeft = 0;
  dropdownWidth = 0;
  dropdownElement: HTMLElement | null = null;
  
  private searchSubject = new BehaviorSubject<string>('');
  private destroy$ = new Subject<void>();
  
  // ControlValueAccessor implementation
  private onChange = (value: VenueSelection | null) => {};
  private onTouched = () => {};
  
  constructor(
    private googlePlacesService: GooglePlacesService,
    private renderer: Renderer2,
    private elementRef: ElementRef
  ) {}
  
  ngOnInit(): void {
    this.setupSearch();
    this.setupWindowEvents();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeDropdownFromBody();
  }
  
  // ControlValueAccessor methods
  writeValue(value: VenueSelection | null): void {
    if (value) {
      this.selectedVenue = value;
      this.displayValue = value.venue;
      this.searchQuery = value.venue;
    } else {
      this.selectedVenue = null;
      this.displayValue = '';
      this.searchQuery = '';
    }
  }
  
  registerOnChange(fn: (value: VenueSelection | null) => void): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    if (this.searchInput) {
      this.searchInput.nativeElement.disabled = isDisabled;
    }
  }
  
  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 3) {
          return [];
        }
        this.isLoading = true;
        return this.googlePlacesService.getPlacePredictions(query).pipe(
          // Add a timeout to prevent hanging
          takeUntil(this.destroy$)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (predictions) => {
        console.log('Venue autocomplete received predictions:', predictions);
        this.predictions = predictions || [];
        this.isLoading = false;
        this.selectedIndex = -1;
        // Calculate position when we have predictions
        console.log('Received predictions count:', this.predictions.length);
        if (this.predictions.length > 0) {
          // Use setTimeout to ensure DOM is updated
          setTimeout(() => {
            this.calculateDropdownPosition();
            this.createOrUpdateDropdown();
          }, 0);
        } else {
          this.removeDropdownFromBody();
        }
      },
      error: (error) => {
        console.error('Error getting place predictions:', error);
        this.predictions = [];
        this.isLoading = false;
        this.showDropdown = false;
      }
    });
  }
  
  onInputChange(event: any): void {
    const value = event.target.value;
    console.log('onInputChange called with value:', value);
    this.searchQuery = value;
    this.displayValue = value;
    
    // If user is typing and we have a selected venue, clear it
    if (this.selectedVenue && value !== this.selectedVenue.venue) {
      this.selectedVenue = null;
      this.onChange(null);
      this.venueSelected.emit({ venue: value });
    }
    
    // Update the form control value for manual entry
    if (!this.selectedVenue) {
      const manualVenue: VenueSelection = { 
        venue: value,
        google_place_id: undefined,
        venue_address: undefined,
        venue_latitude: undefined,
        venue_longitude: undefined,
        venue_phone: undefined,
        venue_website: undefined,
        venue_maps_url: undefined
      };
      this.onChange(manualVenue);
      this.venueSelected.emit(manualVenue);
    }
    
    this.searchSubject.next(value);
    this.showDropdown = true;
    console.log('Set showDropdown to true in onInputChange');
    // Calculate position when showing dropdown
    setTimeout(() => this.calculateDropdownPosition(), 0);
  }
  
  onFocus(): void {
    console.log('onFocus called, predictions.length:', this.predictions.length, 'searchQuery.length:', this.searchQuery.length);
    this.showDropdown = this.predictions.length > 0 || this.searchQuery.length >= 3;
    console.log('Set showDropdown to', this.showDropdown, 'in onFocus');
    if (this.showDropdown) {
      this.calculateDropdownPosition();
    }
  }
  
  onBlur(): void {
    console.log('onBlur called, will hide dropdown in 200ms');
    // Delay hiding dropdown to allow click events on dropdown items
    setTimeout(() => {
      console.log('onBlur timeout executed, removing dropdown');
      this.removeDropdownFromBody();
      this.onTouched();
    }, 200);
  }
  
  selectPlace(prediction: GooglePlacesPrediction): void {
    this.isLoading = true;
    this.removeDropdownFromBody();
    
    this.googlePlacesService.getPlaceDetails(prediction.place_id).subscribe({
      next: (placeDetails: GooglePlaceDetails) => {
        const venueData = this.googlePlacesService.convertPlaceToVenueData(placeDetails);
        this.selectedVenue = venueData;
        this.displayValue = venueData.venue;
        this.searchQuery = venueData.venue;
        
        this.onChange(venueData);
        this.venueSelected.emit(venueData);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error getting place details:', error);
        // Fallback to basic venue info
        const basicVenue: VenueSelection = { venue: prediction.description };
        this.selectedVenue = basicVenue;
        this.displayValue = prediction.description;
        this.searchQuery = prediction.description;
        
        this.onChange(basicVenue);
        this.venueSelected.emit(basicVenue);
        this.isLoading = false;
      }
    });
  }
  
  clearSelection(): void {
    this.selectedVenue = null;
    this.displayValue = '';
    this.searchQuery = '';
    this.predictions = [];
    this.showDropdown = false;
    
    const emptyVenue: VenueSelection = { venue: '' };
    this.onChange(emptyVenue);
    this.venueSelected.emit(emptyVenue);
    
    this.searchInput.nativeElement.focus();
  }
  
  trackByPlaceId(index: number, prediction: GooglePlacesPrediction): string {
    return prediction.place_id;
  }

  private setupWindowEvents(): void {
    // Recalculate dropdown position on window resize or scroll
    const handlePositionUpdate = () => {
      if (this.dropdownElement) {
        this.calculateDropdownPosition();
        this.createOrUpdateDropdown();
      }
    };

    window.addEventListener('resize', handlePositionUpdate);
    window.addEventListener('scroll', handlePositionUpdate, true);
    
    // Clean up listeners on destroy
    this.destroy$.subscribe(() => {
      window.removeEventListener('resize', handlePositionUpdate);
      window.removeEventListener('scroll', handlePositionUpdate, true);
    });
  }

  private calculateDropdownPosition(): void {
    console.log('calculateDropdownPosition called, searchInput:', !!this.searchInput);
    
    if (!this.searchInput || !this.searchInput.nativeElement) {
      console.log('No search input found');
      return;
    }
    
    const inputElement = this.searchInput.nativeElement;
    const rect = inputElement.getBoundingClientRect();
    
    console.log('Input rect:', rect);
    
    // Position dropdown below the input
    this.dropdownTop = rect.bottom + window.scrollY + 2; // Add 2px gap
    this.dropdownLeft = rect.left + window.scrollX;
    this.dropdownWidth = rect.width;
    
    console.log('Calculated position:', {
      top: this.dropdownTop,
      left: this.dropdownLeft,
      width: this.dropdownWidth
    });
    
    // Ensure dropdown doesn't go off screen
    const maxHeight = 300;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // If not enough space below but more space above, position above the input
    if (spaceBelow < maxHeight && spaceAbove > spaceBelow) {
      this.dropdownTop = rect.top + window.scrollY - Math.min(maxHeight, spaceAbove - 10);
      console.log('Positioned above input, new top:', this.dropdownTop);
    }
  }

  private createOrUpdateDropdown(): void {
    if (!this.dropdownElement) {
      // Create dropdown element
      this.dropdownElement = this.renderer.createElement('div');
      this.renderer.addClass(this.dropdownElement, 'venue-autocomplete-portal-dropdown');
      
      // Set styles with explicit font settings
      this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
      this.renderer.setStyle(this.dropdownElement, 'background', '#fff');
      this.renderer.setStyle(this.dropdownElement, 'border', '2px solid #007bff');
      this.renderer.setStyle(this.dropdownElement, 'border-radius', '8px');
      this.renderer.setStyle(this.dropdownElement, 'box-shadow', '0 8px 16px rgba(0,0,0,0.2)');
      this.renderer.setStyle(this.dropdownElement, 'z-index', '2147483647');
      this.renderer.setStyle(this.dropdownElement, 'max-height', '400px');
      this.renderer.setStyle(this.dropdownElement, 'overflow-y', 'auto');
      this.renderer.setStyle(this.dropdownElement, 'pointer-events', 'auto');
      
      // Add explicit font and text styling to ensure visibility
      this.renderer.setStyle(this.dropdownElement, 'font-family', 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
      this.renderer.setStyle(this.dropdownElement, 'font-size', '14px');
      this.renderer.setStyle(this.dropdownElement, 'line-height', '1.5');
      this.renderer.setStyle(this.dropdownElement, 'color', '#212529');
      
      // Add to body
      this.renderer.appendChild(document.body, this.dropdownElement);
    }
    
    // Update position
    this.renderer.setStyle(this.dropdownElement, 'top', `${this.dropdownTop}px`);
    this.renderer.setStyle(this.dropdownElement, 'left', `${this.dropdownLeft}px`);
    this.renderer.setStyle(this.dropdownElement, 'width', `${this.dropdownWidth}px`);
    
    // Update content
    this.updateDropdownContent();
  }

  private updateDropdownContent(): void {
    if (!this.dropdownElement) return;
    
    // Clear existing content
    this.dropdownElement.innerHTML = '';
    
    // Add header using innerHTML for simplicity
    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'padding', '12px');
    this.renderer.setStyle(header, 'background', '#f8f9fa');
    this.renderer.setStyle(header, 'border-bottom', '1px solid #dee2e6');
    this.renderer.setStyle(header, 'font-size', '12px');
    this.renderer.setStyle(header, 'color', '#6c757d');
    this.renderer.setStyle(header, 'font-family', 'inherit');
    this.renderer.setStyle(header, 'font-weight', '400');
    
    // Use simple text content first to test visibility
    header.textContent = `📍 Found ${this.predictions.length} venue suggestions:`;
    
    this.renderer.appendChild(this.dropdownElement, header);
    
    // Add predictions
    this.predictions.forEach((prediction) => {
      const item = this.renderer.createElement('div');
      this.renderer.setStyle(item, 'padding', '12px 16px');
      this.renderer.setStyle(item, 'cursor', 'pointer');
      this.renderer.setStyle(item, 'border-bottom', '1px solid #eee');
      this.renderer.setStyle(item, 'transition', 'background-color 0.2s');
      
      // Add hover effects
      this.renderer.listen(item, 'mouseenter', () => {
        this.renderer.setStyle(item, 'background-color', '#f8f9fa');
      });
      this.renderer.listen(item, 'mouseleave', () => {
        this.renderer.setStyle(item, 'background-color', 'white');
      });
      
      // Add click handler
      this.renderer.listen(item, 'click', () => {
        this.selectPlace(prediction);
      });
      
      // Create a simple text representation using structured formatting
      const mainText = prediction.structured_formatting?.main_text || '';
      const secondaryText = prediction.structured_formatting?.secondary_text || '';
      const displayText = secondaryText ? `${mainText} - ${secondaryText}` : (mainText || prediction.description || 'Unknown venue');
      item.textContent = displayText;
      
      // Add explicit styling to ensure text is visible
      this.renderer.setStyle(item, 'color', '#212529');
      this.renderer.setStyle(item, 'font-family', 'inherit');
      this.renderer.setStyle(item, 'font-size', '14px');
      this.renderer.setStyle(item, 'line-height', '1.5');
      
      this.renderer.appendChild(this.dropdownElement, item);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private removeDropdownFromBody(): void {
    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
    }
  }
}