import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Artist } from '../artist-selection/artist-selection.component';
import { environment } from 'environments/environment';
import { ReleaseValidationService } from '../../../services/release-validation.service';
import { Song } from '../../../services/song.service';
import { ReleaseService } from '../../../services/release.service';
import { downloadFromResponse } from '../../../utils/file-utils';
import { ConfirmationService } from '../../../services/confirmation.service';

export interface ArtistRelease {
  id: number;
  catalog_no: string;
  title: string;
  cover_art: string;
  release_date: string;
  status: 'Draft' | 'For Submission' | 'Pending' | 'Live' | 'Taken Down';
  description?: string;
  liner_notes?: string;
  UPC?: string;
  exclude_from_epk: boolean;
  songs?: Song[];
  artists?: Array<{
    id: number;
    name: string;
    ReleaseArtist: {
      streaming_royalty_percentage: number;
      sync_royalty_percentage: number;
      download_royalty_percentage: number;
      physical_royalty_percentage: number;
    };
  }>;
}

@Component({
    selector: 'app-artist-releases-tab',
    imports: [CommonModule, FormsModule],
    templateUrl: './artist-releases-tab.component.html',
    styleUrl: './artist-releases-tab.component.scss'
})
export class ArtistReleasesTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  releases: ArtistRelease[] = [];
  epkFilter: 'all' | 'visible' | 'hidden' = 'all';
  loading = false;
  isAdmin = false;
  downloadingMastersId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private validationService: ReleaseValidationService,
    private releaseService: ReleaseService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    if (this.artist) {
      this.loadReleases();
    }
  }

  ngOnChanges(): void {
    if (this.artist) {
      this.loadReleases();
    }
  }

  get filteredReleases(): ArtistRelease[] {
    if (this.epkFilter === 'all') {
      return this.releases;
    } else if (this.epkFilter === 'visible') {
      return this.releases.filter(release => !release.exclude_from_epk);
    } else { // 'hidden'
      return this.releases.filter(release => release.exclude_from_epk);
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadReleases(): void {
    if (!this.artist) return;

    this.loading = true;

    this.http.get<{releases: ArtistRelease[], isAdmin: boolean}>(`${environment.apiUrl}/artists/${this.artist.id}/releases`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.releases = data.releases;
        this.isAdmin = data.isAdmin;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading releases:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load artist releases.'
        });
        this.loading = false;
      }
    });
  }

  onEditRelease(release: ArtistRelease): void {
    // Navigate to the edit route instead of opening a dialog
    this.router.navigate(['/music/releases/edit', release.id]);
  }

  onManageTrackList(release: ArtistRelease): void {
    // Navigate to the edit form and select the tracks section
    this.router.navigate(['/music/releases/edit', release.id], {
      queryParams: { section: 'tracks' }
    });
  }

  getCoverArtUrl(coverArt: string): string {
    if (!coverArt) {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http') ? coverArt : `${environment.apiUrl}/uploads/covers/${coverArt}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) {
      return 'TBA';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Live':
        return 'badge-success';
      case 'For Submission':
        return 'badge-info';
      case 'Pending':
        return 'badge-warning';
      case 'Draft':
        return 'badge-secondary';
      case 'Taken Down':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Live':
        return 'fa-check-circle';
      case 'For Submission':
        return 'fa-paper-plane';
      case 'Pending':
        return 'fa-clock';
      case 'Draft':
        return 'fa-file';
      case 'Taken Down':
        return 'fa-ban';
      default:
        return 'fa-question-circle';
    }
  }

  getValidationTooltip(release: ArtistRelease): string {
    const releaseValidation = this.validationService.validateRelease(release, true);
    const songsValidation = release.songs ? this.validationService.validateSongs(release.songs) : { errors: [], warnings: [], hasErrors: false, hasWarnings: false };

    // Combine validations
    const combinedValidation = {
      errors: [...releaseValidation.errors, ...songsValidation.errors],
      warnings: [...releaseValidation.warnings, ...songsValidation.warnings],
      hasErrors: releaseValidation.hasErrors || songsValidation.hasErrors,
      hasWarnings: releaseValidation.hasWarnings || songsValidation.hasWarnings
    };

    return this.validationService.getTooltipMessage(combinedValidation);
  }

  hasValidationIssues(release: ArtistRelease): boolean {
    const releaseValidation = this.validationService.validateRelease(release, true);
    const songsValidation = release.songs ? this.validationService.validateSongs(release.songs) : { errors: [], warnings: [], hasErrors: false, hasWarnings: false };
    return releaseValidation.hasErrors || releaseValidation.hasWarnings || songsValidation.hasErrors || songsValidation.hasWarnings;
  }

  hasValidationErrors(release: ArtistRelease): boolean {
    const releaseValidation = this.validationService.validateRelease(release, true);
    const songsValidation = release.songs ? this.validationService.validateSongs(release.songs) : { errors: [], warnings: [], hasErrors: false, hasWarnings: false };
    return releaseValidation.hasErrors || songsValidation.hasErrors;
  }

  canSubmitForReview(release: ArtistRelease): boolean {
    return release.status === 'Draft' && !this.hasValidationErrors(release);
  }

  async onSubmitForReview(release: ArtistRelease): Promise<void> {
    if (!this.canSubmitForReview(release)) {
      return;
    }

    // Navigate to the submit section of the edit form
    this.router.navigate(['/music/releases/edit', release.id], {
      queryParams: { section: 'submit' }
    });
  }

  navigateToCreateRelease(): void {
    this.router.navigate(['/music/releases/new']);
  }

  stripHtmlTags(html: string): string {
    if (!html) return '';

    // Create a temporary div element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Get text content and clean up extra whitespace
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  hasMasters(release: ArtistRelease): boolean {
    // Check if release has cover art
    if (release.cover_art && release.cover_art.trim() !== '') {
      return true;
    }

    // Check if release has any songs with audio files
    if (release.songs && release.songs.length > 0) {
      return release.songs.some(song => song.audio_file && song.audio_file.trim() !== '');
    }

    return false;
  }

  onDownloadMasters(release: ArtistRelease): void {
    if (this.downloadingMastersId || !this.hasMasters(release)) {
      return; // Prevent multiple downloads at once or downloading when no masters
    }

    this.downloadingMastersId = release.id;

    this.releaseService.downloadMasters(release.id).subscribe({
      next: (response) => {
        this.downloadingMastersId = null;

        // Download using filename from server's Content-Disposition header
        downloadFromResponse(response);

        this.alertMessage.emit({
          type: 'success',
          message: 'Masters downloaded successfully!'
        });
      },
      error: (error) => {
        console.error('Error downloading masters:', error);
        this.downloadingMastersId = null;

        let errorMessage = 'Failed to download masters.';
        if (error.status === 404) {
          errorMessage = 'No masters available for this release.';
        }

        this.alertMessage.emit({
          type: 'error',
          message: errorMessage
        });
      }
    });
  }

  toggleExcludeFromEPK(release: ArtistRelease): void {
    this.releaseService.toggleExcludeFromEPK(release.id).subscribe({
      next: (response) => {
        if (response.success) {
          // Convert to boolean in case backend returns 0/1
          release.exclude_from_epk = Boolean(response.exclude_from_epk);
          this.alertMessage.emit({
            type: 'success',
            message: response.message
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to update EPK visibility.'
          });
        }
      },
      error: (error) => {
        console.error('Error toggling EPK visibility:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to update EPK visibility.'
        });
      }
    });
  }

  canEditRelease(release: ArtistRelease): boolean {
    // Release can be edited if it's in Draft status or user is an admin
    return release.status === 'Draft';
  }
}