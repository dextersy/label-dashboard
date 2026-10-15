import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';
import { IconComponent } from '../../components/shared/icon/icon.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-event-invite',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './event-invite.component.html',
})
export class EventInviteComponent implements OnInit {
  loading = true;
  state: 'loading' | 'error' = 'loading';
  errorMessage = '';

  brandName = '';
  brandLogo = 'assets/img/Your Logo Here.png';
  brandColor = '#667eea';

  private hash = '';
  private apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private brandService: BrandService,
  ) {}

  ngOnInit(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (settings) => {
        this.brandName = settings.name;
        this.brandLogo = settings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandColor = settings.brand_color;
        BrandService.setCssVars(this.brandColor);
      },
      error: () => {}
    });

    this.route.queryParams.subscribe(params => {
      this.hash = params['hash'];
      if (!this.hash) {
        this.state = 'error';
        this.errorMessage = 'Invalid or missing invitation link.';
        this.loading = false;
        return;
      }
      this.loadInviteInfo();
    });
  }

  private loadInviteInfo(): void {
    this.http.get<any>(`${this.apiUrl}/event-access/invite-info?hash=${this.hash}`).subscribe({
      next: (info) => {
        this.brandName = info.brand_name || this.brandName;
        this.brandLogo = info.brand_logo || this.brandLogo;
        this.brandColor = info.brand_color || this.brandColor;

        if (info.status === 'Accepted') {
          this.state = 'error';
          this.errorMessage = 'This invitation has already been accepted.';
          this.loading = false;
          return;
        }

        this.acceptInvite();
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'This invitation link is invalid or has expired.';
        this.loading = false;
      }
    });
  }

  private acceptInvite(): void {
    this.http.post<any>(`${this.apiUrl}/event-access/accept`, { hash: this.hash }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.action === 'create_account') {
          // New user: go directly to set-profile (mirrors artist team invite flow)
          this.router.navigate(['/set-profile'], { queryParams: { event_invite_hash: this.hash } });
        } else if (response.action === 'accepted') {
          if (response.token) {
            // Auto-login with the returned token (mirrors artist team invite flow)
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
          }
          // Refresh auth/me so event access is reflected, then navigate
          this.authService.refreshUserData().subscribe({
            next: () => this.router.navigate(['/campaigns/events/tickets']),
            error: () => this.router.navigate(['/campaigns/events/tickets']),
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.state = 'error';
        this.errorMessage = err.error?.error || 'Failed to process the invitation.';
      }
    });
  }

}
