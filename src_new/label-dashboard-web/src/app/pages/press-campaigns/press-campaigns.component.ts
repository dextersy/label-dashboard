import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { PressCampaignService } from '../../services/press-campaign.service';
import { PressCampaign } from '../../models/press-campaign.model';
import { PaginatedTableComponent, TableColumn, TableAction, PaginationInfo, SearchFilters, SortInfo, HeaderAction } from '../../components/shared/paginated-table/paginated-table.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../components/shared/icon/icon.component';
import { InPageNavComponent, InPageNavTab } from '../../components/shared/in-page-nav/in-page-nav.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-press-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule, PaginatedTableComponent, BreadcrumbComponent, IconComponent, InPageNavComponent],
  templateUrl: './press-campaigns.component.html',
  styleUrl: './press-campaigns.component.scss',
})
export class PressCampaignsComponent implements OnInit, OnDestroy {
  campaigns: PressCampaign[] = [];
  loading = false;
  pagination: PaginationInfo | null = null;
  currentFilters: SearchFilters = {};
  currentSort: SortInfo | null = null;
  activeStatusFilter = 'all';

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

  // Create modal
  showModal = false;
  saving = false;
  selectedTone = '';
  additionalInstructions = '';
  isGeneratingWriteup = false;
  showAiOptions = false;
  campaignForm = {
    title: '',
    writeup: '',
    status: 'Draft' as 'Draft' | 'Published' | 'Sent',
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
  editingField: string | null = null;
  fieldOriginals: any = {};
  writeupExpanded = false;
  uploadingCoverArt = false;
  uploadingMp3 = false;
  uploadingPhoto = false;
  photoLabelInput = '';
  photosExpanded = true;
  downloadingWord = false;
  urlCopied = false;

  // Links
  addingLink = false;
  newLinkLabel = '';
  newLinkUrl = '';

  readonly columns: TableColumn[] = [
    {
      key: 'title',
      label: 'Campaign',
      sortable: true,
      searchable: true,
      cardHeader: true,
      renderHtml: true,
      formatter: (c: PressCampaign) => {
        const imgSrc = c.release?.cover_art || c.event?.poster_url;
        const avatar = imgSrc
          ? `<img src="${imgSrc}" style="width:36px;height:36px;object-fit:cover;border-radius:50%;flex-shrink:0;" alt="" />`
          : `<span style="width:36px;height:36px;border-radius:50%;background:#e5e7eb;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">&#9835;</span>`;
        const typeBadge = c.campaign_type === 'event'
          ? `<span class="status-badge status-info tw-mr-1">Event</span>`
          : `<span class="status-badge status-secondary tw-mr-1">Release</span>`;
        return `<span style="display:inline-flex;align-items:center;gap:10px;">${avatar}<span><strong>${c.title}</strong> ${typeBadge}</span></span>`;
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
          : c.status === 'Sent'
          ? '<span class="status-badge status-info">Sent</span>'
          : '<span class="status-badge status-warning">Draft</span>',
    },
    {
      key: 'creator',
      label: 'Author',
      renderHtml: true,
      formatter: (c: PressCampaign) => {
        if (!c.creator) return '—';
        const fullName = [c.creator.first_name, c.creator.last_name].filter(Boolean).join(' ') || c.creator.username || '—';
        const initials = [c.creator.first_name, c.creator.last_name]
          .filter(Boolean)
          .map(n => n![0].toUpperCase())
          .join('') || (c.creator.username ? c.creator.username[0].toUpperCase() : '?');
        return `<span class="tw-inline-flex tw-items-center tw-gap-2">
          <span class="tw-inline-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-rounded-full tw-bg-gray-200 tw-text-gray-600 tw-text-xs tw-font-semibold tw-flex-shrink-0">${initials}</span>
          <span>${fullName}</span>
        </span>`;
      },
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
    { icon: 'edit', label: 'Manage Campaign', primary: true, handler: (c: PressCampaign) => this.openDetailModal(c) },
    { icon: 'file', label: 'Download Press Release (.docx)', handler: (c: PressCampaign) => this.downloadWord(c) },
    { icon: 'link', label: 'View Public Page', handler: (c: PressCampaign) => this.openPublicPage(c) },
    {
      icon: 'check',
      label: 'Publish',
      hidden: (c: PressCampaign) => c.status !== 'Draft',
      handler: (c: PressCampaign) => this.updateCampaignStatus(c, 'Published'),
    },
    {
      icon: 'paper-plane',
      label: 'Mark as sent',
      hidden: (c: PressCampaign) => c.status !== 'Published',
      handler: (c: PressCampaign) => this.updateCampaignStatus(c, 'Sent'),
    },
    { icon: 'trash', label: 'Delete', type: 'danger', handler: (c: PressCampaign) => this.deleteCampaign(c) },
  ];

  readonly headerActions: HeaderAction[] = [
    { icon: 'plus', label: 'New Campaign', type: 'primary', handler: () => this.openCreateModal() },
  ];

  constructor(
    private pressCampaignService: PressCampaignService,
    private brandService: BrandService,
    private notification: NotificationService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadCampaigns();
    this.setupSearch();
    this.loadBrandFeatures();
    const openId = this.route.snapshot.queryParamMap.get('open');
    if (openId) {
      this.openDetailModal({ id: +openId } as PressCampaign);
    }
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

  readonly statusTabs: InPageNavTab[] = [
    { id: 'all', label: 'All', icon: 'filter' },
    { id: 'Draft', label: 'Draft', icon: 'file' },
    { id: 'Published', label: 'Published', icon: 'globe' },
    { id: 'Sent', label: 'Sent', icon: 'paper-plane' },
  ];

  onStatusTabChange(id: string): void {
    this.activeStatusFilter = id;
    this.loadCampaigns(1);
  }

  updateCampaignStatus(campaign: PressCampaign, status: 'Draft' | 'Published' | 'Sent'): void {
    this.pressCampaignService.updateCampaign(campaign.id, { status }).subscribe({
      next: () => this.loadCampaigns(),
      error: () => this.notification.showError('Failed to update campaign status.'),
    });
  }

  private readonly statusOrder: Record<string, number> = { Draft: 0, Published: 1, Sent: 2 };

  loadCampaigns(page = 1): void {
    this.loading = true;
    this.pressCampaignService.getCampaigns({
      page,
      limit: 20,
      sort_field: this.currentSort?.column,
      sort_order: this.currentSort?.direction?.toUpperCase(),
      title: this.currentFilters['title'],
      status: this.activeStatusFilter !== 'all' ? this.activeStatusFilter : undefined,
    }).subscribe({
      next: res => {
        let campaigns = res.campaigns;
        if (this.activeStatusFilter === 'all' && !this.currentSort) {
          campaigns = [...campaigns].sort(
            (a, b) => (this.statusOrder[a.status] ?? 3) - (this.statusOrder[b.status] ?? 3)
          );
        }
        this.campaigns = campaigns;
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
      error: () => { this.loading = false; this.campaigns = []; this.pagination = null; this.notification.showError('Failed to load campaigns.'); },
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

  // --- Create modal ---

  openCreateModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  resetForm(): void {
    const defaultType = (!this.hasReleases && this.hasEvents) ? 'event' : 'release';
    this.campaignForm = { title: '', writeup: '', status: 'Draft' as 'Draft' | 'Published' | 'Sent', campaign_type: defaultType, release_id: null, artist_id: null, event_id: null };
    this.selectedTone = '';
    this.additionalInstructions = '';
    this.showAiOptions = false;
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

  draftWithAi(): void {
    if (!this.detailCampaign?.id) return;
    this.isGeneratingWriteup = true;
    this.pressCampaignService.generateWriteup(this.detailCampaign.id, this.selectedTone, this.additionalInstructions).subscribe({
      next: result => {
        this.campaignForm.writeup = result.writeup;
        this.isGeneratingWriteup = false;
      },
      error: (err) => {
        this.isGeneratingWriteup = false;
        const msg = err?.error?.error || 'Failed to generate writeup.';
        this.notification.showError(msg);
      },
    });
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

    this.pressCampaignService.createCampaign(data).subscribe({
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
    this.editingField = null;
    this.writeupExpanded = false;
    this.pressCampaignService.getCampaign(campaign.id).subscribe({
      next: res => { this.detailCampaign = res.campaign; this.populateFormFromDetail(); this.loadingDetail = false; },
      error: () => { this.loadingDetail = false; this.notification.showError('Failed to load campaign details.'); },
    });
  }

  private populateFormFromDetail(): void {
    if (!this.detailCampaign) return;
    this.campaignForm = {
      title: this.detailCampaign.title,
      writeup: this.detailCampaign.writeup || '',
      status: this.detailCampaign.status,
      campaign_type: this.detailCampaign.campaign_type || 'release',
      release_id: this.detailCampaign.release_id || null,
      artist_id: this.detailCampaign.artist_id || null,
      event_id: this.detailCampaign.event_id || null,
    };
    this.selectedRelease = this.detailCampaign.release || null;
    this.selectedArtist = this.detailCampaign.artist || null;
    this.selectedEvent = this.detailCampaign.event || null;
    this.showAiOptions = false;
    this.selectedTone = '';
    this.additionalInstructions = '';
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailCampaign = null;
    this.editingField = null;
    this.writeupExpanded = false;
  }

  get isDraftCampaign(): boolean {
    return this.detailCampaign?.status === 'Draft';
  }

  startEditingField(field: string): void {
    this.fieldOriginals = {
      title: this.campaignForm.title,
      status: this.campaignForm.status,
      writeup: this.campaignForm.writeup,
      release_id: this.campaignForm.release_id,
      event_id: this.campaignForm.event_id,
      artist_id: this.campaignForm.artist_id,
      selectedRelease: this.selectedRelease,
      selectedEvent: this.selectedEvent,
      selectedArtist: this.selectedArtist,
    };
    this.editingField = field;
  }

  cancelEditingField(): void {
    this.campaignForm.title = this.fieldOriginals['title'];
    this.campaignForm.status = this.fieldOriginals['status'];
    this.campaignForm.writeup = this.fieldOriginals['writeup'];
    this.campaignForm.release_id = this.fieldOriginals['release_id'];
    this.campaignForm.event_id = this.fieldOriginals['event_id'];
    this.campaignForm.artist_id = this.fieldOriginals['artist_id'];
    this.selectedRelease = this.fieldOriginals['selectedRelease'];
    this.selectedEvent = this.fieldOriginals['selectedEvent'];
    this.selectedArtist = this.fieldOriginals['selectedArtist'];
    this.editingField = null;
    this.releaseSearchQuery = '';
    this.releaseSearchResults = [];
    this.eventSearchQuery = '';
    this.eventSearchResults = [];
    this.artistSearchQuery = '';
    this.artistSearchResults = [];
  }

  saveField(): void {
    this.saveCampaignDetails();
  }

  saveCampaignDetails(): void {
    if (!this.detailCampaign || !this.campaignForm.title.trim()) return;
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
    this.pressCampaignService.updateCampaign(this.detailCampaign.id, data).subscribe({
      next: () => {
        this.saving = false;
        this.editingField = null;
        this.loadingDetail = true;
        this.pressCampaignService.getCampaign(this.detailCampaign!.id).subscribe({
          next: res => { this.detailCampaign = res.campaign; this.populateFormFromDetail(); this.loadingDetail = false; },
          error: () => { this.loadingDetail = false; },
        });
        this.loadCampaigns();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.error || 'Failed to save campaign.';
        this.notification.showError(msg);
      },
    });
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

  addLink(): void {
    if (!this.detailCampaign || !this.newLinkLabel.trim() || !this.newLinkUrl.trim()) return;
    this.addingLink = true;
    this.pressCampaignService.addCampaignLink(this.detailCampaign.id, this.newLinkLabel.trim(), this.newLinkUrl.trim()).subscribe({
      next: res => {
        if (this.detailCampaign) {
          if (!this.detailCampaign.links) this.detailCampaign.links = [];
          this.detailCampaign.links.push(res.link);
        }
        this.newLinkLabel = '';
        this.newLinkUrl = '';
        this.addingLink = false;
      },
      error: () => { this.addingLink = false; this.notification.showError('Failed to add link.'); },
    });
  }

  deleteLink(linkId: number): void {
    if (!this.detailCampaign) return;
    this.pressCampaignService.deleteCampaignLink(this.detailCampaign.id, linkId).subscribe({
      next: () => {
        if (this.detailCampaign) {
          this.detailCampaign.links = this.detailCampaign.links?.filter(l => l.id !== linkId);
        }
      },
      error: () => this.notification.showError('Failed to delete link.'),
    });
  }

  copyPublicUrl(campaign: PressCampaign): void {
    const url = `${window.location.origin}/press/${campaign.public_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      this.urlCopied = true;
      setTimeout(() => (this.urlCopied = false), 2000);
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
