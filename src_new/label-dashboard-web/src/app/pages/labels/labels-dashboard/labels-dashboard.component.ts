import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TopAlbumsComponent, TopEarningRelease } from '../../dashboard/components/top-albums/top-albums.component';
import { BalanceTableComponent, ArtistBalance } from '../../dashboard/components/balance-table/balance-table.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BrandService, BrandSettings } from '../../../services/brand.service';
import { ArtistStateService } from '../../../services/artist-state.service';
import { WorkspaceService } from '../../../services/workspace.service';
import { environment } from 'environments/environment';

const AVATAR_PALETTE = [
  { bg: 'rgba(20, 184, 166, 0.15)',  text: '#0d9488' },
  { bg: 'rgba(236, 72, 153, 0.15)',  text: '#db2777' },
  { bg: 'rgba(34, 197, 94, 0.15)',   text: '#16a34a' },
  { bg: 'rgba(59, 130, 246, 0.15)',  text: '#2563eb' },
  { bg: 'rgba(156, 163, 175, 0.15)', text: '#6b7280' },
  { bg: 'rgba(251, 146, 60, 0.15)',  text: '#ea580c' },
  { bg: 'rgba(168, 85, 247, 0.15)',  text: '#9333ea' },
];

function hashName(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h;
}
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { LatestRelease } from '../../dashboard/components/latest-albums/latest-albums.component';
import { PipelineStage } from '../../dashboard/components/release-pipeline/release-pipeline.component';
import { ReleaseTaskService } from '../../../services/release-task.service';
import { ReleaseTask } from '../../../models/release-task.model';
import { AuthService } from '../../../services/auth.service';

interface DiscographyRelease {
  id: number;
  title: string;
  catalog_no: string;
  cover_art: string | null;
  release_date: string;
  status: string;
  artists: { id: number; name: string }[];
}

interface DashboardStats {
  latestRelease: {
    id: number;
    catalog_no: string;
    title: string;
    artist_id: number | null;
    artist_name: string;
    cover_art: string;
  } | null;
  totalArtists: number;
  totalReleases: number;
}

interface RecentArtist {
  id: number;
  name: string;
  profile_photo: string | null;
}

interface DashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  latestReleases: LatestRelease[];
  topEarningReleases: TopEarningRelease[];
  balanceSummary: ArtistBalance[];
  stats?: DashboardStats;
  releasePipeline: PipelineStage[];
  recentArtists?: RecentArtist[];
}

