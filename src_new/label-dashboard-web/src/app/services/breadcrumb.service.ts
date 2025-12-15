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

    // Team Management (top-level)
    '/artist/team': { label: 'Team Management', icon: 'fas fa-users' },
    
    // Music section
    '/music': { label: 'Music', icon: 'fas fa-music' },
    '/artist/releases': { label: 'Releases', parent: '/music' },
    '/artist/releases/new': { label: 'Create Release', parent: '/artist/releases' },
    '/artist/releases/edit/:id': { label: 'Edit Release', parent: '/artist/releases' },
    
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
    
    // Admin section
    '/admin': { label: 'Admin', icon: 'fas fa-cogs' },
    '/admin/brand': { label: 'Brand Settings', parent: '/admin' },
    '/admin/label-finance': { label: 'Label Finance', parent: '/admin' },
    '/admin/summary': { label: 'Music Earnings', parent: '/admin' },
    '/admin/balance': { label: 'Artist Finance', parent: '/admin' },
    '/admin/bulk-add-earnings': { label: 'Bulk Add Earnings', parent: '/admin' },
    '/admin/users': { label: 'Users', parent: '/admin' },
    '/admin/child-brands': { label: 'Sublabels', parent: '/admin' },
    '/admin/tools': { label: 'Tools', parent: '/admin' },
  };

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.createBreadcrumbs())
    ).subscribe(breadcrumbs => {
      this.breadcrumbsSubject.next(breadcrumbs);
    });
  }

  private createBreadcrumbs(): BreadcrumbItem[] {
    const currentUrl = this.router.url.split('?')[0]; // Remove query params
    const breadcrumbs: BreadcrumbItem[] = [];

    // First try exact match
    let menuItem = this.menuStructure[currentUrl];
    
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