import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { GlobalNotificationComponent } from './components/global-notification/global-notification.component';
import { BrandService } from './services/brand.service';
import { AuthService } from './services/auth.service';
import { AdminService, SublabelCompletionEvent } from './services/admin.service';
import { NotificationService } from './services/notification.service';
import { SidebarService } from './services/sidebar.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, GlobalNotificationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'label-dashboard-web';
  currentRoute = '';
  brandLoaded = false;
  sidebarOpen = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private brandService: BrandService,
    private authService: AuthService,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    // Initialize brand information before anything else
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.applyBrandStyling(brandSettings);
        this.brandLoaded = true;
      },
      error: (error) => {
        console.error('Failed to load brand settings:', error);
        this.brandLoaded = true; // Allow rendering even on error to show error page
        
        if (!window.location.pathname.includes('/domain-not-found')) {
          // First time redirecting to domain-not-found, capture current URL
          const currentUrl = window.location.href;
          this.router.navigate(['/domain-not-found'], { 
            queryParams: { returnUrl: currentUrl } 
          });
        } else {
          // Already on domain-not-found, preserve existing returnUrl
          const urlParams = new URLSearchParams(window.location.search);
          const existingReturnUrl = urlParams.get('returnUrl');
          if (existingReturnUrl) {
            this.router.navigate(['/domain-not-found'], { 
              queryParams: { returnUrl: existingReturnUrl } 
            });
          } else {
            this.router.navigate(['/domain-not-found']);
          }
        }
      }
    });

    // Subscribe to brand settings changes for dynamic updates
    this.brandService.brandSettings$.subscribe(brandSettings => {
      if (brandSettings) {
        this.applyBrandStyling(brandSettings);
      }
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentRoute = (event as NavigationEnd).url;
      });
    
    // Global sublabel completion listener - works regardless of current page
    const completionSubscription = this.adminService.sublabelCompletion$.subscribe(
      (event: SublabelCompletionEvent | null) => {
        if (event && this.authService.isLoggedIn()) {
          // Show completion notification with clickable action to go to brand settings
          this.notificationService.showSuccess(
            `Your new label "${event.sublabelName}" is ready! Click here to go to Brand Settings.`,
            () => {
              // Navigate to brand settings
              this.router.navigate(['/admin/brand']);
            }
          );
        }
      }
    );
    this.subscriptions.push(completionSubscription);
    
    // Subscribe to sidebar state for wrapper class binding
    const sidebarSubscription = this.sidebarService.isOpen$.subscribe(isOpen => {
      this.sidebarOpen = isOpen;
    });
    this.subscriptions.push(sidebarSubscription);
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
    const standaloneRoutePrefixes = ['/invite', '/public'];
    
    // Check exact matches
    if (standaloneRoutes.includes(this.router.url) || this.router.url === '/') {
      return true;
    }
    
    // Check route prefixes (for routes like /invite/accept and /public)
    if (standaloneRoutePrefixes.some(prefix => this.router.url.startsWith(prefix))) {
      return true;
    }
    
    // Check auth status
    return !this.authService.isLoggedIn();
  }
}
