import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';
import { IconComponent } from '../../components/shared/icon/icon.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-event-brand-collab-invite',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './event-brand-collab-invite.component.html',
})
export class EventBrandCollabInviteComponent implements OnInit {
  state: 'loading' | 'success' | 'error' = 'loading';
  errorMessage = '';

  eventTitle = '';
  role = '';
  ownerBrandName = '';

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
        return;
      }
      this.loadInviteInfo();
    });
  }

  private loadInviteInfo(): void {
    this.http.get<any>(`${this.apiUrl}/event-brand-collab/invite-info?hash=${this.hash}`).subscribe({
      next: (info) => {
        this.eventTitle = info.event_title || '';
        this.role = info.role || '';
        this.ownerBrandName = info.owner_brand_name || '';
        this.brandLogo = info.owner_brand_logo || this.brandLogo;
        this.brandColor = info.owner_brand_color || this.brandColor;

        if (info.status === 'Accepted') {
          this.state = 'error';
          this.errorMessage = 'This invitation has already been accepted.';
          return;
        }

        // Must be logged in to accept — redirect to login if not
        if (!this.authService.isLoggedIn()) {
          this.router.navigate(['/login'], {
            queryParams: { redirect: `/event-brand-collab-invite?hash=${this.hash}` }
          });
          return;
        }

        this.acceptInvite();
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'This invitation link is invalid or has expired.';
      }
    });
  }

  private acceptInvite(): void {
    const token = localStorage.getItem('auth_token') || '';
    this.http.post<any>(
      `${this.apiUrl}/event-brand-collab/accept`,
      { hash: this.hash },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => {
          this.router.navigate(['/campaigns/events/tickets']);
        }, 1500);
      },
      error: (err) => {
        this.state = 'error';
        this.errorMessage = err.error?.error || 'Failed to accept the invitation.';
      }
    });
  }
}
