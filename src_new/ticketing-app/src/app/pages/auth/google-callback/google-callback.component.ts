import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

/**
 * Landing page after the server-side Google OAuth redirect.
 * The backend redirects here with a short-lived one-time exchange code:
 *   ?code=<hex>   — always; the component POSTs it to /auth/ticketing/google/exchange
 *                   to receive the JWT in a normal JSON response body (never in the URL).
 * Auth errors are sent to the login page as ?error=<reason>.
 */
@Component({
  selector: 'app-google-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center">
      <p class="text-xs font-mono text-white/30 uppercase tracking-widest animate-pulse">
        {{ message }}
      </p>
    </div>
  `
})
export class GoogleCallbackComponent implements OnInit {
  message = 'Signing you in...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');

    if (!code) {
      this.message = 'Something went wrong. Redirecting...';
      setTimeout(() => this.router.navigate(['/app/login'], { replaceUrl: true }), 1500);
      return;
    }

    // Exchange the one-time code for a JWT via a POST request.
    // The token is received in the JSON response body — never from the URL.
    this.auth.exchangeGoogleCode(code).subscribe({
      next: (res: any) => {
        if (res.status === 'profile_incomplete') {
          this.router.navigate(['/app/complete-profile'], { replaceUrl: true });
        } else {
          this.router.navigate(['/app/dashboard'], { replaceUrl: true });
        }
      },
      error: () => {
        this.message = 'Something went wrong. Redirecting...';
        setTimeout(() => this.router.navigate(['/app/login'], { replaceUrl: true }), 1500);
      }
    });
  }
}
