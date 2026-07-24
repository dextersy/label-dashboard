import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { PressCampaignService } from '../../services/press-campaign.service';
import { PressCampaign } from '../../models/press-campaign.model';
import { PaginatedTableComponent, TableColumn, TableAction, PaginationInfo, SearchFilters, SortInfo, HeaderAction } from '../../components/shared/paginated-table/paginated-table.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../components/shared/icon/icon.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-press-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule, PaginatedTableComponent, BreadcrumbComponent, IconComponent],
  templateUrl: './press-campaigns.component.html',
  styleUrl: './press-campaigns.component.scss',
})
export class PressCampaignsComponent implements OnInit, OnDestroy {
  campaigns: PressCampaign[] = [];
  loading = false;
  pagination: PaginationInfo | null = null;
  currentFilters: SearchFilters = {};
  currentSort: SortInfo | null = null;

  // Brand feature flags
  hasReleases = true;
  hasEvents = false;

  readonly quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote'],
      ['clean'],
    ],
  };

  // Create/Edit modal
  showModal = false;
  editingCampaign: PressCampaign | null = null;
  saving = false;
  campaignForm = {
    title: '',
    writeup: '',
    status: 'Draft' as 'Draft' | 'Published',
    campaign_type: 'release' as 'release' | 'event',
    release_id: null as number | null,
    artist_id: null as number | null,
    event_id: null as number | null,
  };

  // Search state for form dropdowns
  releaseSearchQuery = '';
  releaseSearchResults: any[] = [];
  searchingReleases = false;
  selectedRelease: any = null;

  // Artist search (only for event campaigns)
  artistSearchQuery = '';
  artistSearchResults: any[] = [];
  searchingArtists = false;
  selectedArtist: any = null;

  eventSearchQuery = '';
  eventSearchResults: any[] = [];
  searchingEvents = false;
  selectedEvent: any = null;

  private releaseSearch$ = new Subject<string>();
  private artistSearch$ = new Subject<string>();
  private eventSearch$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Detail/manage modal
  showDetailModal = false;
  detailCampaign: PressCampaign | null = null;
  loadingDetail = false;
  uploadingCoverArt = false;
  uploadingMp3 = false;
  uploadingPhoto = false;
  photoLabelInput = '';
  photosExpanded = true;
  downloadingWord = false;

  readonly columns: TableColumn[] = [
    {
      key: 'title',
      label: 'Campaign',
      sortable: true,
      searchable: true,
      cardHeader: true,
      renderHtml: true,
      formatter: (c: PressCampaign) => {
        const typeBadge = c.campaign_type === 'event'
          ? `<span class="status-badge status-info tw-mr-1">Event</span>`
          : `<span class="status-badge status-secondary tw-mr-1">Release</span>`;
        const status = c.status === 'Published'
          ? `<span class="status-badge status-success tw-ml-1">Published</span>`
          : `<span class="status-badge status-warning tw-ml-1">Draft</span>`;
        return `<strong>${c.title}</strong> ${typeBadge}${status}`;
      },
    },
    {
      key: 'artist',
      label: 'Artist',
      formatter: (c: PressCampaign) => c.artist?.name || '—',
    },
    {
      key: 'linked',
      label: 'Linked To',
      formatter: (c: PressCampaign) => {
        if (c.campaign_type === 'event') return c.event?.title || '—';
        return c.release?.title || '—';
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      renderHtml: true,
      formatter: (c: PressCampaign) =>
        c.status === 'Published'
          ? '<span class="status-badge status-success">Published</span>'
          : '<span class="status-badge status-warning">Draft</span>',
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      formatter: (c: PressCampaign) =>
        c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
    },
  ];

  readonly actions: TableAction[] = [
    { icon: 'edit', label: 'Manage / Upload Files', primary: true, handler: (c: PressCampaign) => this.openDetailModal(c) },
    { icon: 'file', label: 'Download Press Release (.docx)', handler: (c: PressCampaign) => this.downloadWord(c) },
    { icon: 'link', label: 'View Public Page', handler: (c: PressCampaign) => this.openPublicPage(c) },
    { icon: 'edit', label: 'Edit Details', handler: (c: PressCampaign) => this.openEditModal(c) },
    { icon: 'trash', label: 'Delete', type: 'danger', handler: (c: PressCampaign) => this.deleteCampaign(c) },
  ];

  readonly headerActions: HeaderAction[] = [
    { icon: 'plus', label: 'New Campaign', type: 'primary', handler: () => this.openCreateModal() },
  ];

  constructor(
    private pressCampaignService: PressCampaignService,
    private brandService: BrandService,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadCampaigns();
    this.setupSearch();
    this.loadBrandFeatures();
  }

  private loadBrandFeatures(): void {
    const settings = this.brandService.getCurrentBrandSettings();
    if (settings) this.applyBrandSettings(settings);
    this.brandService.brandSettings$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      if (s) this.applyBrandSettings(s);
    });
  }

  private applyBrandSettings(settings: BrandSettings): void {
    this.hasReleases = settings.feature_music_releases !== false;
    // No dedicated events feature flag exists in BrandSettings; default to true.
    // Brands without events will simply get no results from the event search.
    this.hasEvents = true;
    // Default campaign_type to whichever is available
    if (!this.hasReleases && this.hasEvents) {
      this.campaignForm.campaign_type = 'event';
    } else {
      this.campaignForm.campaign_type = 'release';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch(): void {
    this.releaseSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(q => {
      if (q.length >= 1) {
        this.searchingReleases = true;
        this.pressCampaignService.searchReleases(q).subscribe({
          next: r => { this.releaseSearchResults = r.releases; this.searchingReleases = false; },
          error: () => { this.searchingReleases = false; },
        });
      } else {
        this.releaseSearchResults = [];
      }
    });

    this.artistSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(q => {
      if (q.length >= 1) {
        this.searchingArtists = true;
        this.pressCampaignService.searchArtists(q).subscribe({
          next: r => { this.artistSearchResults = r.artists; this.searchingArtists = false; },
          error: () => { this.searchingArtists = false; },
        });
      } else {
        this.artistSearchResults = [];
      }
    });

    this.eventSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(q => {
      if (q.length >= 1) {
        this.searchingEvents = true;
        this.pressCampaignService.searchEvents(q).subscribe({
          next: r => { this.eventSearchResults = r.events; this.searchingEvents = false; },
          error: () => { this.searchingEvents = false; },
        });
      } else {
        this.eventSearchResults = [];
      }
    });
  }

  loadCampaigns(page = 1): void {
    this.loading = true;
    this.pressCampaignService.getCampaigns({
      page,
      limit: 20,
      sort_field: this.currentSort?.column,
      sort_order: this.currentSort?.direction?.toUpperCase(),
      title: this.currentFilters['title'],
    }).subscribe({
      next: res => {
        this.campaigns = res.campaigns;
        const p = res.pagination;
        this.pagination = {
          current_page: p.page,
          total_pages: p.totalPages,
          total_count: p.total,
          per_page: p.limit,
          has_next: p.page < p.totalPages,
          has_prev: p.page > 1,
        };
        this.loading = false;
      },
      error: () => { this.loading = false; this.notification.showError('Failed to load campaigns.'); },
    });
  }

  onPageChange(page: number): void {
    this.loadCampaigns(page);
  }

  onFiltersChange(filters: SearchFilters): void {
    this.currentFilters = filters;
    this.loadCampaigns(1);
  }

  onSortChange(sort: SortInfo | null): void {
    this.currentSort = sort;
    this.loadCampaigns(1);
  }

  // --- Create / Edit modal ---

  openCreateModal(): void {
    this.editingCampaign = null;
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(campaign: PressCampaign): void {
    this.editingCampaign = campaign;
    this.campaignForm = {
      title: campaign.title,
      writeup: campaign.writeup || '',
      status: campaign.status,
      campaign_type: campaign.campaign_type || 'release',
      release_id: campaign.release_id || null,
      artist_id: campaign.artist_id || null,
      event_id: campaign.event_id || null,
    };
    this.selectedRelease = campaign.release || null;
    this.selectedArtist = campaign.artist || null;
    this.selectedEvent = campaign.event || null;
    this.releaseSearchQuery = campaign.release?.title || '';
    this.artistSearchQuery = campaign.artist?.name || '';
    this.eventSearchQuery = campaign.event?.title || '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCampaign = null;
  }

  resetForm(): void {
    const defaultType = (!this.hasReleases && this.hasEvents) ? 'event' : 'release';
    this.campaignForm = { title: '', writeup: '', status: 'Draft', campaign_type: defaultType, release_id: null, artist_id: null, event_id: null };
    this.selectedRelease = null;
    this.selectedArtist = null;
    this.selectedEvent = null;
    this.releaseSearchQuery = '';
    this.artistSearchQuery = '';
    this.eventSearchQuery = '';
    this.releaseSearchResults = [];
    this.artistSearchResults = [];
    this.eventSearchResults = [];
  }

  onCampaignTypeChange(): void {
    // Clear type-specific fields when switching
    if (this.campaignForm.campaign_type === 'release') {
      this.selectedEvent = null;
      this.selectedArtist = null;
      this.campaignForm.event_id = null;
      this.campaignForm.artist_id = null;
      this.eventSearchQuery = '';
      this.artistSearchQuery = '';
      this.eventSearchResults = [];
      this.artistSearchResults = [];
    } else {
      this.selectedRelease = null;
      this.campaignForm.release_id = null;
      this.releaseSearchQuery = '';
      this.releaseSearchResults = [];
    }
  }

  saveCampaign(): void {
    if (!this.campaignForm.title.trim()) return;
    this.saving = true;

    const isEvent = this.campaignForm.campaign_type === 'event';
    const data = {
      title: this.campaignForm.title.trim(),
      writeup: this.campaignForm.writeup || undefined,
      status: this.campaignForm.status,
      campaign_type: this.campaignForm.campaign_type,
      release_id: isEvent ? null : (this.campaignForm.release_id || null),
      artist_id: isEvent ? (this.campaignForm.artist_id || null) : null,
      event_id: isEvent ? (this.campaignForm.event_id || null) : null,
    };

    const request = this.editingCampaign
      ? this.pressCampaignService.updateCampaign(this.editingCampaign.id, data)
      : this.pressCampaignService.createCampaign(data);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.loadCampaigns();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.error || 'Failed to save campaign.';
        this.notification.showError(msg);
      },
    });
  }

  deleteCampaign(campaign: PressCampaign): void {
    if (!confirm(`Delete "${campaign.title}"? This cannot be undone.`)) return;
    this.pressCampaignService.deleteCampaign(campaign.id).subscribe({
      next: () => this.loadCampaigns(),
      error: () => this.notification.showError('Failed to delete campaign.'),
    });
  }

  // --- Release search ---

  onReleaseSearch(): void {
    this.releaseSearch$.next(this.releaseSearchQuery);
  }

  selectRelease(release: any): void {
    this.selectedRelease = release;
    this.campaignForm.release_id = release.id;
    this.releaseSearchQuery = release.title;
    this.releaseSearchResults = [];
  }

  clearRelease(): void {
    this.selectedRelease = null;
    this.campaignForm.release_id = null;
    this.releaseSearchQuery = '';
    this.releaseSearchResults = [];
  }

  // --- Artist search (event campaigns only) ---

  onArtistSearch(): void {
    this.artistSearch$.next(this.artistSearchQuery);
  }

  selectArtist(artist: any): void {
    this.selectedArtist = artist;
    this.campaignForm.artist_id = artist.id;
    this.artistSearchQuery = artist.name;
    this.artistSearchResults = [];
  }

  clearArtist(): void {
    this.selectedArtist = null;
    this.campaignForm.artist_id = null;
    this.artistSearchQuery = '';
    this.artistSearchResults = [];
  }

  // --- Event search ---

  onEventSearch(): void {
    this.eventSearch$.next(this.eventSearchQuery);
  }

  selectEvent(event: any): void {
    this.selectedEvent = event;
    this.campaignForm.event_id = event.id;
    this.eventSearchQuery = event.title;
    this.eventSearchResults = [];
  }

  clearEvent(): void {
    this.selectedEvent = null;
    this.campaignForm.event_id = null;
    this.eventSearchQuery = '';
    this.eventSearchResults = [];
  }

  getEventDateDisplay(event: any): string {
    if (!event?.date_and_time) return '';
    return new Date(event.date_and_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // --- Detail / manage modal ---

  openDetailModal(campaign: PressCampaign): void {
    this.detailCampaign = null;
    this.showDetailModal = true;
    this.loadingDetail = true;
    this.pressCampaignService.getCampaign(campaign.id).subscribe({
      next: res => { this.detailCampaign = res.campaign; this.loadingDetail = false; },
      error: () => { this.loadingDetail = false; this.notification.showError('Failed to load campaign details.'); },
    });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailCampaign = null;
  }

  onCoverArtSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.detailCampaign) return;
    this.uploadingCoverArt = true;
    this.pressCampaignService.uploadCoverArt(this.detailCampaign.id, file).subscribe({
      next: res => {
        if (this.detailCampaign) this.detailCampaign.cover_art = res.cover_art;
        this.uploadingCoverArt = false;
        this.loadCampaigns();
      },
      error: () => { this.uploadingCoverArt = false; this.notification.showError('Failed to upload cover art.'); },
    });
    input.value = '';
  }

  onMp3Selected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.detailCampaign) return;
    this.uploadingMp3 = true;
    this.pressCampaignService.uploadMp3(this.detailCampaign.id, file).subscribe({
      next: res => {
        if (this.detailCampaign) this.detailCampaign.mp3_file = res.mp3_file;
        this.uploadingMp3 = false;
        this.loadCampaigns();
      },
      error: () => { this.uploadingMp3 = false; this.notification.showError('Failed to upload audio file.'); },
    });
    input.value = '';
  }

  onArtistPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.detailCampaign) return;
    this.uploadingPhoto = true;
    this.pressCampaignService.uploadArtistPhoto(this.detailCampaign.id, file, this.photoLabelInput || undefined).subscribe({
      next: res => {
        if (this.detailCampaign) {
          if (!this.detailCampaign.artistPhotos) this.detailCampaign.artistPhotos = [];
          this.detailCampaign.artistPhotos.push(res.photo);
        }
        this.uploadingPhoto = false;
        this.photoLabelInput = '';
        this.loadCampaigns();
      },
      error: () => { this.uploadingPhoto = false; this.notification.showError('Failed to upload photo.'); },
    });
    input.value = '';
  }

  deleteArtistPhoto(photoId: number): void {
    if (!this.detailCampaign) return;
    this.pressCampaignService.deleteArtistPhoto(this.detailCampaign.id, photoId).subscribe({
      next: () => {
        if (this.detailCampaign) {
          this.detailCampaign.artistPhotos = this.detailCampaign.artistPhotos?.filter(p => p.id !== photoId);
        }
      },
      error: () => this.notification.showError('Failed to delete photo.'),
    });
  }

  downloadWord(campaign: PressCampaign): void {
    this.downloadingWord = true;
    this.pressCampaignService.downloadWordDoc(campaign).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = campaign.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
        a.download = `${safeName}-Press-Release.docx`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingWord = false;
      },
      error: () => { this.downloadingWord = false; this.notification.showError('Failed to generate Word document.'); },
    });
  }

  openPublicPage(campaign: PressCampaign): void {
    window.open(`/press/${campaign.public_slug}`, '_blank');
  }

  get effectiveCoverArt(): string | null {
    return this.detailCampaign?.release?.cover_art
      || this.detailCampaign?.event?.poster_url
      || null;
  }

  get releaseSongsWithAudio(): any[] {
    return (this.detailCampaign?.release?.songs || [])
      .filter((s: any) => s.audio_file_mp3)
      .sort((a: any, b: any) => (a.ReleaseSong?.track_number || 0) - (b.ReleaseSong?.track_number || 0));
  }

  get isEventCampaign(): boolean {
    return this.detailCampaign?.campaign_type === 'event';
  }

  getReleaseArtistNames(release: any): string {
    return release.artists?.map((a: any) => a.name).join(', ') || '';
  }
}
