import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { SyncLicensingService, SyncLicensingPitch, SongForPitch } from '../../services/sync-licensing.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { PaginationInfo } from '../../components/shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-sync-licensing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sync-licensing.component.html',
  styleUrl: './sync-licensing.component.scss'
})
export class SyncLicensingComponent implements OnInit, OnDestroy {
  pitches: SyncLicensingPitch[] = [];
  loading = false;
  pagination: PaginationInfo | null = null;

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

  // Download state
  downloadingPitchId: number | null = null;

  private subscriptions = new Subscription();

  constructor(
    private syncLicensingService: SyncLicensingService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadPitches();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadPitches(page: number = 1): void {
    this.loading = true;
    this.subscriptions.add(
      this.syncLicensingService.getPitches(page).subscribe({
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

    this.downloadingPitchId = pitch.id;
    const url = this.syncLicensingService.getDownloadMastersUrl(pitch.id);

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Create a download link and trigger it
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${pitch.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_')}_masters.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        this.downloadingPitchId = null;
      },
      error: (error) => {
        console.error('Failed to download masters:', error);
        if (error.status === 404) {
          this.notificationService.showError('No songs with master audio found in this pitch');
        } else {
          this.notificationService.showError('Failed to download masters');
        }
        this.downloadingPitchId = null;
      }
    });
  }

  // Helpers
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

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
