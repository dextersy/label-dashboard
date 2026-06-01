import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LatestRelease } from './components/latest-albums/latest-albums.component';
import { TopEarningRelease } from './components/top-albums/top-albums.component';
import { LatestReleaseCardComponent, LatestReleaseDetail } from './components/latest-release-card/latest-release-card.component';
import { OnboardingChecklistComponent, DashboardChecklist } from './components/onboarding-checklist/onboarding-checklist.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { Artist } from '../../models/artist.model';
import { environment } from 'environments/environment';
import { IconComponent } from '../../components/shared/icon/icon.component';

interface DashboardStats {
  totalReleases: number;
  unreleasedCount: number;
}

interface LatestEarning {
  amount: number;
  date_recorded: string;
  type: string;
  release_id: number;
  release_title: string | null;
}

interface DashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  latestRelease: LatestReleaseDetail | null;
  latestReleases: LatestRelease[];
  topEarningReleases: TopEarningRelease[];
  stats?: DashboardStats;
  latestEarning: LatestEarning | null;
  checklist: DashboardChecklist | null;
}

@Component({
    selector: 'app-dashboard',
    imports: [
        CommonModule,
        RouterModule,
        OnboardingChecklistComponent,
        LatestReleaseCardComponent,
        BreadcrumbComponent,
        IconComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  dashboardData: DashboardData | null = null;
  selectedArtist: Artist | null = null;
  loading = true;
  error: string | null = null;
  private artistSubscription = new Subscription();
  brandColor: string = '#667eea';
  brandName: string = '';
  gradientStart: string = '#667eea';
  gradientEnd: string = '#764ba2';
  shadowColor: string = 'rgba(102, 126, 234, 0.3)';
  boxShadow: string = '0 10px 30px rgba(102, 126, 234, 0.3)';
  textColor: string = '#ffffff';
  iconColor: string = 'rgba(255, 255, 255, 0.9)';
  today: Date = new Date();

  constructor(
    private http: HttpClient,
    private router: Router,
    private brandService: BrandService,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    this.loadBrandSettings();
    // BehaviorSubject emits current value immediately, so this handles both
    // the initial load and any subsequent artist switches.
    this.artistSubscription.add(
      this.artistStateService.selectedArtist$.subscribe(artist => {
        this.selectedArtist = artist;
        this.loadDashboardData();
      })
    );
  }

  ngOnDestroy(): void {
    this.artistSubscription.unsubscribe();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    const artistId = this.artistStateService.getSelectedArtist()?.id
      || localStorage.getItem('selected_artist_id');
    const params = artistId ? `?artist_id=${artistId}` : '';

    this.http.get<DashboardData>(`${environment.apiUrl}/dashboard${params}`).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.error = 'Failed to load dashboard data';
        this.loading = false;
      }
    });
  }

  get isAdmin(): boolean {
    return this.dashboardData?.user?.isAdmin || false;
  }

  get userFirstName(): string {
    return this.dashboardData?.user?.firstName || 'User';
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  private loadBrandSettings(): void {
    // First try to get cached brand settings
    const cachedSettings = this.brandService.getCurrentBrandSettings();
    if (cachedSettings) {
      this.applyBrandColors(cachedSettings);
    }

    // Subscribe to brand settings changes
    this.brandService.brandSettings$.subscribe((settings: BrandSettings | null) => {
      if (settings) {
        this.applyBrandColors(settings);
      }
    });

    // Load brand settings based on current domain
    this.brandService.loadBrandByDomain().subscribe({
      next: (settings: BrandSettings) => {
        this.applyBrandColors(settings);
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        // Keep default values on error
      }
    });
  }

  private applyBrandColors(settings: BrandSettings): void {
    this.brandColor = settings.brand_color;
    this.brandName = settings.name || '';
    this.generateGradientColors(settings.brand_color);
  }

  private generateGradientColors(brandColor: string): void {
    // Parse the brand color
    const rgb = this.hexToRgb(brandColor);
    if (!rgb) {
      // Fallback to default colors if parsing fails
      this.gradientStart = '#667eea';
      this.gradientEnd = '#764ba2';
      this.shadowColor = 'rgba(102, 126, 234, 0.3)';
      this.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
      this.textColor = '#ffffff';
      this.iconColor = 'rgba(255, 255, 255, 0.9)';
      return;
    }

    // Generate gradient start (original brand color)
    this.gradientStart = brandColor;

    // Generate gradient end (darker/more saturated version)
    this.gradientEnd = this.darkenColor(brandColor, 0.2);

    // Generate shadow color with transparency
    this.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    this.boxShadow = `0 10px 30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;

    // Calculate text colors based on brand color brightness
    this.updateTextColorsBasedOnBrightness(brandColor);
  }

  private hexToRgb(hex: string): {r: number, g: number, b: number} | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private darkenColor(hex: string, factor: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    // Darken by reducing RGB values
    const r = Math.max(0, Math.floor(rgb.r * (1 - factor)));
    const g = Math.max(0, Math.floor(rgb.g * (1 - factor)));
    const b = Math.max(0, Math.floor(rgb.b * (1 - factor)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private updateTextColorsBasedOnBrightness(hexColor: string): void {
    const isLight = this.isColorLight(hexColor);
    
    if (isLight) {
      // Use dark colors for light backgrounds
      this.textColor = '#1a202c';
      this.iconColor = 'rgba(26, 32, 44, 0.8)';
    } else {
      // Use light colors for dark backgrounds (default)
      this.textColor = '#ffffff';
      this.iconColor = 'rgba(255, 255, 255, 0.9)';
    }
  }

  private isColorLight(hexColor: string): boolean {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate relative luminance using the formula from WCAG
    // https://www.w3.org/TR/WCAG20/#relativeluminancedef
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return true if the color is light (luminance > 0.5)
    return luminance > 0.5;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  }

  formatShort(amount: number): string {
    const v = amount || 0;
    if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(0) + 'K';
    return '₱' + Math.round(v);
  }

  getEarningsPct(amount: number): number {
    const releases = this.dashboardData?.topEarningReleases;
    if (!releases?.length) return 0;
    const max = Math.max(...releases.map(r => r.total_earnings || 0));
    if (max === 0) return 0;
    return Math.max(4, Math.round(((amount || 0) / max) * 100));
  }

  getCombinedEarnings(): number {
    return (this.dashboardData?.topEarningReleases || [])
      .reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  }

  getArtistInitials(name: string | undefined): string {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  getArtistPhotoUrl(photo: string | undefined): string {
    if (!photo) return '';
    return photo.startsWith('http') ? photo : `${environment.apiUrl}/uploads/artists/${photo}`;
  }

  getCoverArtUrl(coverArt: string | undefined): string {
    if (!coverArt || coverArt.trim() === '') {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http') ? coverArt : `${environment.apiUrl}/uploads/covers/${coverArt}`;
  }

  goToReleases(): void {
    this.router.navigate(['/music/releases']);
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

  goToRelease(release: LatestRelease): void {
    if (release.artist_id) {
      localStorage.setItem('selected_artist_id', release.artist_id.toString());
    }
    this.router.navigate(['/music/releases/edit', release.id]);
  }
}
