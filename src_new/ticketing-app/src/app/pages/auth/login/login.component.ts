import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex">

      <!-- Left panel — branding -->
      <div class="hidden lg:flex flex-col justify-between w-2/5 border-r-2 border-white/15 p-10 relative overflow-hidden">
        <div class="absolute inset-0 opacity-[0.04]"
          style="background-image: repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%); background-size: 12px 12px;"></div>
        <div class="relative z-10">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30">
        </div>
        <div class="relative z-10">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— organizer portal —</p>
          <h2 class="text-5xl font-black text-white uppercase leading-[1] mb-5">
            Your shows.<br>Your rules.
          </h2>
          <p class="text-sm font-mono text-white/25 max-w-xs leading-relaxed">
            list your gig, sell tickets, track the door. built for the people putting on shows.
          </p>
        </div>
        <div class="relative z-10">
          <p class="text-xs font-mono text-white/15 uppercase tracking-wider">no service fees. no gatekeeping.</p>
        </div>
      </div>

      <!-- Right panel — form -->
      <div class="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div class="w-full max-w-sm">

          <div class="lg:hidden mb-8">
            <img src="/assets/logo-light-bg.png" alt="Your Scene" class="h-6">
          </div>

          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-7">Sign in to your account</p>

          @if (errorMessage()) {
            <div class="mb-5 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">
              {{ errorMessage() }}
            </div>
          }

          @if (googleAuthEnabled) {
            <a (click)="googleSignIn()" class="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer transition-colors mb-4">
              <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>

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
                  placeholder="you@example.com">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                <input type="password" formControlName="password"
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="••••••••">
              </div>
            </div>

            <div class="mt-2 text-right">
              <a routerLink="/app/forgot-password" class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">Forgot password?</a>
            </div>

            <button type="submit" [disabled]="loading()"
              class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
              {{ loading() ? 'Signing in...' : 'Sign in' }}
            </button>
          </form>

          <p class="mt-6 text-xs font-mono text-gray-500 text-center">
            Don't have an account?
            <a routerLink="/app/signup" class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">Create one</a>
          </p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  form: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  googleAuthEnabled = environment.googleAuthEnabled;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  googleSignIn(): void {
    window.location.href = `${environment.apiUrl}/auth/ticketing/google`;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res.status === 'profile_incomplete') {
          this.router.navigate(['/app/complete-profile']);
        } else {
          this.router.navigate(['/app/dashboard']);
        }
      },
      error: (err: any) => {
        this.errorMessage.set(err.error?.error || 'Login failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
