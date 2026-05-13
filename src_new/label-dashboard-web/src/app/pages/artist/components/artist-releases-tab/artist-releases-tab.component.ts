import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Artist } from '../../../../models/artist.model';
import { environment } from 'environments/environment';
import { ReleaseValidationService } from '../../../../services/release-validation.service';
import { Song } from '../../../../services/song.service';
import { ReleaseService } from '../../../../services/release.service';
import { downloadFromResponse } from '../../../../utils/file-utils';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { PaginatedTableComponent, TableAction, TableColumn, HeaderAction } from '../../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';
import { InPageNavComponent, InPageNavTab } from '../../../../components/shared/in-page-nav/in-page-nav.component';

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
    imports: [CommonModule, FormsModule, PaginatedTableComponent, IconComponent, InPageNavComponent],
    templateUrl: './artist-releases-tab.component.html',
    styleUrl: './artist-releases-tab.component.scss'
})
export class ArtistReleasesTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();
  releases: ArtistRelease[] = [];
  epkFilter: 'all' | 'visible' | 'hidden' = 'all';
  activeStatus: string = '';
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

  private readonly statusOrder = ['Draft', 'For Submission', 'Pending', 'Live', 'Taken Down'];

  private readonly statusIcons: Record<string, string> = {
    'Draft': 'file',
    'For Submission': 'paper-plane',
    'Pending': 'clock',
    'Live': 'globe',
    'Taken Down': 'ban',
  };

  get statusTabs(): InPageNavTab[] {
    return this.statusOrder
      .filter(status => this.releases.some(r => r.status === status))
      .map(status => ({ id: status, label: status, icon: this.statusIcons[status] ?? 'circle' }));
  }

  get filteredReleases(): ArtistRelease[] {
    let releases = this.releases.filter(r => r.status === this.activeStatus);
    if (this.epkFilter === 'visible') {
      releases = releases.filter(r => !r.exclude_from_epk);
    } else if (this.epkFilter === 'hidden') {
      releases = releases.filter(r => r.exclude_from_epk);
    }
    return releases;
  }

  onStatusTabChange(id: string): void {
    this.activeStatus = id;
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
          let html = `<span class="${statusClass}">${release.status}</span>`;
          if (release.exclude_from_epk) {
            html += ` <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tw-text-gray-400" style="display:inline-block;vertical-align:middle;margin-left:6px" title="Hidden from EPK"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
          }
          if (this.hasValidationIssues(release)) {
            const tooltip = this.getValidationTooltip(release).replace(/"/g, '&quot;');
            if (this.hasValidationErrors(release)) {
              html += ` <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tw-text-red-500" style="display:inline-block;vertical-align:middle;margin-left:6px" title="${tooltip}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
            } else {
              html += ` <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tw-text-amber-500" style="display:inline-block;vertical-align:middle;margin-left:6px" title="${tooltip}"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            }
          }
          return html;
        }
      }
    ];
  }

  get headerActions(): HeaderAction[] {
    if (!this.artist) return [];
    return [{
      icon: () => this.isAdmin ? 'plus' : 'upload',
      label: () => this.isAdmin ? 'Create Release' : 'Submit Release',
      handler: () => this.navigateToCreateRelease(),
      title: () => this.isAdmin ? 'Create new release' : 'Submit release for review',
      type: 'primary' as const,
    }];
  }

  get releaseActions(): TableAction[] {
    return [
      {
        icon: 'paper-plane',
        label: 'Submit for Review',
        type: 'primary',
        handler: (release: ArtistRelease) => this.onSubmitForReview(release),
        hidden: (release: ArtistRelease) => !this.canSubmitForReview(release)
      },
      {
        icon: 'edit',
        label: 'Edit Release',
        handler: (release: ArtistRelease) => this.onEditRelease(release),
        hidden: (release: ArtistRelease) => !this.canEditRelease(release)
      },
      {
        icon: 'eye',
        label: 'View Release',
        handler: (release: ArtistRelease) => this.onEditRelease(release),
        hidden: (release: ArtistRelease) => this.canEditRelease(release)
      },
      {
        icon: 'music',
        label: 'Manage Track List',
        handler: (release: ArtistRelease) => this.onManageTrackList(release),
        hidden: (release: ArtistRelease) => !this.canEditRelease(release)
      },
      {
        icon: 'download',
        label: 'Download Masters',
        handler: (release: ArtistRelease) => this.onDownloadMasters(release),
        hidden: (release: ArtistRelease) => !this.hasMasters(release) || this.downloadingMastersId === release.id
      },
      {
        icon: 'spinner',
        label: 'Downloading...',
        type: 'secondary',
        handler: () => {},
        hidden: (release: ArtistRelease) => this.downloadingMastersId !== release.id
      },
      {
        icon: 'globe',
        label: 'Include in EPK',
        handler: (release: ArtistRelease) => this.toggleExcludeFromEPK(release),
        hidden: (release: ArtistRelease) => !release.exclude_from_epk
      },
      {
        icon: 'eye-off',
        label: 'Exclude from EPK',
        handler: (release: ArtistRelease) => this.toggleExcludeFromEPK(release),
        hidden: (release: ArtistRelease) => !!release.exclude_from_epk
      },
      {
        icon: 'trash',
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
        if (!this.activeStatus || !this.releases.some(r => r.status === this.activeStatus)) {
          this.activeStatus = this.statusTabs[0]?.id ?? '';
        }
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
      case 'Live':           return 'status-badge status-success';
      case 'For Submission': return 'status-badge status-info';
      case 'Pending':        return 'status-badge status-warning';
      case 'Draft':          return 'status-badge status-secondary';
      case 'Taken Down':     return 'status-badge status-danger';
      default:               return 'status-badge status-secondary';
    }
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'Live':           return 'status-badge status-success';
      case 'For Submission': return 'status-badge status-info';
      case 'Pending':        return 'status-badge status-warning';
      case 'Draft':          return 'status-badge status-secondary';
      case 'Taken Down':     return 'status-badge status-danger';
      default:               return 'status-badge status-secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Live': return 'check-circle';
      case 'For Submission': return 'paper-plane';
      case 'Pending': return 'clock';
      case 'Draft': return 'file';
      case 'Taken Down': return 'ban';
      default: return 'question-circle';
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
