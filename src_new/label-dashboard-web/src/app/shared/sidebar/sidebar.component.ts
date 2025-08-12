import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandWebsite: string = '#';
  brandColor: string = '#667eea'; // Use actual hex color instead of mapped color
  textColor: string = '#ffffff'; // Dynamic text color based on brand color brightness
  iconColor: string = '#a9afbb'; // Dynamic icon color for inactive items
  activeColor: string = '#ffffff'; // Dynamic active item color that contrasts with brand background
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
        { route: '/artist/epk', title: 'Manage EPK', adminOnly: false }
      ]
    },
    { 
      route: '/financial', 
      icon: 'fas fa-dollar-sign', 
      title: 'Financial', 
      adminOnly: false,
      children: [
        { route: '/financial/summary', title: 'Summary', adminOnly: false },
        { route: '/financial/documents', title: 'Documents', adminOnly: false },
        { route: '/financial/earnings', title: 'Earnings', adminOnly: false },
        { route: '/financial/royalties', title: 'Royalties', adminOnly: false },
        { route: '/financial/payments', title: 'Payments and Advances', adminOnly: false },
        { route: '/financial/release', title: 'Release Information', adminOnly: false }
      ]
    },
    { 
      route: '/events', 
      icon: 'fas fa-ticket-alt', 
      title: 'Events', 
      adminOnly: true,
      children: [
        { route: '/events/details', title: 'Details', adminOnly: true },
        { route: '/events/tickets', title: 'Tickets', adminOnly: true },
        { route: '/events/abandoned', title: 'Pending Orders', adminOnly: true },
        { route: '/events/referrals', title: 'Referrals', adminOnly: true },
        { route: '/events/email', title: 'SEnd Email', adminOnly: true }
      ]
    },
    { 
      route: '/admin', 
      icon: 'fas fa-cogs', 
      title: 'Admin', 
      adminOnly: true,
      children: [
        { route: '/admin/brand', title: 'Brand Settings', adminOnly: true },
        { route: '/admin/summary', title: 'Summary View', adminOnly: true },
        { route: '/admin/balance', title: 'Balance Summary', adminOnly: true },
        { route: '/admin/bulk-add-earnings', title: 'Bulk Add Earnings', adminOnly: true },
        { route: '/admin/users', title: 'Users', adminOnly: true },
        { route: '/admin/child-brands', title: 'Sublabels', adminOnly: true },
        { route: '/admin/tools', title: 'Tools', adminOnly: true }
      ]
    }
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
    this.brandLogo = settings.logo_url || 'assets/img/Your Logo Here.png';
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
      this.activeColor = this.darkenColor(this.brandColor, 0.3); // Darker contrast for active items
    } else {
      // Use light colors for dark backgrounds (default)
      this.textColor = '#ffffff';
      this.iconColor = '#a9afbb';
      this.activeColor = this.lightenColor(this.brandColor, 0.3); // Lighter contrast for active items
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

  private darkenColor(hexColor: string, amount: number): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Darken each component
    const newR = Math.round(r * (1 - amount));
    const newG = Math.round(g * (1 - amount));
    const newB = Math.round(b * (1 - amount));
    
    // Convert back to hex
    return '#' + 
      newR.toString(16).padStart(2, '0') +
      newG.toString(16).padStart(2, '0') +
      newB.toString(16).padStart(2, '0');
  }

  private lightenColor(hexColor: string, amount: number): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Lighten each component
    const newR = Math.round(r + (255 - r) * amount);
    const newG = Math.round(g + (255 - g) * amount);
    const newB = Math.round(b + (255 - b) * amount);
    
    // Convert back to hex
    return '#' + 
      newR.toString(16).padStart(2, '0') +
      newG.toString(16).padStart(2, '0') +
      newB.toString(16).padStart(2, '0');
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
      // Close all other expanded menus first - mark them as explicitly collapsed
      // to override any auto-expansion from active routes
      this.menuItems.forEach(item => {
        if (item.children && item.route !== route) {
          this.expandedMenus.delete(item.route);
          this.collapsedMenus.add(item.route);
        }
      });
      
      // Then expand the clicked menu
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
