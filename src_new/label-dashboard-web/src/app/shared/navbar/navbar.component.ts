import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ArtistStateService } from '../../services/artist-state.service';
import { WorkspaceService, WorkspaceType } from '../../services/workspace.service';
import { ArtistSelectionComponent } from '../../components/artist/artist-selection/artist-selection.component';
import { Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { Subscription } from 'rxjs';

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
  currentWorkspace: WorkspaceType = 'music';
  private authSubscription: Subscription = new Subscription();
  private workspaceSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private artistStateService: ArtistStateService,
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
  }

  // Workspace methods
  selectWorkspace(workspace: WorkspaceType): void {
    this.workspaceService.setWorkspace(workspace);
  }

  getWorkspaceLabel(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceLabel(workspace);
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    return this.workspaceService.getWorkspaceIcon(workspace);
  }

  get availableWorkspaces(): WorkspaceType[] {
    // Return all workspaces, but filter based on admin status for events
    // Administration is now moved to the right-side menu
    const workspaces: WorkspaceType[] = ['music'];
    if (this.isAdmin) {
      workspaces.push('events');
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
}
