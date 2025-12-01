import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { ArtistProfileTabComponent, ArtistProfile } from '../../components/artist/artist-profile-tab/artist-profile-tab.component';
import { ArtistGalleryTabComponent } from '../../components/artist/artist-gallery-tab/artist-gallery-tab.component';
import { ArtistReleasesTabComponent, ArtistRelease } from '../../components/artist/artist-releases-tab/artist-releases-tab.component';
import { ArtistTeamTabComponent } from '../../components/artist/artist-team-tab/artist-team-tab.component';
import { ArtistManageEpkTabComponent } from '../../components/artist/artist-manage-epk-tab/artist-manage-epk-tab.component';
import { NotificationService } from '../../services/notification.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { environment } from '../../../environments/environment';

export type TabType = 'profile' | 'gallery' | 'releases' | 'team' | 'manage-epk';

@Component({
    selector: 'app-artist',
    imports: [
        CommonModule,
        ArtistProfileTabComponent,
        ArtistGalleryTabComponent,
        ArtistReleasesTabComponent,
        ArtistTeamTabComponent,
        ArtistManageEpkTabComponent,
        BreadcrumbComponent
    ],
    templateUrl: './artist.component.html',
    styleUrl: './artist.component.scss'
})
export class ArtistComponent implements OnInit, OnDestroy {
  
  selectedArtist: Artist | null = null;
  activeTab: TabType = 'profile';
  isAdmin = false;
  loading = false;
  availableArtists: Artist[] = [];
  private routeSubscription: Subscription = new Subscription();

  constructor(
    private notificationService: NotificationService,
    private artistStateService: ArtistStateService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}


  ngOnInit(): void {
    // Check if user is admin
    this.isAdmin = this.authService.isAdmin();
    
    // Load available artists
    this.loadAvailableArtists();

    // Subscribe to artist state changes
    this.artistStateService.selectedArtist$.subscribe(artist => {
      this.selectedArtist = artist;
    });

    // Subscribe to route data changes to determine active tab
    this.routeSubscription.add(
      this.route.data.subscribe(data => {
        if (data['tab']) {
          this.activeTab = data['tab'] as TabType;
        } else {
          // Fallback: determine tab from current URL if no route data
          const currentUrl = this.router.url;
          if (currentUrl.includes('/artist/profile') || currentUrl === '/artist' || currentUrl === '/artist/') {
            this.activeTab = 'profile';
          } else if (currentUrl.includes('/artist/gallery')) {
            this.activeTab = 'gallery';
          } else if (currentUrl.includes('/artist/releases')) {
            this.activeTab = 'releases';
          } else if (currentUrl.includes('/artist/team')) {
            this.activeTab = 'team';
          } else if (currentUrl.includes('/artist/epk')) {
            this.activeTab = 'manage-epk';
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
  }

  onArtistSelected(artist: Artist): void {
    this.selectedArtist = artist;
    // Reset to profile tab when artist changes
    this.activeTab = 'profile';
  }

  onAlertMessage(alert: { type: 'success' | 'error', message: string }): void {
    if (alert.type === 'success') {
      this.notificationService.showSuccess(alert.message);
    } else {
      this.notificationService.showError(alert.message);
    }
  }

  onArtistUpdated(artist: ArtistProfile): void {
    if (this.selectedArtist) {
      // Update the global artist state with complete profile data
      this.artistStateService.updateSelectedArtist(artist);
    }
  }

  onReleaseCreated(release: any): void {
    // Navigate back to releases tab to show the updated list
    this.router.navigate(['/artist/releases']);
  }

  onReleaseFormCancelled(): void {
    // Navigate back to releases tab
    this.router.navigate(['/artist/releases']);
  }

  setActiveTab(tab: TabType): void {
    // Navigate to the corresponding route instead of just changing state
    this.router.navigate(['/artist', tab]);
  }

  loadAvailableArtists(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    this.http.get<{artists: Artist[], isAdmin: boolean}>(`${environment.apiUrl}/artists`, { headers }).subscribe({
      next: (response) => {
        this.availableArtists = response.artists || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.availableArtists = [];
        this.loading = false;
      }
    });
  }

  openCreateArtistModal(): void {
    // Navigate to the new artist creation page (same as the artist selection component)
    this.router.navigate(['/artist/new']);
  }

}
