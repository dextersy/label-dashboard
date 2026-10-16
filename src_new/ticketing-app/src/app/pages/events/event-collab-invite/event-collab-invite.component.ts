import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-event-collab-invite',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-sm">

        <!-- Brand header -->
        <div class="flex flex-col items-center mb-8">
          @if (brandLogo) {
            <div
              class="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 overflow-hidden shadow-md"
              [style.background-color]="brandColor">
              <img [src]="brandLogo" [alt]="ownerBrandName" class="max-w-full max-h-full object-contain p-2">
            </div>
          }
          <h1 class="text-xl font-bold text-white">{{ ownerBrandName }}</h1>
        </div>

        <div class="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">

          <!-- Loading -->
          @if (state === 'loading') {
            <div class="flex flex-col items-center gap-4">
              <svg class="animate-spin h-10 w-10 text-white/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <p class="text-sm text-white/50">Processing your invitation&hellip;</p>
            </div>
          }

          <!-- Success -->
          @if (state === 'success') {
            <div class="flex flex-col items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg class="w-7 h-7 text-green-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 class="text-base font-semibold text-white mb-1">Invitation Accepted!</h2>
                <p class="text-sm text-white/60">
                  You now have <strong class="text-white">{{ role }}</strong> access to <strong class="text-white">{{ eventTitle }}</strong>.
                </p>
                <p class="text-xs text-white/30 mt-2">Redirecting you to your events&hellip;</p>
              </div>
            </div>
          }

          <!-- Error -->
          @if (state === 'error') {
            <div class="flex flex-col items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h2 class="text-base font-semibold text-white mb-1">Invitation Error</h2>
                <p class="text-sm text-white/60">{{ errorMessage }}</p>
              </div>
              <a routerLink="/app/login"
                class="w-full py-2.5 px-4 rounded-lg text-black font-semibold text-sm flex items-center justify-center bg-white hover:bg-white/90 transition-colors">
                Go to Login
              </a>
            </div>
          }

        </div>
      </div>
    </div>
  `,
})
export class EventCollabInviteComponent implements OnInit {
  state: 'loading' | 'success' | 'error' = 'loading';
  errorMessage = '';

  eventTitle = '';
  role = '';
  ownerBrandName = '';
  brandLogo = '';
  brandColor = '#1595e7';

  private hash = '';
  private apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
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
        this.brandLogo = info.owner_brand_logo || '';
        this.brandColor = info.owner_brand_color || this.brandColor;

        if (info.status === 'Accepted') {
          this.state = 'error';
          this.errorMessage = 'This invitation has already been accepted.';
          return;
        }

        if (!this.authService.isLoggedIn()) {
          this.router.navigate(['/app/login'], {
            queryParams: {
              mode: 'organizer',
              returnUrl: encodeURIComponent(`/event-brand-collab-invite?hash=${this.hash}`)
            }
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
    const token = this.authService.getToken() || '';
    this.http.post<any>(
      `${this.apiUrl}/event-brand-collab/accept`,
      { hash: this.hash },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => {
          this.router.navigate(['/app/events']);
        }, 1500);
      },
      error: (err) => {
        this.state = 'error';
        this.errorMessage = err.error?.error || 'Failed to accept the invitation.';
      }
    });
  }
}
