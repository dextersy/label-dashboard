import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LatestAlbumsComponent, LatestRelease } from '../../components/dashboard/latest-albums/latest-albums.component';
import { TopAlbumsComponent, TopEarningRelease } from '../../components/dashboard/top-albums/top-albums.component';
import { BalanceTableComponent, ArtistBalance } from '../../components/dashboard/balance-table/balance-table.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { environment } from 'environments/environment';

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

interface DashboardData {
  user: {
    firstName: string;
    isAdmin: boolean;
  };
  latestReleases: LatestRelease[];
  topEarningReleases: TopEarningRelease[];
  balanceSummary: ArtistBalance[];
  stats?: DashboardStats;
}

@Component({
    selector: 'app-dashboard',
    imports: [
        CommonModule,
        RouterModule,
        LatestAlbumsComponent,
        TopAlbumsComponent,
        BalanceTableComponent,
        BreadcrumbComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  loading = true;
  error: string | null = null;
  brandColor: string = '#667eea';
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
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Let the auth interceptor handle adding the Authorization header
    this.http.get<DashboardData>(`${environment.apiUrl}/dashboard`).subscribe({
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

  goToArtistSelection(): void {
    // Clear the current artist selection
    this.artistStateService.setSelectedArtist(null);
    localStorage.removeItem('selected_artist_id');
    
    // Navigate to the artist selection page
    this.router.navigate(['/artist']);
  }

  getCoverArtUrl(coverArt: string | undefined): string {
    if (!coverArt || coverArt.trim() === '') {
      return 'assets/img/placeholder.jpg';
    }
    return coverArt.startsWith('http') ? coverArt : `${environment.apiUrl}/uploads/covers/${coverArt}`;
  }

  goToLatestRelease(): void {
    const latestRelease = this.dashboardData?.stats?.latestRelease;
    if (!latestRelease) return;

    // Set the artist for this release as the current artist
    if (latestRelease.artist_id) {
      localStorage.setItem('selected_artist_id', latestRelease.artist_id.toString());
      // We only have partial artist info, so just set the ID - the artist component will fetch full details
    }

    // Navigate to the release edit page
    this.router.navigate(['/music/releases/edit', latestRelease.id]);
  }
}
