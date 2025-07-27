import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { GlobalNotificationComponent } from './components/global-notification/global-notification.component';
import { ArtistSelectionComponent } from './components/artist/artist-selection/artist-selection.component';
import { Artist } from './components/artist/artist-selection/artist-selection.component';
import { ArtistStateService } from './services/artist-state.service';
import { BrandService } from './services/brand.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, GlobalNotificationComponent, ArtistSelectionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'label-dashboard-web';
  selectedArtist: Artist | null = null;
  currentRoute = '';

  constructor(
    private router: Router,
    private artistStateService: ArtistStateService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    // Initialize brand information before anything else
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        console.log('Brand settings loaded:', brandSettings);
        this.applyBrandStyling(brandSettings);
      },
      error: (error) => {
        console.error('Failed to load brand settings:', error);
        this.router.navigate(['/domain-not-found']);
      }
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentRoute = (event as NavigationEnd).url;
      });

    // Subscribe to artist state changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
    });
  }

  private applyBrandStyling(brandSettings: any): void {
    // Apply brand color as CSS custom property
    if (brandSettings.brand_color) {
      document.documentElement.style.setProperty('--brand-color', brandSettings.brand_color);
    }

    // Update page title
    if (brandSettings.name) {
      document.title = `${brandSettings.name} - Label Dashboard`;
    }

    // Update favicon if provided
    if (brandSettings.favicon_url) {
      // Check if favicon link exists, if not create it
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = brandSettings.favicon_url;
      
      // Also update shortcut icon if it exists
      const shortcutIcon = document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement;
      if (shortcutIcon) {
        shortcutIcon.href = brandSettings.favicon_url;
      }
    }
  }

  isStandalonePage(): boolean {
    return this.router.url === '/login' || this.router.url === '/domain-not-found' || this.router.url === '/';
  }

  shouldShowArtistSelection(): boolean {
    const hiddenRoutes = ['/dashboard', '/events', '/admin'];
    return !this.isStandalonePage() && !hiddenRoutes.some(route => this.currentRoute.startsWith(route));
  }

  onArtistSelected(artist: Artist): void {
    this.artistStateService.setSelectedArtist(artist);
  }
}
