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
import { PaginatedTableComponent, TableAction, TableColumn } from '../../shared/paginated-table/paginated-table.component';

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
    imports: [CommonModule, FormsModule, PaginatedTableComponent],
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

  get releaseColumns(): TableColumn[] {
    return [
      {
        key: 'catalog_no',
        label: 'Catalog #',
        searchable: false,
        renderHtml: true,
        cardHeader: true
      },
      {
        key: 'cover_art',
        label: 'Release',
        searchable: false,
        renderHtml: true,
        hideDataLabel: true,
        formatter: (release: ArtistRelease) => {
          const url = this.getCoverArtUrl(release.cover_art);
          const alt = release.title.replace(/"/g, '&quot;');
          const stripped = release.description ? this.stripHtmlTags(release.description) : '';
          const desc = stripped ? `<div class="release-description">${stripped}</div>` : '';
          return `<div class="release-cell"><img src="${url}" alt="${alt}" class="release-cover-thumbnail"><div class="release-cell-text"><div class="release-title">${release.title}</div>${desc}</div></div>`;
        }
      },
      {
        key: 'UPC',
        label: 'UPC',
        searchable: false,
        renderHtml: true,
        formatter: (release: ArtistRelease) =>
          `<span class="catalog-number">${release.UPC || '—'}</span>`
      },
      {
        key: 'release_date',
        label: 'Release Date',
        searchable: false,
        formatter: (release: ArtistRelease) => this.formatDate(release.release_date)
      },
      {
        key: 'status',
        label: 'Status',
        searchable: false,
        renderHtml: true,
        formatter: (release: ArtistRelease) => {
          const statusClass = this.getStatusClass(release.status);
          const statusIcon = this.getStatusIcon(release.status);
          let html = `<span class="badge ${statusClass}"><i class="fa ${statusIcon}"></i> ${release.status}</span>`;
          if (this.hasValidationIssues(release)) {
            const tooltip = this.getValidationTooltip(release).replace(/"/g, '&quot;');
            if (this.hasValidationErrors(release)) {
              html += ` <i class="fa fa-exclamation-circle text-danger ms-2" title="${tooltip}"></i>`;
            } else {
              html += ` <i class="fa fa-exclamation-triangle text-warning ms-2" title="${tooltip}"></i>`;
            }
          }
          return html;
        }
      }
    ];
  }

  get releaseActions(): TableAction[] {
    return [
      {
        icon: 'fa-solid fa-paper-plane',
        label: 'Submit for Review',
        type: 'primary',
        handler: (release: ArtistRelease) => this.onSubmitForReview(release),
        hidden: (release: ArtistRelease) => !this.canSubmitForReview(release)
      },
      {
        icon: 'fa-solid fa-edit',
        label: 'Edit Release',
        handler: (release: ArtistRelease) => this.onEditRelease(release),
        hidden: (release: ArtistRelease) => !this.canEditRelease(release)
      },
      {
        icon: 'fa-solid fa-eye',
        label: 'View Release',
        handler: (release: ArtistRelease) => this.onEditRelease(release),
        hidden: (release: ArtistRelease) => this.canEditRelease(release)
      },
      {
        icon: 'fa-solid fa-music',
        label: 'Manage Track List',
        handler: (release: ArtistRelease) => this.onManageTrackList(release),
        hidden: (release: ArtistRelease) => !this.canEditRelease(release)
      },
      {
        icon: 'fa-solid fa-download',
        label: 'Download Masters',
        handler: (release: ArtistRelease) => this.onDownloadMasters(release),
        hidden: (release: ArtistRelease) => !this.hasMasters(release) || this.downloadingMastersId === release.id
      },
      {
        icon: 'fa-solid fa-spinner fa-spin',
        label: 'Downloading...',
        type: 'secondary',
        handler: () => {},
        hidden: (release: ArtistRelease) => this.downloadingMastersId !== release.id
      },
      {
        icon: 'fa-solid fa-globe',
        label: 'Include in EPK',
        handler: (release: ArtistRelease) => this.toggleExcludeFromEPK(release),
        hidden: (release: ArtistRelease) => !release.exclude_from_epk
      },
      {
        icon: 'fa-solid fa-eye-slash',
        label: 'Exclude from EPK',
        handler: (release: ArtistRelease) => this.toggleExcludeFromEPK(release),
        hidden: (release: ArtistRelease) => !!release.exclude_from_epk
      },
      {
        icon: 'fa-solid fa-trash',
        label: 'Delete',
        type: 'danger',
        handler: (release: ArtistRelease) => this.onDeleteRelease(release),
        hidden: (release: ArtistRelease) => !this.canDeleteRelease(release)
      }
    ];
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
    this.router.navigate(['/music/releases/edit', release.id]);
  }

  onManageTrackList(release: ArtistRelease): void {
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
      case 'Live': return 'badge-success';
      case 'For Submission': return 'badge-info';
      case 'Pending': return 'badge-warning';
      case 'Draft': return 'badge-secondary';
      case 'Taken Down': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Live': return 'fa-check-circle';
      case 'For Submission': return 'fa-paper-plane';
      case 'Pending': return 'fa-clock';
      case 'Draft': return 'fa-file';
      case 'Taken Down': return 'fa-ban';
      default: return 'fa-question-circle';
    }
  }

  getValidationTooltip(release: ArtistRelease): string {
    const releaseValidation = this.validationService.validateRelease(release, true);
    const songsValidation = release.songs ? this.validationService.validateSongs(release.songs) : { errors: [], warnings: [], hasErrors: false, hasWarnings: false };

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
    this.router.navigate(['/music/releases/edit', release.id], {
      queryParams: { section: 'submit' }
    });
  }

  navigateToCreateRelease(): void {
    this.router.navigate(['/music/releases/new']);
  }

  stripHtmlTags(html: string): string {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  hasMasters(release: ArtistRelease): boolean {
    if (release.cover_art && release.cover_art.trim() !== '') {
      return true;
    }
    if (release.songs && release.songs.length > 0) {
      return release.songs.some(song => song.audio_file && song.audio_file.trim() !== '');
    }
    return false;
  }

  onDownloadMasters(release: ArtistRelease): void {
    if (this.downloadingMastersId || !this.hasMasters(release)) {
      return;
    }

    this.downloadingMastersId = release.id;

    this.releaseService.downloadMasters(release.id).subscribe({
      next: (response) => {
        this.downloadingMastersId = null;
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
    return release.status === 'Draft';
  }

  canDeleteRelease(release: ArtistRelease): boolean {
    return this.isAdmin && release.status === 'Draft';
  }

  async onDeleteRelease(release: ArtistRelease): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Release',
      message: `Are you sure you want to delete "${release.title}"? This will permanently remove the release and all associated tracks, earnings, and other related data. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      this.releaseService.deleteRelease(release.id).subscribe({
        next: () => {
          this.alertMessage.emit({
            type: 'success',
            message: `Release "${release.title}" has been deleted.`
          });
          this.loadReleases();
        },
        error: (error) => {
          console.error('Error deleting release:', error);
          let errorMessage = 'Failed to delete release.';
          if (error.error?.error) {
            errorMessage = error.error.error;
          }
          this.alertMessage.emit({
            type: 'error',
            message: errorMessage
          });
        }
      });
    }
  }
}
