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
  textColor: string = '#ffffff'; // Dynamic text color based on brand color brightness
  iconColor: string = '#a9afbb'; // Dynamic icon color for inactive items
  isAdmin: boolean = false;
  currentRoute: string = '';
  isOpen: boolean = false;
  expandedMenus: Set<string> = new Set();
  collapsedMenus: Set<string> = new Set();
  private brandSubscription: Subscription = new Subscription();
  private sidebarSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();

  menuItems = [
    { route: '/dashboard', icon: 'fas fa-chart-line', title: 'Dashboard', adminOnly: false },
    { 
      route: '/artist', 
      icon: 'fas fa-headphones', 
      title: 'Artist', 
      adminOnly: false,
      children: [
        { route: '/artist/profile', title: 'Manage Profile', adminOnly: false },
        { route: '/artist/gallery', title: 'Upload Media', adminOnly: false },
        { route: '/artist/releases', title: 'View Releases', adminOnly: false },
        { route: '/artist/team', title: 'Manage Team', adminOnly: false },
        { route: '/artist/new-release', title: 'Create Release', adminOnly: true },
        { route: '/artist/submit-release', title: 'Submit Release', adminOnly: false }
      ]
    },
    { route: '/financial', icon: 'fas fa-dollar-sign', title: 'Financial', adminOnly: false },
    { route: '/events', icon: 'fas fa-ticket-alt', title: 'Events', adminOnly: true },
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
      // Only auto-expand parent menus for active routes, don't persist expansion
      // The isSubmenuExpanded method will handle showing active child routes
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
    this.updateTextColorsBasedOnBrightness();
  }

  private updateTextColorsBasedOnBrightness(): void {
    const isLight = this.isColorLight(this.brandColor);
    
    if (isLight) {
      // Use dark colors for light backgrounds
      this.textColor = '#333333';
      this.iconColor = '#666666';
    } else {
      // Use light colors for dark backgrounds (default)
      this.textColor = '#ffffff';
      this.iconColor = '#a9afbb';
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

  // Removed mapColorToDataColor method - no longer needed

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  isActiveParentRoute(parentRoute: string): boolean {
    return this.currentRoute.startsWith(parentRoute + '/');
  }

  toggleSubmenu(route: string): void {
    if (this.expandedMenus.has(route)) {
      this.expandedMenus.delete(route);
      this.collapsedMenus.add(route); // Mark as explicitly collapsed
    } else {
      this.expandedMenus.add(route);
      this.collapsedMenus.delete(route); // Remove from collapsed list
    }
  }

  isSubmenuExpanded(route: string): boolean {
    // If explicitly collapsed by user, stay collapsed even with active child route
    if (this.collapsedMenus.has(route)) {
      return false;
    }
    // Expand if explicitly toggled OR if there's an active child route
    return this.expandedMenus.has(route) || this.isActiveParentRoute(route);
  }

  hasChildren(item: any): boolean {
    return item.children && item.children.length > 0;
  }

  shouldShowMenuItem(item: any): boolean {
    return !item.adminOnly || this.isAdmin;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onMenuItemClick(item?: any): void {
    // Close sidebar on mobile when menu item is clicked
    this.sidebarService.closeOnMobileNavigation();
  }
}
