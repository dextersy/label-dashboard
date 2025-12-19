import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { EventService, Event } from '../../services/event.service';
import { WorkspaceService, WorkspaceType } from '../../services/workspace.service';
import { ArtistSelectionComponent } from '../../components/artist/artist-selection/artist-selection.component';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-navbar',
    imports: [CommonModule, RouterModule, ArtistSelectionComponent],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  userFirstName: string = 'User';
  isAdmin: boolean = false;
  isSuperadmin: boolean = false;
  selectedArtist: Artist | null = null;
  selectedEvent: Event | null = null;
  currentWorkspace: WorkspaceType = 'music';
  private authSubscription: Subscription = new Subscription();
  private workspaceSubscription: Subscription = new Subscription();
  private eventSubscription: Subscription = new Subscription();
  private isInitialized: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private artistStateService: ArtistStateService,
    private eventService: EventService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    // Subscribe to current user changes
    this.authSubscription.add(
      this.authService.currentUser.subscribe(user => {
        if (user) {
          this.userFirstName = user.first_name || 'User';
          this.isAdmin = user.is_admin || false;
          this.isSuperadmin = user.is_superadmin || false;

          // Note: Workspace is now automatically restored from localStorage by WorkspaceService
          // No need to force it to 'music' here

          // Update body class based on whether mobile nav is shown
          this.updateMobileNavClass();
        } else {
          this.userFirstName = 'User';
          this.isAdmin = false;
          this.isSuperadmin = false;
        }
      })
    );

    // Subscribe to selected artist changes
    this.authSubscription.add(
      this.artistStateService.selectedArtist$.subscribe(artist => {
        this.selectedArtist = artist;
      })
    );

    // Subscribe to workspace changes
    this.workspaceSubscription.add(
      this.workspaceService.currentWorkspace$.subscribe(workspace => {
        this.currentWorkspace = workspace;
      })
    );

    // Subscribe to selected event changes
    this.eventSubscription.add(
      this.eventService.selectedEvent$.subscribe(event => {
        const previousEvent = this.selectedEvent;
        this.selectedEvent = event;

        // Close sidebar on mobile when event changes (user-initiated)
        if (this.isInitialized && previousEvent?.id !== event?.id && event !== null) {
          this.sidebarService.closeOnMobileNavigation();
        }
      })
    );

    // Mark as initialized after subscriptions are set up
    setTimeout(() => {
      this.isInitialized = true;
    }, 100);
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

  shouldShowArtistSelection(): boolean {
    const currentRoute = this.router.url;
    return currentRoute.includes('/artist') || 
           currentRoute.includes('/releases') || 
           currentRoute.includes('/financial');
  }

  ngOnDestroy(): void {
    this.authSubscription.unsubscribe();
    this.workspaceSubscription.unsubscribe();
    this.eventSubscription.unsubscribe();
  }

  // Get artist profile photo URL
  getArtistProfilePhoto(): string {
    if (this.selectedArtist?.profilePhotoImage?.path) {
      return this.selectedArtist.profilePhotoImage.path;
    }
    if (this.selectedArtist?.profile_photo) {
      return this.selectedArtist.profile_photo.startsWith('http')
        ? this.selectedArtist.profile_photo
        : `${environment.apiUrl}/uploads/artists/${this.selectedArtist.profile_photo}`;
    }
    return 'assets/img/placeholder.jpg';
  }

  // Get event poster URL
  getEventPoster(): string {
    if (this.selectedEvent?.poster_url) {
      return this.selectedEvent.poster_url;
    }
    return 'assets/img/placeholder.jpg';
  }

  // Workspace methods
  selectWorkspace(workspace: WorkspaceType): void {
    this.workspaceService.setWorkspace(workspace);
    
    // Navigate to the default page for the selected workspace
    switch (workspace) {
      case 'music':
        this.router.navigate(['/dashboard']);
        break;
      case 'events':
        this.router.navigate(['/events/details']);
        break;
      case 'labels':
        this.router.navigate(['/labels/earnings']);
        break;
      case 'admin':
        this.router.navigate(['/admin/settings']);
        break;
      default:
        this.router.navigate(['/dashboard']);
        break;
    }
  }

  getWorkspaceLabel(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceLabel(workspace);
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceIcon(workspace);
  }

  get availableWorkspaces(): WorkspaceType[] {
    // Return all workspaces, filter based on admin status
    const workspaces: WorkspaceType[] = ['music'];
    if (this.isAdmin) {
      workspaces.push('events');
      workspaces.push('labels');
    }
    return workspaces;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }

  private updateMobileNavClass(): void {
    // Add class to document root when mobile nav is visible (multiple workspaces)
    if (this.availableWorkspaces.length > 1) {
      document.documentElement.classList.add('has-mobile-nav');
    } else {
      document.documentElement.classList.remove('has-mobile-nav');
    }
  }
}
