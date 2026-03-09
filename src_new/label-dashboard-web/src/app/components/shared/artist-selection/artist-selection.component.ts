import { Component, OnInit, OnChanges, OnDestroy, Output, EventEmitter, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { ArtistStateService } from '../../../services/artist-state.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { Artist } from '../../../models/artist.model';
import { ModalToBodyDirective } from '../../../directives/modal-to-body.directive';

export type { Artist };

@Component({
    selector: 'app-artist-selection',
    imports: [CommonModule, FormsModule, ModalToBodyDirective],
    templateUrl: './artist-selection.component.html',
    styleUrl: './artist-selection.component.scss'
})
export class ArtistSelectionComponent implements OnInit, OnChanges, OnDestroy {
  @Input() currentArtist: Artist | null = null;
  @Output() artistSelected = new EventEmitter<{artist: Artist, userInitiated: boolean}>();

  artists: Artist[] = [];
  filteredArtists: Artist[] = [];
  selectedArtist: Artist | null = null;
  loading = false;
  isModalOpen = false;
  isAdmin = false;
  searchTerm: string = '';
  isNewArtistMode = false;
  currentPage = 0;
  readonly pageSize = 5;
  private refreshSubscription: Subscription = new Subscription();

  constructor(
    private http: HttpClient,
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    this.loadArtists();

    this.refreshSubscription.add(
      this.artistStateService.refreshArtists$.subscribe((selectArtistId) => {
        this.refreshArtistsAndSelect(selectArtistId);
      })
    );

    this.refreshSubscription.add(
      this.artistStateService.openModal$.subscribe(() => {
        this.openModal();
      })
    );

    this.checkNewArtistMode();

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
      this.selectedArtist = this.currentArtist;

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
        this.filterArtists();

        const savedArtistId = this.getSavedArtistId();
        let artistToSelect: Artist | null = null;

        if (savedArtistId && this.artists.length > 0) {
          artistToSelect = this.artists.find(artist => artist.id === savedArtistId) || null;
        }

        if (!artistToSelect && this.currentArtist) {
          artistToSelect = this.artists.find(artist => artist.id === this.currentArtist!.id) || null;
        }

        if (!artistToSelect && this.artists.length > 0) {
          artistToSelect = this.artists[0];
        }

        if (artistToSelect) {
          this.selectArtist(artistToSelect, false);
        }

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loading = false;
      }
    });
  }

  selectArtist(artist: Artist, userInitiated: boolean = false): void {
    this.selectedArtist = artist;
    this.isModalOpen = false;
    this.saveArtistId(artist.id);
    this.artistSelected.emit({artist, userInitiated});
  }

  openModal(): void {
    if (!this.isNewArtistMode) {
      this.searchTerm = '';
      this.currentPage = 0;
      this.filterArtists();
      this.isModalOpen = true;
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isModalOpen) {
      this.closeModal();
    }
  }

  onSearchChange(): void {
    this.currentPage = 0;
    this.filterArtists();
  }

  filterArtists(): void {
    let results: Artist[];
    if (!this.searchTerm.trim()) {
      results = [...this.artists];
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      results = this.artists.filter(artist =>
        artist.name.toLowerCase().includes(searchLower) ||
        (artist.band_members && artist.band_members.toLowerCase().includes(searchLower))
      );
    }
    // Always keep selected artist at the top
    if (this.selectedArtist) {
      const idx = results.findIndex(a => a.id === this.selectedArtist!.id);
      if (idx > 0) {
        results.unshift(...results.splice(idx, 1));
      }
    }
    this.filteredArtists = results;
  }

  get pagedArtists(): Artist[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredArtists.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredArtists.length / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  addNewArtist(): void {
    this.isModalOpen = false;
    this.router.navigate(['/artist/new']);
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
        this.filterArtists();

        if (selectArtistId) {
          const artistToSelect = this.artists.find(artist => artist.id === selectArtistId);
          if (artistToSelect) {
            this.selectArtist(artistToSelect, false);
            this.loading = false;
            return;
          }
        }

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
    const savedArtistId = this.getSavedArtistId();
    let artistToSelect: Artist | null = null;

    if (savedArtistId && this.artists.length > 0) {
      artistToSelect = this.artists.find(artist => artist.id === savedArtistId) || null;
    }

    if (!artistToSelect && this.currentArtist) {
      artistToSelect = this.artists.find(artist => artist.id === this.currentArtist!.id) || null;
    }

    if (!artistToSelect && this.artists.length > 0) {
      artistToSelect = this.artists[0];
    }

    if (artistToSelect) {
      this.selectArtist(artistToSelect, false);
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

  getProfilePhotoUrl(artist: Artist): string {
    if (artist.profilePhotoImage?.path) {
      return artist.profilePhotoImage.path;
    }

    if (artist.profile_photo) {
      return artist.profile_photo.startsWith('http') ? artist.profile_photo : `${environment.apiUrl}/uploads/artists/${artist.profile_photo}`;
    }

    return 'assets/img/placeholder.jpg';
  }

  ngOnDestroy(): void {
    this.refreshSubscription.unsubscribe();
  }
}