@Component({
  selector: 'app-labels-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    TopAlbumsComponent,
    BalanceTableComponent,
    BreadcrumbComponent,
    IconComponent,
  ],
  templateUrl: './labels-dashboard.component.html',
  styleUrl: './labels-dashboard.component.scss'
})
export class LabelsDashboardComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  loading = true;
  error: string | null = null;
  brandName: string = '';
  featureMusicWorkspace: boolean = true;
  pendingReleases: { release: DiscographyRelease; daysUntil: number | null; tasks: ReleaseTask[] }[] = [];
  liveReleasesData: DiscographyRelease[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private brandService: BrandService,
    private artistStateService: ArtistStateService,
    private workspaceService: WorkspaceService,
    private releaseTaskService: ReleaseTaskService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBrandSettings();
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    this.http.get<DashboardData>(`${environment.apiUrl}/dashboard`).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loading = false;
        this.loadPendingReleases();
        this.loadLiveReleases();
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = 'Failed to load dashboard data';
        this.loading = false;
      }
    });
  }

  private loadPendingReleases(): void {
    this.pendingReleases = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const computeDays = (releaseDate: string): number => {
      const d = new Date(releaseDate);
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const currentUserId = this.authService.currentUserValue?.id ?? null;

    this.http.get<{ releases: DiscographyRelease[] }>(
      `${environment.apiUrl}/releases/discography?status=Pending&limit=5&sortBy=release_date&sortDirection=asc`
    ).pipe(catchError(() => of({ releases: [] as DiscographyRelease[] }))).subscribe(({ releases }) => {
      if (!releases.length) return;

      forkJoin(
        releases.map(r => this.releaseTaskService.getTasks(r.id).pipe(catchError(() => of({ tasks: [] }))))
      ).subscribe(results => {
        this.pendingReleases = releases.map((r, i) => ({
          release: r,
          daysUntil: r.release_date ? computeDays(r.release_date) : null,
          tasks: currentUserId
            ? results[i].tasks.filter(t => t.assigned_user_id === currentUserId && t.status !== 'done')
            : []
        }));
      });
    });
  }

  private loadLiveReleases(): void {
    this.http.get<{ releases: DiscographyRelease[] }>(
      `${environment.apiUrl}/releases/discography?status=Live&limit=5&sortBy=release_date&sortDirection=desc`
    ).pipe(catchError(() => of({ releases: [] as DiscographyRelease[] }))).subscribe(({ releases }) => {
      this.liveReleasesData = releases;
    });
  }

  getDaysLabel(days: number | null): string {
    if (days === null) return '';
    if (days <= 0) return 'out now';
    if (days === 1) return 'in 1 day';
    return `in ${days} days`;
  }

  getTaskStatusIcon(status: string): string {
    switch (status) {
      case 'in_progress': return 'clock';
      case 'done':        return 'check-circle';
      default:            return 'circle';
    }
  }

  goToPlanningTab(release: DiscographyRelease): void {
    const primaryArtistId = release.artists?.[0]?.id;
    if (primaryArtistId) {
      localStorage.setItem('selected_artist_id', primaryArtistId.toString());
    }
    this.router.navigate(['/music/releases/edit', release.id], { queryParams: { tab: 'planning' } });
  }

  private loadBrandSettings(): void {
    const cachedSettings = this.brandService.getCurrentBrandSettings();
    if (cachedSettings) {
      this.applyBrandSettings(cachedSettings);
    }

    this.brandService.brandSettings$.subscribe((settings: BrandSettings | null) => {
      if (settings) {
        this.applyBrandSettings(settings);
      }
    });

    this.brandService.loadBrandByDomain().subscribe({
      next: (settings: BrandSettings) => {
        this.applyBrandSettings(settings);
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
      }
    });
  }

  private applyBrandSettings(settings: BrandSettings): void {
    this.brandName = settings.name || '';
    this.featureMusicWorkspace = settings.feature_music_workspace !== false;
  }

  getCoverArtUrl(coverArt: string | null | undefined): string {
    if (!coverArt || coverArt.trim() === '') {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http') ? coverArt : `${environment.apiUrl}/uploads/covers/${coverArt}`;
  }

  getPipelineTotal(): number {
    if (!this.dashboardData?.releasePipeline) return 0;
    return this.dashboardData.releasePipeline.reduce((sum, s) => sum + s.count, 0);
  }

  getPipelineStageCount(status: string): number {
    if (!this.dashboardData?.releasePipeline) return 0;
    return this.dashboardData.releasePipeline.find(s => s.status === status)?.count ?? 0;
  }

  getPipelinePct(status: string): number {
    const total = this.getPipelineTotal();
    if (total === 0) return 0;
    return Math.round((this.getPipelineStageCount(status) / total) * 100);
  }

  getReleaseStatusClass(status: string): string {
    switch (status) {
      case 'Live': return 'tw-bg-green-100 tw-text-green-700';
      case 'Pending': return 'tw-bg-amber-100 tw-text-amber-700';
      case 'For Submission': return 'tw-bg-blue-100 tw-text-blue-700';
      case 'Taken Down': return 'tw-bg-red-100 tw-text-red-700';
      default: return 'tw-bg-gray-100 tw-text-gray-600';
    }
  }

  goToRelease(release: DiscographyRelease): void {
    const primaryArtistId = release.artists?.[0]?.id;
    if (primaryArtistId) {
      localStorage.setItem('selected_artist_id', primaryArtistId.toString());
    }
    this.router.navigate(['/music/releases/edit', release.id]);
  }

  goToReleases(): void {
    this.router.navigate(['/music/releases']);
  }

  hasArtistPhoto(profilePhoto: string | null): boolean {
    return !!profilePhoto && profilePhoto.trim() !== '';
  }

  getArtistPhotoUrl(profilePhoto: string | null): string {
    if (!profilePhoto || profilePhoto.trim() === '') return '';
    return profilePhoto.startsWith('http') ? profilePhoto : `${environment.apiUrl}/uploads/artist-photos/${profilePhoto}`;
  }

  getArtistInitials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  getAvatarBg(name: string): string {
    return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length].bg;
  }

  getAvatarColor(name: string): string {
    return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length].text;
  }

  selectArtist(artist: RecentArtist): void {
    localStorage.setItem('selected_artist_id', artist.id.toString());
    this.artistStateService.setSelectedArtist({ id: artist.id, name: artist.name, profile_photo: artist.profile_photo || '' });
    this.workspaceService.setWorkspace('music');
    this.router.navigate(['/artist/profile']);
  }
}
