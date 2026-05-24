import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import {
  PaginatedTableComponent,
  PaginationInfo,
  TableColumn,
  SortInfo
} from '../../../components/shared/paginated-table/paginated-table.component';
import { ArtistStateService } from '../../../services/artist-state.service';
import { WorkspaceService } from '../../../services/workspace.service';
import { environment } from 'environments/environment';

export interface DiscographyRelease {
  id: number;
  title: string;
  catalog_no: string;
  UPC?: string;
  cover_art?: string;
  release_date: string;
  status: 'Draft' | 'For Submission' | 'Pending' | 'Live' | 'Taken Down';
  artists?: Array<{ id: number; name: string; profile_photo: string | null }>;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'Draft', label: 'Draft' },
  { value: 'For Submission', label: 'For Submission' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Live', label: 'Live' },
  { value: 'Taken Down', label: 'Taken Down' },
];

@Component({
  selector: 'app-labels-discography',
  imports: [CommonModule, BreadcrumbComponent, IconComponent, PaginatedTableComponent],
  templateUrl: './labels-discography.component.html',
  styleUrl: './labels-discography.component.scss'
})
export class LabelsDiscographyComponent implements OnInit {
  releases: DiscographyRelease[] = [];
  pagination: PaginationInfo | null = null;
  loading = false;

  statusFilter = 'all';
  statusOptions = STATUS_OPTIONS;

  sortInfo: SortInfo = { column: 'release_date', direction: 'desc' };

  columns: TableColumn[] = [
    {
      key: 'cover_title',
      label: 'Release',
      sortable: false,
      renderHtml: true,
      formatter: (item: DiscographyRelease) => this.renderCoverTitle(item),
      cardHeader: true,
      mobileGroupMain: true
    },
    {
      key: 'artists',
      label: 'Artist(s)',
      sortable: false,
      formatter: (item: DiscographyRelease) =>
        item.artists?.map(a => a.name).join(', ') || '—'
    },
    {
      key: 'catalog_no',
      label: 'Catalog #',
      sortable: true,
      formatter: (item: DiscographyRelease) => item.catalog_no || '—'
    },
    {
      key: 'UPC',
      label: 'UPC',
      sortable: false,
      tabletClass: 'mobile-hide',
      formatter: (item: DiscographyRelease) => item.UPC || '—'
    },
    {
      key: 'release_date',
      label: 'Release Date',
      type: 'date',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      renderHtml: true,
      formatter: (item: DiscographyRelease) => this.renderStatusBadge(item.status)
    }
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private artistStateService: ArtistStateService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    const statusParam = this.route.snapshot.queryParamMap.get('status');
    if (statusParam && this.statusOptions.some(o => o.value === statusParam)) {
      this.statusFilter = statusParam;
    }
    this.loadDiscography();
  }

  loadDiscography(page = 1): void {
    this.loading = true;

    const params: Record<string, string> = {
      page: page.toString(),
      limit: '20',
      sortBy: this.sortInfo.column,
      sortDirection: this.sortInfo.direction
    };

    if (this.statusFilter !== 'all') {
      params['status'] = this.statusFilter;
    }

    const token = localStorage.getItem('auth_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const queryString = new URLSearchParams(params).toString();

    this.http
      .get<{ releases: DiscographyRelease[]; pagination: PaginationInfo }>(
        `${environment.apiUrl}/releases/discography?${queryString}`,
        { headers }
      )
      .subscribe({
        next: (data) => {
          this.releases = data.releases;
          this.pagination = data.pagination;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading discography:', err);
          this.loading = false;
        }
      });
  }

  onPageChange(page: number): void {
    this.loadDiscography(page);
  }

  onSortChange(sort: SortInfo | null): void {
    if (sort) {
      this.sortInfo = sort;
    } else {
      this.sortInfo = { column: 'release_date', direction: 'desc' };
    }
    this.loadDiscography(1);
  }

  onStatusFilter(value: string): void {
    this.statusFilter = value;
    this.loadDiscography(1);
  }

  onRowClick(release: DiscographyRelease): void {
    const firstArtist = release.artists?.[0];
    if (firstArtist) {
      localStorage.setItem('selected_artist_id', firstArtist.id.toString());
      this.artistStateService.setSelectedArtist({
        id: firstArtist.id,
        name: firstArtist.name,
        profile_photo: firstArtist.profile_photo || ''
      });
    }
    this.workspaceService.setWorkspace('music');
    this.router.navigate(['/music/releases/edit', release.id]);
  }

  getCoverArtUrl(coverArt: string | undefined): string {
    if (!coverArt || coverArt.trim() === '') {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http')
      ? coverArt
      : `${environment.apiUrl}/uploads/covers/${coverArt}`;
  }

  private renderCoverTitle(item: DiscographyRelease): string {
    const url = this.getCoverArtUrl(item.cover_art);
    const title = item.title || '';
    return `<span class="disc-cover-cell">
      <img src="${url}" alt="" class="disc-cover-thumb" />
      <span class="disc-cover-title">${title}</span>
    </span>`;
  }

  private renderStatusBadge(status: string): string {
    const cls = this.getStatusClass(status);
    return `<span class="${cls}">${status}</span>`;
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

  formatDate(dateString: string): string {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
