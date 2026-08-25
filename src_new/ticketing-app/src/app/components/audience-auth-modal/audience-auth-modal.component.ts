import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AudienceAuthService } from '../../services/audience-auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-audience-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-[9000] flex items-center justify-center px-4"
      (click)="closed.emit()">
      <div class="absolute inset-0 bg-black/80"></div>

      <!-- Modal -->
      <div class="relative z-10 w-full max-w-sm bg-white p-8 shadow-2xl"
        (click)="$event.stopPropagation()">

        <button (click)="closed.emit()"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none font-mono">
          &times;
        </button>

        <h2 class="text-lg font-black text-black uppercase tracking-wider mb-1">Sign in</h2>
        <p class="text-xs font-mono text-gray-400 mb-6">Sign in to like this show and track your scene.</p>

        @if (error()) {
          <div class="mb-4 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ error() }}</div>
        }

        @if (googleAuthEnabled || facebookAuthEnabled) {
          <div class="space-y-2 mb-4">
            @if (googleAuthEnabled) {
              <a (click)="googleSignIn()" class="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>
            }
            @if (facebookAuthEnabled) {
              <a (click)="facebookSignIn()" class="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer transition-colors">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Continue with Facebook
              </a>
            }
          </div>
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs font-mono text-gray-400 uppercase tracking-widest">or</span>
            <div class="flex-1 h-px bg-gray-200"></div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
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

        <p class="mt-5 text-xs font-mono text-gray-500 text-center">
          No account?
          <a [routerLink]="['/login']"
            [queryParams]="{ mode: 'audience', view: 'signup', returnUrl: encodedSignupReturnUrl }"
            (click)="closed.emit()"
            class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
            Create one
          </a>
        </p>
      </div>
    </div>
  `
})
export class AudienceAuthModalComponent {
  @Input() signupReturnUrl = '/';
  @Output() closed = new EventEmitter<void>();
  @Output() authenticated = new EventEmitter<void>();

  get encodedSignupReturnUrl(): string {
    return encodeURIComponent(this.signupReturnUrl);
  }

  form: FormGroup;
  loading = signal(false);
  error = signal('');
  googleAuthEnabled = environment.googleAuthEnabled;
  facebookAuthEnabled = environment.facebookAuthEnabled;

  constructor(private fb: FormBuilder, private audienceAuth: AudienceAuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  googleSignIn(): void {
    // After Google OAuth, the login page will handle the code exchange and use returnUrl to come back
    const returnTo = `${window.location.origin}/login?mode=audience&returnUrl=${encodeURIComponent(this.signupReturnUrl)}`;
    window.location.href = `${environment.apiUrl}/auth/audience/google?return_to=${encodeURIComponent(returnTo)}`;
  }

  facebookSignIn(): void {
    const returnTo = `${window.location.origin}/login?mode=audience&returnUrl=${encodeURIComponent(this.signupReturnUrl)}`;
    window.location.href = `${environment.apiUrl}/auth/audience/facebook?return_to=${encodeURIComponent(returnTo)}`;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    this.audienceAuth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.authenticated.emit();
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Login failed. Please try again.');
      }
    });
  }
}
