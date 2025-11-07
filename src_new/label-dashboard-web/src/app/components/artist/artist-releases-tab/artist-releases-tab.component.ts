import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Artist } from '../artist-selection/artist-selection.component';
import { EditReleaseDialogComponent } from '../edit-release-dialog/edit-release-dialog.component';
import { TrackListDialogComponent } from '../track-list-dialog/track-list-dialog.component';
import { environment } from 'environments/environment';
import { ReleaseValidationService } from '../../../services/release-validation.service';
import { Song } from '../../../services/song.service';
import { ReleaseService } from '../../../services/release.service';

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
  standalone: true,
  imports: [CommonModule, EditReleaseDialogComponent, TrackListDialogComponent],
  templateUrl: './artist-releases-tab.component.html',
  styleUrl: './artist-releases-tab.component.scss'
})
export class ArtistReleasesTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  releases: ArtistRelease[] = [];
  loading = false;
  isAdmin = false;
  showEditDialog = false;
  showTrackListDialog = false;
  selectedRelease: ArtistRelease | null = null;
  loadingReleaseDetails = false;
  submittingReleaseId: number | null = null;
  downloadingMastersId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private validationService: ReleaseValidationService,
    private releaseService: ReleaseService
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
    // Always load full release details to ensure we have the artist data
    this.loadReleaseDetails(release);
  }

  private loadReleaseDetails(release: ArtistRelease): void {
    this.loadingReleaseDetails = true;
    
    this.http.get<{release: ArtistRelease}>(`${environment.apiUrl}/releases/${release.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.selectedRelease = data.release;
        this.loadingReleaseDetails = false;
        this.showEditDialog = true;
      },
      error: (error) => {
        console.error('Error loading release details:', error);
        this.loadingReleaseDetails = false;
        // Fall back to using the basic release data
        this.selectedRelease = release;
        this.showEditDialog = true;
        this.alertMessage.emit({
          type: 'error',
          message: 'Could not load full release details. Some information may be missing.'
        });
      }
    });
  }

  onEditDialogClose(): void {
    this.showEditDialog = false;
    this.selectedRelease = null;
  }

  onReleaseUpdated(updatedRelease: any): void {
    this.loadReleases();
    this.onEditDialogClose();
  }

  onManageTrackList(release: ArtistRelease): void {
    this.selectedRelease = release;
    this.showTrackListDialog = true;
  }

  onTrackListDialogClose(): void {
    this.showTrackListDialog = false;
    this.selectedRelease = null;
    // Reload releases to update validation state with any song changes
    this.loadReleases();
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
    const validation = this.validationService.validateRelease(release, release.songs);
    return this.validationService.getTooltipMessage(validation);
  }

  hasValidationIssues(release: ArtistRelease): boolean {
    const validation = this.validationService.validateRelease(release, release.songs);
    return validation.hasErrors || validation.hasWarnings;
  }

  hasValidationErrors(release: ArtistRelease): boolean {
    const validation = this.validationService.validateRelease(release, release.songs);
    return validation.hasErrors;
  }

  canSubmitForReview(release: ArtistRelease): boolean {
    return release.status === 'Draft' && !this.hasValidationErrors(release);
  }

  onSubmitForReview(release: ArtistRelease): void {
    if (!this.canSubmitForReview(release) || this.submittingReleaseId) {
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      'Once you submit for review, certain fields will be locked and no longer editable. ' +
      'You can still contact your label admin for changes. ' +
      'Do you want to proceed with submission?'
    );

    if (!confirmed) {
      return;
    }

    this.submittingReleaseId = release.id;
    this.releaseService.updateRelease(release.id, { status: 'For Submission' }).subscribe({
      next: () => {
        this.submittingReleaseId = null;
        this.alertMessage.emit({
          type: 'success',
          message: 'Release submitted for review successfully!'
        });
        this.loadReleases();
      },
      error: (error) => {
        console.error('Error submitting release:', error);
        this.submittingReleaseId = null;
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to submit release for review. Please try again.'
        });
      }
    });
  }

  navigateToCreateRelease(): void {
    this.router.navigate(['/artist/releases/new']);
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
      next: (blob) => {
        this.downloadingMastersId = null;

        // Get artist name for filename
        const artistName = release.artists && release.artists.length > 0
          ? release.artists[0].name
          : 'Unknown Artist';

        // Create filename: "catalog_no - artist name - release title.zip"
        const fileName = `${release.catalog_no} - ${artistName} - ${release.title}.zip`
          .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Create blob URL and trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

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
}