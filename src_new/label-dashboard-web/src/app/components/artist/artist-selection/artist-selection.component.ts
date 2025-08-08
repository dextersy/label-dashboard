import { Component, OnInit, OnChanges, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { ArtistStateService } from '../../../services/artist-state.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from 'environments/environment';

export interface Artist {
  id: number;
  name: string;
  profile_photo: string;
  band_members?: string;
}

@Component({
  selector: 'app-artist-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-selection.component.html',
  styleUrl: './artist-selection.component.scss'
})
export class ArtistSelectionComponent implements OnInit, OnChanges, OnDestroy {
  @Input() currentArtist: Artist | null = null;
  @Output() artistSelected = new EventEmitter<Artist>();
  
  artists: Artist[] = [];
  filteredArtists: Artist[] = [];
  selectedArtist: Artist | null = null;
  loading = false;
  isDropdownOpen = false;
  isAdmin = false;
  searchTerm: string = '';
  isNewArtistMode = false;
  private refreshSubscription: Subscription = new Subscription();

  constructor(
    private http: HttpClient, 
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    this.loadArtists();
    
    // Subscribe to refresh triggers
    this.refreshSubscription.add(
      this.artistStateService.refreshArtists$.subscribe((selectArtistId) => {
        this.refreshArtistsAndSelect(selectArtistId);
      })
    );

    // Check initial route
    this.checkNewArtistMode();

    // Subscribe to route changes
    this.refreshSubscription.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.checkNewArtistMode();
      })
    );
  }

  ngOnChanges(): void {
    if (this.currentArtist) {
      // Update selected artist with current artist data (including updated profile info)
      this.selectedArtist = this.currentArtist;
      
      // Also update the artist in the artists array if it exists
      if (this.artists.length > 0) {
        const index = this.artists.findIndex(artist => artist.id === this.currentArtist!.id);
        if (index !== -1) {
          this.artists[index] = { ...this.artists[index], ...this.currentArtist };
        }
      }
    }
  }

  private checkNewArtistMode(): void {
    this.isNewArtistMode = this.router.url === '/artist/new';
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadArtists(): void {
    this.loading = true;
    
    this.http.get<{artists: Artist[], isAdmin: boolean}>(`${environment.apiUrl}/artists`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.artists = data.artists;
        this.isAdmin = data.isAdmin;
        this.filterArtists(); // Initialize filtered list
        
        // Try to restore from localStorage first
        const savedArtistId = this.getSavedArtistId();
        let artistToSelect: Artist | null = null;
        
        if (savedArtistId && this.artists.length > 0) {
          artistToSelect = this.artists.find(artist => artist.id === savedArtistId) || null;
        }
        
        // Fallback to currentArtist prop if no saved selection or saved artist not found
        if (!artistToSelect && this.currentArtist) {
          artistToSelect = this.artists.find(artist => artist.id === this.currentArtist!.id) || null;
        }
        
        // Final fallback to first artist
        if (!artistToSelect && this.artists.length > 0) {
          artistToSelect = this.artists[0];
        }
        
        if (artistToSelect) {
          this.selectArtist(artistToSelect);
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loading = false;
      }
    });
  }

  selectArtist(artist: Artist): void {
    this.selectedArtist = artist;
    this.isDropdownOpen = false;
    this.saveArtistId(artist.id);
    this.artistSelected.emit(artist);
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      // Clear search when opening dropdown
      this.searchTerm = '';
      this.filterArtists();
      // Focus on search input after dropdown opens
      setTimeout(() => {
        const searchInput = document.querySelector('.artist-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }

  onSearchChange(): void {
    this.filterArtists();
  }

  filterArtists(): void {
    if (!this.searchTerm.trim()) {
      this.filteredArtists = [...this.artists];
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredArtists = this.artists.filter(artist => 
        artist.name.toLowerCase().includes(searchLower) ||
        (artist.band_members && artist.band_members.toLowerCase().includes(searchLower))
      );
    }
  }

  addNewArtist(): void {
    this.isDropdownOpen = false;
    this.router.navigate(['/artist/new']);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    // Allow users to navigate with arrow keys
    if (event.key === 'ArrowDown' && this.filteredArtists.length > 0) {
      event.preventDefault();
      // Focus first artist in the list
      const firstArtistElement = document.querySelector('.dropdown-menu li:not(.search-container):not(.divider):not(.no-results) a') as HTMLElement;
      if (firstArtistElement) {
        firstArtistElement.focus();
      }
    }
    if (event.key === 'Escape') {
      this.isDropdownOpen = false;
    }
  }

  refreshArtists(): void {
    this.loadArtists();
  }

  refreshArtistsAndSelect(selectArtistId: number | null): void {
    this.loading = true;
    
    this.http.get<{artists: Artist[], isAdmin: boolean}>(`${environment.apiUrl}/artists`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.artists = data.artists;
        this.isAdmin = data.isAdmin;
        this.filterArtists(); // Initialize filtered list
        
        // If a specific artist ID was provided, select that artist
        if (selectArtistId) {
          const artistToSelect = this.artists.find(artist => artist.id === selectArtistId);
          if (artistToSelect) {
            this.selectArtist(artistToSelect);
            this.loading = false;
            return;
          }
        }
        
        // Otherwise follow the normal selection logic
        this.restoreArtistSelection();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loading = false;
      }
    });
  }

  private restoreArtistSelection(): void {
    // Try to restore from localStorage first
    const savedArtistId = this.getSavedArtistId();
    let artistToSelect: Artist | null = null;
    
    if (savedArtistId && this.artists.length > 0) {
      artistToSelect = this.artists.find(artist => artist.id === savedArtistId) || null;
    }
    
    // Fallback to currentArtist prop if no saved selection or saved artist not found
    if (!artistToSelect && this.currentArtist) {
      artistToSelect = this.artists.find(artist => artist.id === this.currentArtist!.id) || null;
    }
    
    // Final fallback to first artist
    if (!artistToSelect && this.artists.length > 0) {
      artistToSelect = this.artists[0];
    }
    
    if (artistToSelect) {
      this.selectArtist(artistToSelect);
    }
  }

  private saveArtistId(artistId: number): void {
    try {
      localStorage.setItem('selected_artist_id', artistId.toString());
    } catch (error) {
      console.warn('Failed to save artist selection to localStorage:', error);
    }
  }

  private getSavedArtistId(): number | null {
    try {
      const savedId = localStorage.getItem('selected_artist_id');
      return savedId ? parseInt(savedId, 10) : null;
    } catch (error) {
      console.warn('Failed to retrieve artist selection from localStorage:', error);
      return null;
    }
  }

  getProfilePhotoUrl(photo: string): string {
    if (!photo) {
      return 'assets/img/placeholder.jpg';
    }
    return photo.startsWith('http') ? photo : `${environment.apiUrl}/uploads/artists/${photo}`;
  }

  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }
}