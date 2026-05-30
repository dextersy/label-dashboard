import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AudienceAuthService } from '../../../services/audience-auth.service';

type State = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-6">
      <div class="w-full max-w-sm text-center">
        <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6 mx-auto mb-10 opacity-40"></a>

        @if (state() === 'loading') {
          <div class="flex justify-center">
            <div class="w-8 h-8 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin"></div>
          </div>
        }

        @if (state() === 'success') {
          <div class="border border-green-500/30 bg-green-500/10 p-8">
            <p class="text-green-400 text-2xl mb-3">✓</p>
            <p class="text-white font-black uppercase text-lg tracking-wider mb-2">Email verified!</p>
            <p class="text-white/50 text-xs font-mono mb-6">Your email address has been confirmed.</p>
            <a routerLink="/my-shows"
              class="inline-block py-2.5 px-6 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
              Go to My Shows
            </a>
          </div>
        }

        @if (state() === 'error') {
          <div class="border border-red-500/30 bg-red-500/10 p-8">
            <p class="text-red-400 text-2xl mb-3">✗</p>
            <p class="text-white font-black uppercase text-lg tracking-wider mb-2">Link expired</p>
            <p class="text-white/50 text-xs font-mono mb-6">{{ errorMessage() }}</p>
            @if (audienceAuth.isLoggedIn()) {
              <button type="button" (click)="resend()" [disabled]="resending()"
                class="inline-block py-2.5 px-6 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                {{ resending() ? 'Sending...' : 'Resend verification email' }}
              </button>
              @if (resentOk()) {
                <p class="mt-4 text-green-400 text-xs font-mono">A new verification email has been sent.</p>
              }
            } @else {
              <a routerLink="/login"
                class="inline-block py-2.5 px-6 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                Sign in to resend
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class VerifyEmailComponent implements OnInit {
  state = signal<State>('loading');
  errorMessage = signal('This verification link is invalid or has expired.');
  resending = signal(false);
  resentOk = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public audienceAuth: AudienceAuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }

    this.audienceAuth.verifyEmail(token).subscribe({
      next: () => {
        this.audienceAuth.markEmailVerified();
        this.state.set('success');
      },
      error: (err: any) => {
        this.errorMessage.set(err.error?.error || 'This verification link is invalid or has expired.');
        this.state.set('error');
      },
    });
  }

  resend(): void {
    this.resending.set(true);
    this.audienceAuth.resendVerification().subscribe({
      next: () => { this.resending.set(false); this.resentOk.set(true); },
      error: () => { this.resending.set(false); },
    });
  }
}
