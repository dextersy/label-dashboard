import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  brandLogo: string = 'assets/img/new_logo.png';
  brandWebsite: string = '#';
  brandColor: string = '#667eea'; // Use actual hex color instead of mapped color
  isAdmin: boolean = false;
  currentRoute: string = '';
  isOpen: boolean = false;
  private brandSubscription: Subscription = new Subscription();
  private sidebarSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();

  menuItems = [
    { route: '/dashboard', icon: 'fas fa-chart-line', title: 'Dashboard', adminOnly: false },
    { route: '/artist', icon: 'fas fa-headphones', title: 'Artist', adminOnly: false },
    { route: '/financial', icon: 'fas fa-dollar-sign', title: 'Financial', adminOnly: false },
    { route: '/events', icon: 'fas fa-calendar', title: 'Events', adminOnly: true },
    { route: '/admin', icon: 'fas fa-cogs', title: 'Admin', adminOnly: true }
  ];

  constructor(
    private router: Router,
    private brandService: BrandService,
    private sidebarService: SidebarService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBrandSettings();
    this.currentRoute = this.router.url;
    
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });

    // Subscribe to sidebar state changes
    this.sidebarSubscription.add(
      this.sidebarService.isOpen$.subscribe(isOpen => {
        this.isOpen = isOpen;
      })
    );

    // Subscribe to auth state changes
    this.authSubscription.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );
  }

  ngOnDestroy(): void {
    this.brandSubscription.unsubscribe();
    this.sidebarSubscription.unsubscribe();
    this.authSubscription.unsubscribe();
  }

  loadBrandSettings(): void {
    // First try to get cached brand settings
    const cachedSettings = this.brandService.getCurrentBrandSettings();
    if (cachedSettings) {
      this.applyBrandSettings(cachedSettings);
    }

    // Subscribe to brand settings changes
    this.brandSubscription.add(
      this.brandService.brandSettings$.subscribe((settings: BrandSettings | null) => {
        if (settings) {
          this.applyBrandSettings(settings);
        }
      })
    );

    // Load brand settings based on current domain
    this.brandService.loadBrandByDomain().subscribe({
      next: (settings: BrandSettings) => {
        this.applyBrandSettings(settings);
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        // Keep default values on error
      }
    });

    // Initial admin status will be set via auth subscription
  }

  private applyBrandSettings(settings: BrandSettings): void {
    this.brandLogo = settings.logo_url || 'assets/img/placeholder.jpg';
    this.brandWebsite = settings.brand_website || '#';
    this.brandColor = settings.brand_color; // Use the actual hex color from the API
  }

  // Removed mapColorToDataColor method - no longer needed

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  shouldShowMenuItem(item: any): boolean {
    return !item.adminOnly || this.isAdmin;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onMenuItemClick(): void {
    // Close sidebar on mobile when menu item is clicked
    this.sidebarService.closeOnMobileNavigation();
  }
}
