import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30">
          <p class="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">Set a new password</p>
        </div>

        @if (validating()) {
          <p class="text-xs font-mono text-white/30 animate-pulse">Verifying reset link...</p>
        } @else if (!tokenValid()) {
          <div class="border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p class="text-red-400 text-sm font-mono mb-4">This reset link is invalid or has already been used.</p>
            <a routerLink="/app/forgot-password" class="text-xs font-mono text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">Request a new link</a>
          </div>
        } @else if (done()) {
          <div class="border border-green-500/30 bg-green-500/10 p-6 text-center">
            <p class="text-green-400 text-sm font-mono mb-4">Password updated successfully.</p>
            <a routerLink="/app/login" class="text-xs font-mono text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">← Sign in</a>
          </div>
        } @else {
          @if (error()) {
            <div class="mb-5 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">New Password</label>
                <input type="password" formControlName="password"
                  class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="••••••••"
                  autocomplete="new-password">
                @if (passwordValue()) {
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
              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Confirm Password</label>
                <input type="password" formControlName="confirm"
                  class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="••••••••"
                  autocomplete="new-password">
                @if (form.get('confirm')?.value && form.get('password')?.value !== form.get('confirm')?.value) {
                  <p class="mt-1 text-xs font-mono text-red-400">Passwords do not match.</p>
                }
              </div>
            </div>

            <button type="submit" [disabled]="loading()"
              class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
              {{ loading() ? 'Updating...' : 'Set new password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  validating = signal(true);
  tokenValid = signal(false);
  done = signal(false);
  private resetCode = '';
  passwordValue = signal('');

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.form.get('password')!.valueChanges.subscribe(v => this.passwordValue.set(v || ''));
    this.resetCode = this.route.snapshot.queryParamMap.get('code') || '';
    if (!this.resetCode) {
      this.validating.set(false);
      this.tokenValid.set(false);
      return;
    }
    this.http.get(`${environment.apiUrl}/auth/validate-reset-hash/${this.resetCode}`).subscribe({
      next: () => { this.tokenValid.set(true); this.validating.set(false); },
      error: () => { this.tokenValid.set(false); this.validating.set(false); }
    });
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
    const { password, confirm } = this.form.value;
    if (this.form.invalid || password !== confirm) return;
    this.loading.set(true);
    this.error.set('');

    this.http.post(`${environment.apiUrl}/auth/reset-password`, { token: this.resetCode, password }).subscribe({
      next: () => { this.done.set(true); this.loading.set(false); },
      error: (err: any) => {
        this.error.set(err.error?.error || 'Failed to reset password. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
