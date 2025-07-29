import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { GlobalNotificationComponent } from './components/global-notification/global-notification.component';
import { BrandService } from './services/brand.service';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, GlobalNotificationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'label-dashboard-web';
  currentRoute = '';

  constructor(
    private router: Router,
    private brandService: BrandService,
    private authService: AuthService
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
    const standaloneRoutes = ['/login', '/domain-not-found', '/forgot-password', '/reset-password', '/set-profile'];
    const standaloneRoutePrefixes = ['/invite'];
    
    // Check exact matches
    if (standaloneRoutes.includes(this.router.url) || this.router.url === '/') {
      return true;
    }
    
    // Check route prefixes (for routes like /invite/accept)
    if (standaloneRoutePrefixes.some(prefix => this.router.url.startsWith(prefix))) {
      return true;
    }
    
    // Check auth status
    return !this.authService.isLoggedIn();
  }
}
