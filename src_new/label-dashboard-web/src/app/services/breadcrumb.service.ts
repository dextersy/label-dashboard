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
    '/artist': { label: 'Artist', icon: 'fas fa-headphones' },
    '/artist/profile': { label: 'Manage Profile', parent: '/artist' },
    '/artist/gallery': { label: 'Upload Media', parent: '/artist' },
    '/artist/releases': { label: 'View Releases', parent: '/artist' },
    '/artist/team': { label: 'Manage Team', parent: '/artist' },
    '/artist/new-release': { label: 'Create Release', parent: '/artist' },
    '/artist/submit-release': { label: 'Submit Release', parent: '/artist' },
    '/financial': { label: 'Financial', icon: 'fas fa-dollar-sign' },
    '/financial/summary': { label: 'Summary', parent: '/financial' },
    '/financial/documents': { label: 'Documents', parent: '/financial' },
    '/financial/earnings': { label: 'Earnings', parent: '/financial' },
    '/financial/royalties': { label: 'Royalties', parent: '/financial' },
    '/financial/payments': { label: 'Payments and Advances', parent: '/financial' },
    '/financial/release': { label: 'Release Information', parent: '/financial' },
    '/financial/new-royalty': { label: 'New Royalty', parent: '/financial' },
    '/financial/new-payment': { label: 'New Payment', parent: '/financial' },
    '/financial/new-earning': { label: 'New Earning', parent: '/financial' },
    '/events': { label: 'Events', icon: 'fas fa-ticket-alt' },
    '/admin': { label: 'Admin', icon: 'fas fa-cogs' },
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

    const menuItem = this.menuStructure[currentUrl];
    
    if (menuItem) {
      // If this item has a parent, add the parent first
      if (menuItem.parent) {
        const parentItem = this.menuStructure[menuItem.parent];
        if (parentItem) {
          breadcrumbs.push({
            label: parentItem.label,
            route: menuItem.parent,
            icon: parentItem.icon
          });
        }
      }

      // Add the current item
      breadcrumbs.push({
        label: menuItem.label,
        route: currentUrl,
        icon: menuItem.icon
      });
    }

    return breadcrumbs;
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