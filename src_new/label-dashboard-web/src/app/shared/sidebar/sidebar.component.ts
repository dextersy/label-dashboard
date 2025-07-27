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

  menuItems = [
    { route: '/dashboard', icon: 'pe-7s-graph', title: 'Dashboard', adminOnly: false },
    { route: '/artist', icon: 'pe-7s-headphones', title: 'Artist', adminOnly: false },
    { route: '/financial', icon: 'pe-7s-note2', title: 'Financial', adminOnly: false },
    { route: '/events', icon: 'pe-7s-date', title: 'Events', adminOnly: true },
    { route: '/admin', icon: 'pe-7s-lock', title: 'Admin', adminOnly: true }
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
  }

  ngOnDestroy(): void {
    this.brandSubscription.unsubscribe();
    this.sidebarSubscription.unsubscribe();
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

    // Get admin status from auth service
    this.isAdmin = this.authService.isAdmin();
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
}
