import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SyncLicensingService, SyncLicensingPitch, SongForPitch } from '../../services/sync-licensing.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, TableAction, SearchFilters, SortInfo } from '../../components/shared/paginated-table/paginated-table.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-sync-licensing',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatedTableComponent, BreadcrumbComponent],
  templateUrl: './sync-licensing.component.html',
  styleUrl: './sync-licensing.component.scss'
})
export class SyncLicensingComponent implements OnInit, OnDestroy {
  pitches: SyncLicensingPitch[] = [];
  loading = false;
  pagination: PaginationInfo | null = null;

  // Search & sort state
  currentFilters: SearchFilters = {};
  currentSort: SortInfo | null = null;

  // Table columns configuration
  pitchColumns: TableColumn[] = [
    {
      key: 'title',
      label: 'Title',
      searchable: true,
      sortable: true,
      renderHtml: true,
      formatter: (pitch: any) => `<strong>${this.escapeHtml(pitch.title)}</strong>`,
      cardHeader: true
    },
    {
      key: 'description',
      label: 'Description',
      searchable: true,
      sortable: false,
      formatter: (pitch: any) => this.truncateText(pitch.description, 50)
    },
    {
      key: 'songs',
      label: 'Songs',
      align: 'center',
      searchable: false,
      sortable: false,
      renderHtml: true,
      formatter: (pitch: any) => {
        const songs: any[] = pitch.songs || [];
        const warnSongs = songs.filter(s => this.getSongWarnings(s).length > 0);
        const validSongs = songs.filter(s => this.getSongWarnings(s).length === 0);

        const validTooltip = validSongs.map(s => this.escapeHtml(s.title)).join('&#10;');
        let html = `<i class="fas fa-check-circle text-success me-1" title="${validTooltip}"></i>${validSongs.length}`;

        if (warnSongs.length > 0) {
          const warnTooltip = warnSongs
            .map(s => `${this.escapeHtml(s.title)}: ${this.getSongWarnings(s).join(', ')}`)
            .join('&#10;');
          html += ` <i class="fas fa-exclamation-triangle text-warning ms-2 me-1" title="${warnTooltip}"></i>${warnSongs.length}`;
        }

        return html;
      }
    },
    {
      key: 'creator',
      label: 'Created By',
      searchable: false,
      sortable: false,
      formatter: (pitch: any) => this.getCreatorName(pitch)
    },
    {
      key: 'createdAt',
      label: 'Created',
      searchable: false,
      sortable: true,
      formatter: (pitch: any) => {
        if (!pitch.createdAt) return '';
        return new Date(pitch.createdAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      }
    }
  ];

  // Modal state
  showPitchModal = false;
  editingPitch: SyncLicensingPitch | null = null;
  pitchForm = {
    title: '',
    description: ''
  };
  selectedSongs: SongForPitch[] = [];
  savingPitch = false;

  // Song search
  songSearchQuery = '';
  songSearchResults: SongForPitch[] = [];
  searchingSongs = false;

  pitchActions: TableAction[] = [
    {
      icon: 'fas fa-music',
      label: 'Download Masters',
      hidden: (item) => !item.songs?.length,
      handler: (item) => this.downloadMasters(item)
    },
    {
      icon: 'fas fa-file-alt',
      label: 'Download Lyrics',
      hidden: (item) => !item.songs?.length,
      handler: (item) => this.downloadLyrics(item)
    },
    {
      icon: 'fas fa-file-excel',
      label: 'Download B-Sheet',
      hidden: (item) => !item.songs?.length,
      handler: (item) => this.downloadBSheet(item)
    },
    {
      icon: 'fas fa-file-archive',
      label: 'Download All',
      hidden: (item) => !item.songs?.length,
      handler: (item) => this.downloadAll(item)
    },
    {
      icon: 'fas fa-edit',
      label: 'Edit',
      handler: (item) => this.openEditModal(item)
    },
    {
      icon: 'fas fa-trash',
      label: 'Delete',
      type: 'danger',
      handler: (item) => this.deletePitch(item)
    }
  ];

  // Download state - tracks which pitch/type combinations are currently downloading
  private downloadingSet = new Set<string>();
  openDownloadDropdownId: number | null = null;
  dropdownPosition: { top: number; right: number } | null = null;

  private subscriptions = new Subscription();
  private clickListener: ((event: MouseEvent) => void) | null = null;

  constructor(
    private syncLicensingService: SyncLicensingService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadPitches();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.closeDownloadDropdown();
  }

  loadPitches(page: number = 1): void {
    this.loading = true;
    this.subscriptions.add(
      this.syncLicensingService.getPitches({
        page,
        filters: this.currentFilters,
        sort_field: this.currentSort?.column,
        sort_order: this.currentSort?.direction
      }).subscribe({
        next: (response) => {
          this.pitches = response.pitches;
          this.pagination = {
            current_page: response.pagination.page,
            total_pages: response.pagination.totalPages,
            total_count: response.pagination.total,
            per_page: response.pagination.limit,
            has_next: response.pagination.page < response.pagination.totalPages,
            has_prev: response.pagination.page > 1
          };
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load pitches:', error);
          this.notificationService.showError('Failed to load sync licensing pitches');
          this.loading = false;
        }
      })
    );
  }

  onPageChange(page: number): void {
    this.loadPitches(page);
  }

  onFiltersChange(filters: SearchFilters): void {
    this.currentFilters = filters;
    this.loadPitches(1);
  }

  onSortChange(sort: SortInfo | null): void {
    this.currentSort = sort;
    this.loadPitches(1);
  }

  openCreateModal(): void {
    this.editingPitch = null;
    this.pitchForm = { title: '', description: '' };
    this.selectedSongs = [];
    this.songSearchQuery = '';
    this.songSearchResults = [];
    this.showPitchModal = true;
  }

  openEditModal(pitch: SyncLicensingPitch): void {
    this.editingPitch = pitch;
    this.pitchForm = {
      title: pitch.title,
      description: pitch.description || ''
    };
    this.selectedSongs = [...(pitch.songs || [])];
    this.songSearchQuery = '';
    this.songSearchResults = [];
    this.showPitchModal = true;
  }

  closeModal(): void {
    this.showPitchModal = false;
    this.editingPitch = null;
    this.pitchForm = { title: '', description: '' };
    this.selectedSongs = [];
  }

  searchSongs(): void {
    if (this.songSearchQuery.trim().length < 2) {
      this.songSearchResults = [];
      return;
    }

    this.searchingSongs = true;
    this.subscriptions.add(
      this.syncLicensingService.searchSongs(this.songSearchQuery).subscribe({
        next: (response) => {
          // Filter out already selected songs
          const selectedIds = new Set(this.selectedSongs.map(s => s.id));
          this.songSearchResults = response.songs.filter(s => !selectedIds.has(s.id));
          this.searchingSongs = false;
        },
        error: (error) => {
          console.error('Failed to search songs:', error);
          this.searchingSongs = false;
        }
      })
    );
  }

  addSong(song: SongForPitch): void {
    if (!this.selectedSongs.find(s => s.id === song.id)) {
      this.selectedSongs.push(song);
      // Remove from search results
      this.songSearchResults = this.songSearchResults.filter(s => s.id !== song.id);
    }
  }

  removeSong(song: SongForPitch): void {
    this.selectedSongs = this.selectedSongs.filter(s => s.id !== song.id);
  }

  savePitch(): void {
    if (!this.pitchForm.title.trim()) {
      this.notificationService.showError('Title is required');
      return;
    }

    this.savingPitch = true;
    const songIds = this.selectedSongs.map(s => s.id);

    if (this.editingPitch) {
      // Update existing pitch
      this.subscriptions.add(
        this.syncLicensingService.updatePitch(this.editingPitch.id, {
          title: this.pitchForm.title,
          description: this.pitchForm.description,
          song_ids: songIds
        }).subscribe({
          next: () => {
            this.notificationService.showSuccess('Pitch updated successfully');
            this.closeModal();
            this.loadPitches(this.pagination?.current_page || 1);
            this.savingPitch = false;
          },
          error: (error) => {
            console.error('Failed to update pitch:', error);
            this.notificationService.showError('Failed to update pitch');
            this.savingPitch = false;
          }
        })
      );
    } else {
      // Create new pitch
      this.subscriptions.add(
        this.syncLicensingService.createPitch({
          title: this.pitchForm.title,
          description: this.pitchForm.description,
          song_ids: songIds
        }).subscribe({
          next: () => {
            this.notificationService.showSuccess('Pitch created successfully');
            this.closeModal();
            this.loadPitches();
            this.savingPitch = false;
          },
          error: (error) => {
            console.error('Failed to create pitch:', error);
            this.notificationService.showError('Failed to create pitch');
            this.savingPitch = false;
          }
        })
      );
    }
  }

  async deletePitch(pitch: SyncLicensingPitch): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Pitch',
      message: `Are you sure you want to delete "${pitch.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    this.subscriptions.add(
      this.syncLicensingService.deletePitch(pitch.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Pitch deleted successfully');
          this.loadPitches(this.pagination?.current_page || 1);
        },
        error: (error) => {
          console.error('Failed to delete pitch:', error);
          this.notificationService.showError('Failed to delete pitch');
        }
      })
    );
  }

  downloadMasters(pitch: SyncLicensingPitch): void {
    if (!pitch.songs?.length) {
      this.notificationService.showError('No songs in this pitch');
      return;
    }

    const key = `${pitch.id}-masters`;
    this.downloadingSet.add(key);

    this.subscriptions.add(
      this.syncLicensingService.downloadMasters(pitch).subscribe({
        next: () => this.downloadingSet.delete(key),
        error: (error) => {
          console.error('Failed to download masters:', error);
          this.notificationService.showError(
            error.status === 404 ? 'No songs with master audio found in this pitch' : 'Failed to download masters'
          );
          this.downloadingSet.delete(key);
        }
      })
    );
  }

  downloadLyrics(pitch: SyncLicensingPitch): void {
    if (!pitch.songs?.length) {
      this.notificationService.showError('No songs in this pitch');
      return;
    }

    const key = `${pitch.id}-lyrics`;
    this.downloadingSet.add(key);

    this.subscriptions.add(
      this.syncLicensingService.downloadLyrics(pitch).subscribe({
        next: () => this.downloadingSet.delete(key),
        error: (error) => {
          console.error('Failed to download lyrics:', error);
          this.notificationService.showError(
            error.status === 404 ? 'No songs with lyrics found in this pitch' : 'Failed to download lyrics'
          );
          this.downloadingSet.delete(key);
        }
      })
    );
  }

  downloadBSheet(pitch: SyncLicensingPitch): void {
    if (!pitch.songs?.length) {
      this.notificationService.showError('No songs in this pitch');
      return;
    }

    const key = `${pitch.id}-bsheet`;
    this.downloadingSet.add(key);

    this.subscriptions.add(
      this.syncLicensingService.downloadBSheet(pitch).subscribe({
        next: () => this.downloadingSet.delete(key),
        error: (error) => {
          console.error('Failed to download B-Sheet:', error);
          this.notificationService.showError(
            error.status === 404 ? 'No songs found in this pitch' : 'Failed to download B-Sheet'
          );
          this.downloadingSet.delete(key);
        }
      })
    );
  }

  downloadAll(pitch: SyncLicensingPitch): void {
    if (!pitch.songs?.length) {
      this.notificationService.showError('No songs in this pitch');
      return;
    }

    this.downloadMasters(pitch);
    this.downloadLyrics(pitch);
    this.downloadBSheet(pitch);
  }

  // Methods that use the stored dropdown pitch ID
  private getOpenPitch(): SyncLicensingPitch | null {
    if (!this.openDownloadDropdownId) return null;
    return this.pitches.find(p => p.id === this.openDownloadDropdownId) || null;
  }

  downloadMastersById(): void {
    const pitch = this.getOpenPitch();
    if (pitch) this.downloadMasters(pitch);
  }

  downloadLyricsById(): void {
    const pitch = this.getOpenPitch();
    if (pitch) this.downloadLyrics(pitch);
  }

  downloadBSheetById(): void {
    const pitch = this.getOpenPitch();
    if (pitch) this.downloadBSheet(pitch);
  }

  downloadAllById(): void {
    const pitch = this.getOpenPitch();
    if (pitch) this.downloadAll(pitch);
  }

  isDownloading(pitchId: number): boolean {
    return this.downloadingSet.has(`${pitchId}-masters`) ||
           this.downloadingSet.has(`${pitchId}-lyrics`) ||
           this.downloadingSet.has(`${pitchId}-bsheet`);
  }

  toggleDownloadDropdown(event: MouseEvent, pitchId: number, buttonElement: HTMLElement): void {
    event.stopPropagation();
    if (this.openDownloadDropdownId === pitchId) {
      this.closeDownloadDropdown();
    } else {
      this.openDownloadDropdownId = pitchId;
      // Calculate position based on button location
      const rect = buttonElement.getBoundingClientRect();

      // Calculate right position from viewport's right edge
      // This aligns the dropdown's right edge with the button's right edge
      const rightFromViewport = window.innerWidth - rect.right;

      this.dropdownPosition = {
        top: rect.bottom + 4,
        right: rightFromViewport
      };
      // Add click listener to close dropdown when clicking outside
      setTimeout(() => {
        this.clickListener = (e: MouseEvent) => {
          this.closeDownloadDropdown();
        };
        document.addEventListener('click', this.clickListener);
      });
    }
  }

  closeDownloadDropdown(): void {
    this.openDownloadDropdownId = null;
    this.dropdownPosition = null;
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
  }

  // Helpers
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  truncateText(text: string | undefined, maxLength: number): string {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getCreatorName(pitch: SyncLicensingPitch): string {
    if (!pitch.creator) return '-';
    const { first_name, last_name, username } = pitch.creator;
    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    return username || '-';
  }

  getArtistNames(song: SongForPitch): string {
    if (!song.release?.artists?.length) return 'Unknown Artist';
    return song.release.artists.map(a => a.name).join(', ');
  }

  getSongWarnings(song: SongForPitch): string[] {
    const warnings: string[] = [];
    if (!song.isrc) warnings.push('No ISRC');
    if (!song.lyrics) warnings.push('No lyrics');
    if (!song.authors?.length) warnings.push('No authors');
    if (!song.composers?.length) warnings.push('No composers');
    return warnings;
  }

  getPitchWarnings(pitch: SyncLicensingPitch): string {
    if (!pitch.songs?.length) return '';

    const songWarnings: string[] = [];
    for (const song of pitch.songs) {
      const warnings = this.getSongWarnings(song);
      if (warnings.length) {
        songWarnings.push(`${song.title}: ${warnings.join(', ')}`);
      }
    }
    return songWarnings.join('\n');
  }

  hasPitchWarnings(pitch: SyncLicensingPitch): boolean {
    if (!pitch.songs?.length) return false;
    return pitch.songs.some(song => this.getSongWarnings(song).length > 0);
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // TrackBy functions for *ngFor performance
  trackByPitchId(index: number, pitch: SyncLicensingPitch): number {
    return pitch.id;
  }

  trackBySongId(index: number, song: SongForPitch): number {
    return song.id;
  }
}
