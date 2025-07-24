import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  brandLogo: string = '';
  brandWebsite: string = '';
  brandColor: string = '';
  isAdmin: boolean = false;
  currentRoute: string = '';

  menuItems = [
    { route: '/dashboard', icon: 'pe-7s-graph', title: 'Dashboard', adminOnly: false },
    { route: '/artist', icon: 'pe-7s-headphones', title: 'Artist', adminOnly: false },
    { route: '/financial', icon: 'pe-7s-note2', title: 'Financial', adminOnly: false },
    { route: '/events', icon: 'pe-7s-date', title: 'Events', adminOnly: true },
    { route: '/admin', icon: 'pe-7s-lock', title: 'Admin', adminOnly: true }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadBrandSettings();
    this.currentRoute = this.router.url;
    
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });
  }

  loadBrandSettings(): void {
    this.brandLogo = 'assets/img/default-logo.png';
    this.brandWebsite = '#';
    this.brandColor = 'blue';
    this.isAdmin = true;
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route;
  }

  shouldShowMenuItem(item: any): boolean {
    return !item.adminOnly || this.isAdmin;
  }
}
