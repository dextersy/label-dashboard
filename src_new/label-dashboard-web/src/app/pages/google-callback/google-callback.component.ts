import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';
import { WorkspaceService, WorkspaceType } from '../../services/workspace.service';

/**
 * Landing page after the server-side Google OAuth redirect.
 * The backend redirects here with a short-lived one-time exchange code:
 *   ?code=<hex>   — always; the component POSTs it to /auth/dashboard/google/exchange
 *                   to receive the JWT in a normal JSON response body (never in the URL).
 * Auth errors are sent to the login page as ?error=<reason>.
 */
@Component({
  selector: 'app-google-callback',
  imports: [CommonModule],
  template: `
    <div class="tw-min-h-screen tw-bg-gray-50 tw-flex tw-items-center tw-justify-center">
      <p class="tw-text-sm tw-text-gray-400">{{ message }}</p>
    </div>
  `
})
export class GoogleCallbackComponent implements OnInit {
  message = 'Signing you in...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private brandService: BrandService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');

    if (!code) {
      this.message = 'Something went wrong. Redirecting...';
      setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 1500);
      return;
    }

    this.auth.exchangeGoogleCode(code).subscribe({
      next: (res: any) => {
        if (res.status === 'profile_incomplete') {
          this.router.navigate(['/set-profile'], { replaceUrl: true });
        } else {
          this.navigateToDefaultPage(res.user?.is_admin ?? false);
        }
      },
      error: () => {
        this.message = 'Something went wrong. Redirecting...';
        setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 1500);
      }
    });
  }

  private navigateToDefaultPage(isAdmin: boolean): void {
    const page = this.getDefaultPageForWorkspace(isAdmin);
    if (page === '/domain-not-found') {
      this.router.navigate([page], { queryParams: { reason: 'no-workspace' } });
    } else {
      this.router.navigate([page], { replaceUrl: true });
    }
  }

  private getDefaultPageForWorkspace(isAdmin: boolean = false): string {
    const adminOnlyWorkspaces: WorkspaceType[] = ['campaigns', 'labels', 'admin'];
    if (!isAdmin && adminOnlyWorkspaces.includes(this.workspaceService.currentWorkspace)) {
      this.workspaceService.setWorkspace('music');
    }

    const settings = this.brandService.getCurrentBrandSettings();

    if (!isAdmin && settings?.feature_music_workspace === false) {
      return '/domain-not-found';
    }

    if (this.workspaceService.currentWorkspace === 'music' && settings?.feature_music_workspace === false) {
      const availableWorkspaces = this.workspaceService.getAvailableWorkspaces(isAdmin);
      if (availableWorkspaces.length > 0) {
        this.workspaceService.setWorkspace(availableWorkspaces[0]);
      }
    }

    switch (this.workspaceService.currentWorkspace) {
      case 'music':
        return '/dashboard';
      case 'campaigns':
        return '/campaigns/dashboard';
      case 'labels':
        return '/labels/earnings';
      case 'admin':
        return '/admin/reports/music-earnings';
      default:
        return '/dashboard';
    }
  }
}
