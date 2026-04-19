import { Component, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30">
          <p class="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">Create your organizer account</p>
        </div>

        @if (error()) {
          <div class="mb-5 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
            {{ error() }}
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

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      brand_name: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  passwordStrength = computed(() => {
    const p = this.form.get('password')?.value || '';
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
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.signup(this.form.value).subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
