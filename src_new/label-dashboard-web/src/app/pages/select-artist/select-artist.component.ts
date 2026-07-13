import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ArtistStateService } from '../../services/artist-state.service';
import { Artist } from '../../models/artist.model';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { environment } from 'environments/environment';
import { IconComponent } from '../../components/shared/icon/icon.component';

@Component({
  selector: 'app-select-artist',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, IconComponent],
  templateUrl: './select-artist.component.html',
  styleUrl: './select-artist.component.scss'
})
export class SelectArtistComponent implements OnInit {
  artists: Artist[] = [];
  loading = true;
  error: string | null = null;
  isAdmin = false;

  private autoSelectId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    const selectParam = this.route.snapshot.queryParamMap.get('select');
    this.autoSelectId = selectParam ? parseInt(selectParam, 10) : null;

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

        if (this.autoSelectId) {
          const target = this.artists.find(a => a.id === this.autoSelectId);
          if (target) {
            this.selectArtist(target, '/artist/profile');
          }
        }
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.error = 'Failed to load artists. Please try again.';
        this.loading = false;
      }
    });
  }

  selectArtist(artist: Artist, redirectTo = '/dashboard'): void {
    // Save to localStorage
    localStorage.setItem('selected_artist_id', artist.id.toString());

    // Update the state service
    this.artistStateService.setSelectedArtist(artist);

    this.router.navigate([redirectTo]);
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
