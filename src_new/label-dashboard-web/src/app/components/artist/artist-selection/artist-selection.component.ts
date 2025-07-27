import { Component, OnInit, OnChanges, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  imports: [CommonModule],
  templateUrl: './artist-selection.component.html',
  styleUrl: './artist-selection.component.scss'
})
export class ArtistSelectionComponent implements OnInit, OnChanges {
  @Input() currentArtist: Artist | null = null;
  @Output() artistSelected = new EventEmitter<Artist>();
  
  artists: Artist[] = [];
  selectedArtist: Artist | null = null;
  loading = false;
  isDropdownOpen = false;
  isAdmin = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadArtists();
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
  }

  addNewArtist(): void {
    // TODO: Implement add new artist functionality
    console.log('Add new artist clicked');
  }

  refreshArtists(): void {
    this.loadArtists();
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
}