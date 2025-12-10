import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ArtistStateService } from '../../services/artist-state.service';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { environment } from 'environments/environment';

@Component({
  selector: 'app-select-artist',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent],
  templateUrl: './select-artist.component.html',
  styleUrl: './select-artist.component.scss'
})
export class SelectArtistComponent implements OnInit {
  artists: Artist[] = [];
  loading = true;
  error: string | null = null;
  isAdmin = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    // Clear the current artist selection when this page loads
    this.artistStateService.setSelectedArtist(null);
    localStorage.removeItem('selected_artist_id');
    
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
    this.error = null;

    this.http.get<{artists: Artist[], isAdmin: boolean}>(`${environment.apiUrl}/artists`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.artists = data.artists;
        this.isAdmin = data.isAdmin;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.error = 'Failed to load artists. Please try again.';
        this.loading = false;
      }
    });
  }

  selectArtist(artist: Artist): void {
    // Save to localStorage
    localStorage.setItem('selected_artist_id', artist.id.toString());
    
    // Update the state service
    this.artistStateService.setSelectedArtist(artist);
    
    // Navigate to artist profile
    this.router.navigate(['/artist/profile']);
  }

  getArtistPhotoUrl(artist: Artist): string | null {
    if (artist.profilePhotoImage?.path) {
      return artist.profilePhotoImage.path;
    }
    if (artist.profile_photo) {
      return artist.profile_photo;
    }
    return null;
  }

  getArtistInitials(artist: Artist): string {
    return artist.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  addNewArtist(): void {
    this.router.navigate(['/artist/new']);
  }
}
