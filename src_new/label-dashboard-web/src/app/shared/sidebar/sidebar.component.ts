import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BrandService, BrandSettings } from '../../services/brand.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { WorkspaceService, WorkspaceType } from '../../services/workspace.service';
import { ArtistSelectionComponent } from '../../components/artist/artist-selection/artist-selection.component';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface MenuItem {
  route: string;
  icon?: string;
  title: string;
  adminOnly: boolean;
  children?: MenuItem[];
}

interface MenuSection {
  id: string;
  adminOnly?: boolean;
  showArtistIndicator?: boolean;
  items: MenuItem[];
}

@Component({
    selector: 'app-sidebar',
    imports: [CommonModule, RouterModule, ArtistSelectionComponent],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandWebsite: string = '#';
  brandColor: string = '#667eea';
  textColor: string = '#ffffff';
  iconColor: string = '#a9afbb';
  activeColor: string = '#ffffff';
  isAdmin: boolean = false;
  currentRoute: string = '';
  isOpen: boolean = false;
  isCollapsed: boolean = false; // Start expanded on desktop
  isMobileView: boolean = false; // New: track if we're on mobile
  expandedMenus: Set<string> = new Set();
  collapsedMenus: Set<string> = new Set();
  
  // Flyout menu state
  flyoutMenu: MenuItem | null = null;
  flyoutTop: number = 0;
  
  // Selected artist state
  selectedArtist: Artist | null = null;

  // Current workspace
  currentWorkspace: WorkspaceType = 'music';
  visibleSections: MenuSection[] = [];
  isInitialized = false;
  
  private brandSubscription: Subscription = new Subscription();
  private sidebarSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();
  private artistSubscription: Subscription = new Subscription();
  private workspaceSubscription: Subscription = new Subscription();

  // Menu sections with nested items and indicator flags
  sections: MenuSection[] = [
    {
      id: 'dashboard',
      items: [
        { route: '/dashboard', icon: 'fas fa-chart-line', title: 'Dashboard', adminOnly: false }
      ]
    },
    {
      id: 'artist-music-financial',
      showArtistIndicator: true,
      items: [
        {
          route: '/artist',
          icon: 'fas fa-headphones',
          title: 'Artist',
          adminOnly: false,
          children: [
            { route: '/artist/profile', title: 'Profile', adminOnly: false },
            { route: '/artist/gallery', title: 'Media Gallery', adminOnly: false },
            { route: '/artist/epk', title: 'Electronic Press Kit (EPK)', adminOnly: false }
          ]
        },
        {
          route: '/music',
          icon: 'fas fa-music',
          title: 'Music',
          adminOnly: false,
          children: [
            { route: '/music/releases', title: 'Releases', adminOnly: false }
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
        { route: '/team', icon: 'fas fa-users', title: 'Team', adminOnly: false }
      ]
    },
    {
      id: 'campaigns',
      adminOnly: true,
      items: [
        {
          route: '/campaigns/events',
          icon: 'fas fa-ticket-alt',
          title: 'Events',
          adminOnly: true,
          children: [
            { route: '/campaigns/events/details', title: 'Manage events', adminOnly: true },
            { route: '/campaigns/events/tickets', title: 'Tickets', adminOnly: true },
            { route: '/campaigns/events/abandoned', title: 'Pending Orders', adminOnly: true },
            { route: '/campaigns/events/referrals', title: 'Referrals', adminOnly: true },
            { route: '/campaigns/events/email', title: 'Send Email', adminOnly: true }
          ]
        },
        {
          route: '/campaigns/fundraisers',
          icon: 'fas fa-hand-holding-heart',
          title: 'Fundraisers',
          adminOnly: true,
          children: [
            { route: '/campaigns/fundraisers/details', title: 'Manage fundraisers', adminOnly: true },
            { route: '/campaigns/fundraisers/donations', title: 'Donations', adminOnly: true }
          ]
        }
      ]
    },
    {
      id: 'labels',
      adminOnly: true,
      items: [
        {
          route: '/labels',
          icon: 'fas fa-tags',
          title: 'Labels',
          adminOnly: true,
          children: [
            { route: '/labels/earnings', title: 'My Label Earnings', adminOnly: true },
            { route: '/labels/sublabels', title: 'Sublabels', adminOnly: true }
          ]
        }
      ]
    },
    {
      id: 'admin',
      adminOnly: true,
      items: [
        {
          route: '/admin',
          icon: 'fas fa-cogs',
          title: 'Admin',
          adminOnly: true,
          children: [
            { route: '/admin/settings', title: 'Settings', adminOnly: true },
            {
              route: '/admin/reports',
              title: 'Reports',
              adminOnly: true,
              children: [
                { route: '/admin/reports/music-earnings', title: 'Music Earnings', adminOnly: true },
                { route: '/admin/reports/artist-balances', title: 'Artist Balances', adminOnly: true }
              ]
            },
            {
              route: '/admin/tools',
              title: 'Tools',
              adminOnly: true,
              children: [
                { route: '/admin/tools/email-logs', title: 'Email Logs', adminOnly: true },
                { route: '/admin/tools/bulk-add-earnings', title: 'Bulk Add Earnings', adminOnly: true }
              ]
            },
            { route: '/admin/users', title: 'Users', adminOnly: true }
          ]
        }
      ]
    }
  ];

  // Combined array for internal use (methods that need to search across all items)
  get allMenuItems(): MenuItem[] {
    return this.sections.flatMap(section => section.items);
  }

  // Update visible sections based on current workspace
  private updateVisibleSections(): void {
    switch (this.currentWorkspace) {
      case 'music':
        // For music workspace, combine dashboard with artist/music/financial items
        const musicSection = this.sections.find(section => section.id === 'artist-music-financial');
        const dashboardItem = { route: '/dashboard', icon: 'fas fa-chart-line', title: 'Dashboard', adminOnly: false };
        if (musicSection) {
          this.visibleSections = [{
            ...musicSection,
            items: [dashboardItem, ...musicSection.items]
          }];
        } else {
          this.visibleSections = [];
        }
        break;
      case 'campaigns':
        // For campaigns workspace, show events and fundraisers as top-level items with their children
        const campaignsSection = this.sections.find(section => section.id === 'campaigns');
        if (campaignsSection && campaignsSection.items.length > 0) {
          this.visibleSections = [
            {
              id: 'campaigns-top-level',
              items: campaignsSection.items.map(item => {
                // Assign appropriate icons based on the route
                let icon = item.icon || 'fas fa-bullhorn';
                return {
                  ...item,
                  icon: icon
                };
              })
            }
          ];
        } else {
          this.visibleSections = [];
        }
        break;
      case 'labels':
        // For labels workspace, show labels submenu items as top-level items
        const labelsSection = this.sections.find(section => section.id === 'labels');
        if (labelsSection && labelsSection.items.length > 0) {
          const labelsItem = labelsSection.items[0];
          this.visibleSections = [
            {
              id: 'labels-top-level',
              items: labelsItem.children?.map(child => {
                // Assign appropriate icons based on the route
                let icon = 'fas fa-tags'; // default
                switch (child.route) {
                  case '/labels/earnings':
                    icon = 'fas fa-coins';
                    break;
                  case '/labels/sublabels':
                    icon = 'fas fa-layer-group';
                    break;
                }
                return {
                  ...child,
                  icon: icon
                };
              }) || []
            }
          ];
        } else {
          this.visibleSections = [];
        }
        break;
      case 'admin':
        // For admin workspace, show admin submenu items as top-level items
        const adminSection = this.sections.find(section => section.id === 'admin');
        if (adminSection && adminSection.items.length > 0) {
          const adminItem = adminSection.items[0];
          this.visibleSections = [
            {
              id: 'admin-top-level',
              items: adminItem.children?.map(child => {
                // Assign appropriate icons based on the route
                let icon = 'fas fa-cogs'; // default
                switch (child.route) {
                  case '/admin/settings':
                    icon = 'fas fa-palette';
                    break;
                  case '/admin/reports':
                    icon = 'fas fa-chart-bar';
                    break;
                  case '/admin/tools':
                    icon = 'fas fa-wrench';
                    break;
                  case '/admin/users':
                    icon = 'fas fa-users';
                    break;
                }
                return {
                  ...child,
                  icon: icon
                };
              }) || []
            }
          ];
        } else {
          this.visibleSections = [];
        }
        break;
      default:
        this.visibleSections = this.sections;
        break;
    }
  }

  constructor(
    private router: Router,
    private brandService: BrandService,
    private sidebarService: SidebarService,
    private authService: AuthService,
    private artistStateService: ArtistStateService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    this.loadBrandSettings();
    this.currentRoute = this.router.url;
    this.checkMobileView();
    
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
      // Only auto-expand parent menus for active routes, don't persist expansion
      // The isSubmenuExpanded method will handle showing active child routes
    });

    // Subscribe to sidebar state changes
    this.sidebarSubscription.add(
      this.sidebarService.isOpen$.subscribe(isOpen => {
        this.isOpen = isOpen;
        // On desktop, toggle collapsed state; on mobile, toggle visibility
        if (!this.isMobileView) {
          this.isCollapsed = !isOpen;
        }
      })
    );

    // Subscribe to auth state changes
    this.authSubscription.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    // Subscribe to selected artist changes
    this.artistSubscription.add(
      this.artistStateService.selectedArtist$.subscribe(artist => {
        this.selectedArtist = artist;
      })
    );

    // Subscribe to workspace changes
    this.workspaceSubscription.add(
      this.workspaceService.currentWorkspace$.subscribe(workspace => {
        this.currentWorkspace = workspace;
        this.updateVisibleSections();
      })
    );

    // Initialize visible sections
    this.updateVisibleSections();
    this.isInitialized = true;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobileView();
  }

  private checkMobileView(): void {
    this.isMobileView = typeof window !== 'undefined' && window.innerWidth <= 991;
    if (this.isMobileView) {
      this.closeFlyout();
    }
  }

  ngOnDestroy(): void {
    this.brandSubscription.unsubscribe();
    this.sidebarSubscription.unsubscribe();
    this.authSubscription.unsubscribe();
    this.artistSubscription.unsubscribe();
    this.workspaceSubscription.unsubscribe();
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
    // Check if current route is a top-level menu item (not a child of any parent)
    const currentIsTopLevel = this.allMenuItems.some((item: MenuItem) =>
      item.route === this.currentRoute && !item.children
    );

    // If current route is a top-level item, only highlight it if it exactly matches
    if (currentIsTopLevel && this.currentRoute !== parentRoute) {
      return false;
    }

    // First check if current route starts with parent route (for child pages)
    if (this.currentRoute.startsWith(parentRoute + '/') || this.currentRoute === parentRoute) {
      return true;
    }

    // Also check if any child route matches the current route
    // This handles cases like Music menu with /music/releases as child
    const menuItem = this.allMenuItems.find((item: MenuItem) => item.route === parentRoute);
    if (menuItem && menuItem.children) {
      return menuItem.children.some((child: MenuItem) =>
        this.currentRoute === child.route || this.currentRoute.startsWith(child.route + '/')
      );
    }

    return false;
  }

  toggleSubmenu(route: string): void {
    if (this.expandedMenus.has(route)) {
      this.expandedMenus.delete(route);
      this.collapsedMenus.add(route); // Mark as explicitly collapsed
    } else {
      // Close all other expanded menus first - mark them as explicitly collapsed
      // to override any auto-expansion from active routes
      this.allMenuItems.forEach((item: MenuItem) => {
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

  onParentMenuClick(event: MouseEvent, item: MenuItem): void {
    if (this.isCollapsed && !this.isMobileView) {
      // In collapsed mode on desktop, show flyout
      this.showFlyout(event, item);
    } else {
      // In expanded mode or mobile, toggle submenu
      this.toggleSubmenu(item.route);
    }
  }

  showFlyout(event: MouseEvent, item: MenuItem): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.flyoutTop = rect.top;
    this.flyoutMenu = item;
  }

  closeFlyout(): void {
    this.flyoutMenu = null;
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

  shouldShowSection(section: MenuSection): boolean {
    // Don't show admin-only sections for non-admin users
    if (section.adminOnly && !this.isAdmin) {
      return false;
    }

    // Show if section has artist indicator
    if (section.showArtistIndicator) {
      return true;
    }
    
    // Show if section has any visible menu items
    return section.items.some(item => this.shouldShowMenuItem(item));
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  trackBySectionId(index: number, section: MenuSection): string {
    return section.id;
  }

  onArtistSelected(event: {artist: Artist, userInitiated: boolean}): void {
    this.artistStateService.setSelectedArtist(event.artist);

    // Only redirect when user actually changes the selection, not during initialization
    if (event.userInitiated) {
      const currentRoute = this.router.url;
      if (currentRoute.includes('/artist')) {
        this.router.navigate(['/artist/profile']);
      } else if (currentRoute.includes('/financial')) {
        this.router.navigate(['/financial/summary']);
      }

      // Close sidebar on mobile after selection
      this.sidebarService.closeOnMobileNavigation();
    }
  }

  onMenuItemClick(item?: any): void {
    // Close sidebar on mobile when menu item is clicked
    this.sidebarService.closeOnMobileNavigation();
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceIcon(workspace);
  }

  getWorkspaceLabel(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceLabel(workspace);
  }
}
