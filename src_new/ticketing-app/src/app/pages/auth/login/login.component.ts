import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

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

          @if (error()) {
            <div class="mb-5 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">
              {{ error() }}
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
  error = signal('');

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Login failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
