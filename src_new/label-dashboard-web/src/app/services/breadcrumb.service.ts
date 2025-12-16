import { Injectable } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface BreadcrumbItem {
  label: string;
  route?: string;
  icon?: string;
}

interface MenuItemBase {
  label: string;
  icon?: string;
  parent?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  private breadcrumbsSubject = new BehaviorSubject<BreadcrumbItem[]>([]);
  public breadcrumbs$ = this.breadcrumbsSubject.asObservable();

  // Menu structure for breadcrumb generation
  private menuStructure: Record<string, MenuItemBase> = {
    '/dashboard': { label: 'Dashboard', icon: 'fas fa-chart-line' },
    
    // Artist section
    '/artist': { label: 'Artist', icon: 'fas fa-headphones' },
    '/artist/profile': { label: 'Profile', parent: '/artist' },
    '/artist/gallery': { label: 'Media Gallery', parent: '/artist' },
    '/artist/epk': { label: 'Electronic Press Kit (EPK)', parent: '/artist' },
    '/artist/new': { label: 'Add New Artist', parent: '/artist' },

    // Team (top-level)
    '/team': { label: 'Team', icon: 'fas fa-users' },

    // Music section
    '/music': { label: 'Music', icon: 'fas fa-music' },
    '/music/releases': { label: 'Releases', parent: '/music' },
    '/music/releases/new': { label: 'Create Release', parent: '/music/releases' },
    '/music/releases/edit/:id': { label: 'Edit Release', parent: '/music/releases' },
    
    // Financial section
    '/financial': { label: 'Financial', icon: 'fas fa-dollar-sign' },
    '/financial/summary': { label: 'Summary', parent: '/financial' },
    '/financial/documents': { label: 'Documents', parent: '/financial' },
    '/financial/earnings': { label: 'Earnings', parent: '/financial' },
    '/financial/royalties': { label: 'Royalties', parent: '/financial' },
    '/financial/payments': { label: 'Payments and Advances', parent: '/financial' },
    '/financial/release': { label: 'Release Information', parent: '/financial' },
    '/financial/royalties/new': { label: 'New Royalty', parent: '/financial/royalties' },
    '/financial/payments/new': { label: 'New Payment', parent: '/financial/payments' },
    '/financial/earnings/new': { label: 'New Earning', parent: '/financial/earnings' },
    
    // Events section
    '/events': { label: 'Events', icon: 'fas fa-ticket-alt' },
    '/events/new': { label: 'New Event', parent: '/events' },
    '/events/details': { label: 'Manage Events', parent: '/events' },
    '/events/tickets': { label: 'Tickets', parent: '/events' },
    '/events/abandoned': { label: 'Pending Orders', parent: '/events' },
    '/events/referrals': { label: 'Referrals', parent: '/events' },
    '/events/email': { label: 'Send Email', parent: '/events' },
    '/events/custom-ticket': { label: 'Create Custom Ticket', parent: '/events' },

    // Labels workspace
    '/labels': { label: 'Labels', icon: 'fas fa-tags' },
    '/labels/earnings': { label: 'My Label Earnings', parent: '/labels', icon: 'fas fa-coins' },
    '/labels/sublabels': { label: 'Sublabels', parent: '/labels', icon: 'fas fa-layer-group' },
    
    // Admin section
    '/admin': { label: 'Admin', icon: 'fas fa-cogs' },
    '/admin/settings': { label: 'Settings', parent: '/admin' },
    '/admin/reports': { label: 'Reports', parent: '/admin' },
    '/admin/reports/music-earnings': { label: 'Music Earnings', parent: '/admin/reports' },
    '/admin/reports/artist-balances': { label: 'Artist Balances', parent: '/admin/reports' },
    '/admin/tools': { label: 'Tools', parent: '/admin' },
    '/admin/tools/email-logs': { label: 'Email Logs', parent: '/admin/tools' },
    '/admin/tools/bulk-add-earnings': { label: 'Bulk Add Earnings', parent: '/admin/tools' },
    '/admin/users': { label: 'Users', parent: '/admin' },
  };

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.createBreadcrumbs())
    ).subscribe(breadcrumbs => {
      // Only overwrite stored breadcrumbs if we actually found breadcrumbs for the route
      if (breadcrumbs && breadcrumbs.length > 0) {
        this.breadcrumbsSubject.next(breadcrumbs);
      }
    });
  }

  private createBreadcrumbs(): BreadcrumbItem[] {
    const currentUrl = this.router.url.split('?')[0]; // Remove query params
    // createBreadcrumbs: generate breadcrumbs for current route
    const breadcrumbs: BreadcrumbItem[] = [];

    // First try exact match
    let menuItem = this.menuStructure[currentUrl];
    // exact match check
    
    // If no exact match, try to match parameterized routes
    if (!menuItem) {
      for (const routePattern of Object.keys(this.menuStructure)) {
        if (this.matchesRoutePattern(currentUrl, routePattern)) {
          menuItem = this.menuStructure[routePattern];
          break;
        }
      }
    }
    
    if (menuItem) {
      // Recursively build the full hierarchy
      this.buildBreadcrumbHierarchy(currentUrl, breadcrumbs);
      // built breadcrumbs
    }

    // Fallback: if no exact or parameterized match, try prefix matches (useful for nested paths)
    if (!menuItem) {
      for (const routePattern of Object.keys(this.menuStructure)) {
        if (currentUrl === routePattern || currentUrl.startsWith(routePattern + '/')) {
          this.buildBreadcrumbHierarchy(routePattern, breadcrumbs);
          break;
        }
      }
    }

    return breadcrumbs;
  }

  private matchesRoutePattern(url: string, pattern: string): boolean {
    // Convert route pattern to regex
    // Replace :param with [^/]+ (one or more characters that are not /)
    const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  }

  private buildBreadcrumbHierarchy(url: string, breadcrumbs: BreadcrumbItem[]): void {
    // First try exact match for the URL
    let menuItem = this.menuStructure[url];
    
    // If no exact match, try to match parameterized routes
    if (!menuItem) {
      for (const routePattern of Object.keys(this.menuStructure)) {
        if (this.matchesRoutePattern(url, routePattern)) {
          menuItem = this.menuStructure[routePattern];
          break;
        }
      }
    }
    
    if (menuItem) {
      // If this item has a parent, recursively add the parent hierarchy first
      if (menuItem.parent) {
        this.buildBreadcrumbHierarchy(menuItem.parent, breadcrumbs);
      }

      // Add the current item
      breadcrumbs.push({
        label: menuItem.label,
        route: url,
        icon: menuItem.icon
      });
    }
  }

  // Method to manually set breadcrumbs if needed
  setBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
    this.breadcrumbsSubject.next(breadcrumbs);
  }

  // Get current breadcrumbs synchronously
  getCurrentBreadcrumbs(): BreadcrumbItem[] {
    return this.breadcrumbsSubject.value;
  }
}