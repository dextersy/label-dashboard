import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { GlobalNotificationComponent } from './components/global-notification/global-notification.component';
import { ArtistSelectionComponent } from './components/artist/artist-selection/artist-selection.component';
import { Artist } from './components/artist/artist-selection/artist-selection.component';
import { ArtistStateService } from './services/artist-state.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, GlobalNotificationComponent, ArtistSelectionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'label-dashboard-web';
  selectedArtist: Artist | null = null;
  currentRoute = '';

  constructor(
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentRoute = (event as NavigationEnd).url;
      });

    // Subscribe to artist state changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
    });
  }

  isLoginPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/';
  }

  shouldShowArtistSelection(): boolean {
    const hiddenRoutes = ['/dashboard', '/events', '/admin'];
    return !this.isLoginPage() && !hiddenRoutes.some(route => this.currentRoute.startsWith(route));
  }

  onArtistSelected(artist: Artist): void {
    this.artistStateService.setSelectedArtist(artist);
  }
}
