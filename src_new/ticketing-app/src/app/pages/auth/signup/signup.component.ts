import { Component, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30"></a>
          <p class="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">Create your organizer account</p>
        </div>

        @if (error()) {
          <div class="mb-5 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
            {{ error() }}
          </div>
        }

        @if (googleAuthEnabled) {
          <a (click)="googleSignUp()" class="flex items-center justify-center gap-3 w-full py-2.5 px-4 border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-medium cursor-pointer transition-colors mb-6">
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </a>
          <div class="flex items-center gap-3 mb-6">
            <div class="flex-1 h-px bg-white/10"></div>
            <span class="text-xs font-mono text-white/30 uppercase tracking-widest">or</span>
            <div class="flex-1 h-px bg-white/10"></div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Full Name</label>
              <input type="text" formControlName="full_name"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="Jane Smith">
            </div>
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" formControlName="email"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="you@example.com">
            </div>
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Organization / Event Brand</label>
              <input type="text" formControlName="brand_name"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="My Events Co.">
            </div>
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Username</label>
              <input type="text" formControlName="username"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="your_username"
                autocomplete="username">
              <p class="mt-1 text-xs font-mono text-white/20">3–30 characters. Letters, numbers, _ and - only.</p>
              @if (form.get('username')?.invalid && form.get('username')?.touched) {
                <p class="mt-1 text-xs font-mono text-red-400">3–30 characters, letters, numbers, _ and - only.</p>
              }
            </div>
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Password</label>
              <input type="password" formControlName="password"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="••••••••">
              @if (form.get('password')?.value) {
                <div class="mt-2">
                  <div class="flex gap-1">
                    @for (i of [1,2,3,4]; track i) {
                      <div class="h-0.5 flex-1 transition-colors"
                        [class]="i <= passwordStrength() ? strengthColor() : 'bg-white/10'"></div>
                    }
                  </div>
                  <p class="text-xs font-mono mt-1" [class]="strengthTextColor()">{{ strengthLabel() }}</p>
                </div>
              }
            </div>

            <!-- Terms & Conditions -->
            <div class="pt-1">
              <label class="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" formControlName="terms_accepted"
                  class="mt-0.5 h-4 w-4 flex-shrink-0 accent-yellow-400 cursor-pointer">
                <span class="text-xs font-mono text-white/40 leading-relaxed">
                  I have read and agree to the
                  <a routerLink="/app/terms" target="_blank"
                    class="text-yellow-400 hover:text-yellow-300 underline transition-colors">Terms and Conditions</a>
                </span>
              </label>
              @if (form.get('terms_accepted')?.invalid && form.get('terms_accepted')?.touched) {
                <p class="mt-1 text-xs font-mono text-red-400">You must accept the terms to continue.</p>
              }
            </div>
          </div>

          <button type="submit" [disabled]="loading()"
            class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
            {{ loading() ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="mt-6 text-xs font-mono text-white/30 text-center">
          Already have an account?
          <a routerLink="/app/login" class="text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors ml-1">Sign in</a>
        </p>
      </div>
    </div>
  `
})
export class SignupComponent {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  googleAuthEnabled = environment.googleAuthEnabled;
  passwordValue = signal('');

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/app/dashboard']);
    }
    this.form = this.fb.group({
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      brand_name: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      terms_accepted: [false, Validators.requiredTrue]
    });
    this.form.get('password')!.valueChanges.subscribe(v => this.passwordValue.set(v || ''));
  }

  googleSignUp(): void {
    window.location.href = `${environment.apiUrl}/auth/ticketing/google`;
  }

  passwordStrength = computed(() => {
    const p = this.passwordValue();
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  });

  strengthColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'bg-red-500';
    if (s === 2) return 'bg-yellow-400';
    if (s === 3) return 'bg-yellow-300';
    return 'bg-green-400';
  });

  strengthTextColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'text-red-400';
    if (s === 2) return 'text-yellow-400';
    if (s === 3) return 'text-yellow-300';
    return 'text-green-400';
  });

  strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Good';
    return 'Strong';
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.signup(this.form.value).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res.status === 'profile_incomplete') {
          this.router.navigate(['/app/complete-profile']);
        } else {
          this.router.navigate(['/app/dashboard']);
        }
      },
      error: (err: any) => {
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
