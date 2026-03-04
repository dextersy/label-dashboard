import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';

@Component({
    selector: 'app-invite',
    imports: [CommonModule, RouterLink],
    templateUrl: './invite.component.html',
    styleUrl: './invite.component.scss'
})
export class InviteComponent implements OnInit, OnDestroy {
  loading: boolean = true;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  inviteHash: string = '';

  // Brand settings (matching login page)
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    // Load brand settings
    this.loadBrandSettings();

    // First logout any existing session (matching setprofile.php behavior)
    this.authService.logout();

    // Get invite hash from query parameters (matching original PHP invite flow)
    this.route.queryParams.subscribe(params => {
      this.inviteHash = params['hash'];

      if (!this.inviteHash) {
        this.loading = false;
        this.showMessage('Invalid or expired invitation link', 'error');
        return;
      }
      this.processInvite();
    });
  }

  ngOnDestroy(): void {
    // Component cleanup
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.brand_color;

        // Apply brand styling to the page
        BrandService.setCssVars(this.brandColor);
        document.title = `${this.brandName} - Invite`;
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
      }
    });
  }

  private processInvite(): void {
    this.loading = true;
    this.apiService.processInvite(this.inviteHash).subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.action === 'redirect_to_setup') {
          // User needs to set up profile (no password set)
          this.router.navigate(['/set-profile'], { queryParams: { hash: this.inviteHash } });
        } else if (response.action === 'redirect_to_artist') {
          // User already exists with password, mark as accepted and redirect
          if (response.token) {
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
          }
          // Redirect to artist page with selected artist
          this.router.navigate(['/artist'], { queryParams: { artist_id: response.artist_id } });
        } else {
          this.showMessage('Unknown response from server', 'error');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error processing invite:', error);

        // Use backend error message for all invite errors
        const errorMessage = error.error?.error || 'Invalid or expired invitation';
        this.showMessage(errorMessage, 'error');
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }
}