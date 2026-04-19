import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30">
          <p class="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">One last step</p>
        </div>

        @if (!hasTempToken()) {
          <div class="border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p class="text-red-400 text-sm font-mono mb-4">Session expired or invalid. Please sign in again.</p>
            <a routerLink="/app/login" class="text-xs font-mono text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">← Back to login</a>
          </div>
        } @else {
          @if (error()) {
            <div class="mb-5 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
              {{ error() }}
            </div>
          }

          <p class="text-xs font-mono text-white/30 mb-6">
            Choose a username for your organizer account.
            @if (needsTerms()) { You'll also need to accept the terms. }
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Username</label>
                <input type="text" formControlName="username"
                  class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="your_username"
                  autocomplete="username">
                <p class="mt-1 text-xs font-mono text-white/20">3–30 characters. Letters, numbers, _ and - only.</p>
              </div>

              @if (needsTerms()) {
                <div class="pt-1">
                  <label class="flex items-start gap-3 cursor-pointer">
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
              }
            </div>

            <button type="submit" [disabled]="loading()"
              class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
              {{ loading() ? 'Saving...' : 'Continue to dashboard' }}
            </button>
          </form>
        }
      </div>
    </div>
  `
})
export class CompleteProfileComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  hasTempToken = signal(false);
  needsTerms = signal(false);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    });
  }

  ngOnInit(): void {
    const hasTempToken = !!this.auth.getTempToken();
    this.hasTempToken.set(hasTempToken);

    const needsTerms = this.auth.needsTerms();
    this.needsTerms.set(needsTerms);

    if (needsTerms) {
      this.form.addControl('terms_accepted', this.fb.control(false, Validators.requiredTrue));
    }

    // If somehow they land here while already fully logged in, redirect to dashboard
    if (!hasTempToken && this.auth.isLoggedIn()) {
      this.router.navigate(['/app/dashboard']);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const payload: any = { username: this.form.value.username };
    if (this.needsTerms()) {
      payload.terms_accepted = true;
    }

    this.auth.completeProfile(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app/dashboard']);
      },
      error: (err: any) => {
        this.error.set(err.error?.error || 'Failed to save profile. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
