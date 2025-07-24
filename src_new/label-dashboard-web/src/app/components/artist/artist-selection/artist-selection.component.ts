import { Component, OnInit, Output, EventEmitter } from '@angular/core';
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
export class ArtistSelectionComponent implements OnInit {
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
        
        // Set first artist as selected by default
        if (this.artists.length > 0) {
          this.selectArtist(this.artists[0]);
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
    this.artistSelected.emit(artist);
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  addNewArtist(): void {
    // TODO: Implement add new artist functionality
    console.log('Add new artist clicked');
  }

  getProfilePhotoUrl(photo: string): string {
    if (!photo) {
      return 'assets/img/default-artist.jpg';
    }
    return photo.startsWith('http') ? photo : `${environment.apiUrl}/uploads/artists/${photo}`;
  }
}