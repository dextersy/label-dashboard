import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-white flex flex-col">

      <!-- Header -->
      <div class="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <img src="/assets/logo-light-bg.png" alt="Your Scene" class="h-5">
        <button type="button" (click)="cancel()"
          class="text-xs font-mono text-gray-400 hover:text-gray-600 uppercase tracking-wider transition-colors">
          Cancel
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 px-6 py-7 max-w-sm mx-auto w-full">

        @if (exchanging()) {
          <p class="text-xs font-mono text-gray-400 animate-pulse">Signing you in...</p>
        } @else {

          <!-- Benefits -->
          <div class="mb-6">
            <h1 class="text-sm font-bold text-gray-900 mb-4">Create a free Your Scene account to:</h1>
            <ul class="space-y-2.5">
              <li class="flex items-start gap-2.5 text-xs font-mono text-gray-600">
                <svg class="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Access all your tickets in one place, anytime
              </li>
              <li class="flex items-start gap-2.5 text-xs font-mono text-gray-600">
                <svg class="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Save your information — no need to input every time
              </li>
              <li class="flex items-start gap-2.5 text-xs font-mono text-gray-600">
                <svg class="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Discover local shows and events you'll love
              </li>
            </ul>
          </div>

          <div class="h-px bg-gray-100 mb-6"></div>

          <!-- Error -->
          @if (error()) {
            <div class="mb-4 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">
              {{ error() }}
            </div>
          }

          <!-- Google -->
          @if (googleAuthEnabled) {
            <button type="button" (click)="googleSignIn()"
              class="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer transition-colors mb-4">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-xs font-mono text-gray-400 uppercase tracking-widest">or</span>
              <div class="flex-1 h-px bg-gray-200"></div>
            </div>
          }

          <!-- Tabs -->
          <div class="flex border border-gray-200 mb-5">
            <button type="button"
              class="flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors"
              [class.bg-black]="tab() === 'login'"
              [class.text-white]="tab() === 'login'"
              [class.text-gray-400]="tab() !== 'login'"
              (click)="tab.set('login')">
              Log in
            </button>
            <button type="button"
              class="flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors border-l border-gray-200"
              [class.bg-black]="tab() === 'signup'"
              [class.text-white]="tab() === 'signup'"
              [class.text-gray-400]="tab() !== 'signup'"
              (click)="tab.set('signup')">
              Create account
            </button>
          </div>

          <!-- Login form -->
          @if (tab() === 'login') {
            <form [formGroup]="loginForm" (ngSubmit)="submitLogin()">
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                  <input type="email" formControlName="email"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="you@example.com" autocomplete="email">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                  <input type="password" formControlName="password"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="••••••••" autocomplete="current-password">
                </div>
              </div>
              <button type="submit" [disabled]="loading()"
                class="mt-5 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                {{ loading() ? 'Signing in...' : 'Sign in' }}
              </button>
            </form>
            <p class="mt-4 text-xs font-mono text-gray-500 text-center">
              No account?
              <button type="button" (click)="tab.set('signup')"
                class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
                Create one free
              </button>
            </p>
          }

          <!-- Signup form -->
          @if (tab() === 'signup') {
            @if (signupPendingEmail()) {
              <div class="border border-green-200 bg-green-50 p-5 text-center">
                <p class="text-green-700 font-mono text-sm font-bold mb-2">Check your inbox!</p>
                <p class="text-green-700 text-xs font-mono mb-4">
                  We sent a verification link to <strong>{{ signupPendingEmail() }}</strong>.
                  Click it to activate your account, then sign in here.
                </p>
                <button type="button" (click)="tab.set('login')"
                  class="text-xs font-mono text-yellow-600 hover:text-yellow-700 uppercase tracking-wider transition-colors">
                  ← Sign in
                </button>
              </div>
            } @else {
              <form [formGroup]="signupForm" (ngSubmit)="submitSignup()">
                <div class="space-y-4">
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">First name</label>
                      <input type="text" formControlName="first_name"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                        autocomplete="given-name">
                    </div>
                    <div class="flex-1">
                      <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Last name</label>
                      <input type="text" formControlName="last_name"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                        autocomplete="family-name">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                    <input type="email" formControlName="email"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="you@example.com" autocomplete="email">
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                    <div class="relative">
                      <input [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors pr-14"
                        placeholder="Min. 8 characters" autocomplete="new-password">
                      <button type="button" (click)="showPassword.set(!showPassword())"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs font-mono uppercase tracking-wider">
                        {{ showPassword() ? 'Hide' : 'Show' }}
                      </button>
                    </div>
                  </div>
                </div>
                <p class="mt-3 text-xs text-gray-400 leading-snug">
                  Tickets previously purchased with your email will be automatically linked to your profile.
                </p>
                <button type="submit" [disabled]="loading()"
                  class="mt-4 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ loading() ? 'Creating account...' : 'Create account' }}
                </button>
              </form>
              <p class="mt-4 text-xs font-mono text-gray-500 text-center">
                Already have an account?
                <button type="button" (click)="tab.set('login')"
                  class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
                  Sign in
                </button>
              </p>
            }
          }

        }
      </div>
    </div>
  `
})
export class ConnectComponent implements OnInit {
  tab = signal<'login' | 'signup'>('login');
  loading = signal(false);
  exchanging = signal(false);
  error = signal('');
  showPassword = signal(false);
  signupPendingEmail = signal('');

  loginForm: FormGroup;
  signupForm: FormGroup;

  googleAuthEnabled = environment.googleAuthEnabled;
  private returnTo = '';

  constructor(
    private fb: FormBuilder,
    private audienceAuth: AudienceAuthService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
    this.signupForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.returnTo = params.get('return_to') || '';

    // Handle Google OAuth return: ?audience_code=<code>
    const audienceCode = params.get('audience_code');
    if (audienceCode) {
      this.exchanging.set(true);
      this.http.post<any>(`${environment.apiUrl}/auth/audience/google/exchange`, { code: audienceCode })
        .subscribe({
          next: (res) => { this.exchanging.set(false); this.notifyAndClose(res); },
          error: () => { this.exchanging.set(false); this.error.set('Google sign-in failed. Please try again.'); }
        });
      return;
    }

    // If already logged in, pass token straight back
    if (this.audienceAuth.isLoggedIn()) {
      this.notifyAndClose({
        token: this.audienceAuth.getToken()!,
        user: this.audienceAuth.getUser()!,
        claimed_tickets_count: 0
      });
    }
  }

  googleSignIn(): void {
    if (window.opener && this.returnTo) {
      // Redirect the main (parent) window to Google OAuth directly, using the return_to URL
      // as the landing page after auth. This avoids the COOP problem entirely — Google's
      // Cross-Origin-Opener-Policy only severs the popup's opener, not the main window.
      // After OAuth, the backend sends the code to the buy/success page (?audience_code=),
      // which exchanges it locally without needing to communicate back through a popup.
      const googleUrl = `${environment.apiUrl}/auth/audience/google?return_to=${encodeURIComponent(this.returnTo)}`;
      window.opener.location.href = googleUrl;
      window.close();
    } else {
      // No opener (e.g., user navigated to /connect directly) — do OAuth in this window.
      sessionStorage.setItem('ys_connect_return_to', this.returnTo);
      window.location.href = `${environment.apiUrl}/auth/audience/google?return_to=${encodeURIComponent(window.location.href)}`;
    }
  }

  submitLogin(): void {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.loginForm.value;
    this.audienceAuth.login(email, password).subscribe({
      next: (res) => { this.loading.set(false); this.notifyAndClose(res); },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Login failed. Please try again.');
      }
    });
  }

  submitSignup(): void {
    if (this.signupForm.invalid) { this.signupForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const { first_name, last_name, email, password } = this.signupForm.value;
    this.audienceAuth.signup(email, password, first_name, last_name).subscribe({
      next: () => { this.loading.set(false); this.signupPendingEmail.set(email); },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
      }
    });
  }

  cancel(): void {
    if (window.opener) {
      window.close();
    } else {
      this.router.navigate(['/']);
    }
  }

  private notifyAndClose(res: { token: string; user: any; claimed_tickets_count: number }): void {
    if (window.opener) {
      // Normal popup flow — postMessage to parent then close
      const targetOrigin = this.returnTo ? new URL(this.returnTo).origin : '*';
      window.opener.postMessage({ type: 'ys_auth', ...res }, targetOrigin);
      window.close();
    } else {
      // window.opener was severed by Google's COOP headers.
      // Redirect the popup back to return_to with auth data in the URL fragment.
      // Fragments are not sent to servers and are cleared immediately by the parent page.
      const returnTo = this.returnTo || sessionStorage.getItem('ys_connect_return_to') || '';
      sessionStorage.removeItem('ys_connect_return_to');
      if (returnTo) {
        const payload = encodeURIComponent(JSON.stringify({ type: 'ys_auth', ...res }));
        window.location.href = `${returnTo}#ys_auth=${payload}`;
      } else {
        this.router.navigate(['/my-shows']);
      }
    }
  }
}
