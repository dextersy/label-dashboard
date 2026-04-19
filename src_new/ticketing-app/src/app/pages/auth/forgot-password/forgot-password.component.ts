import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30">
          <p class="text-xs font-mono text-white/30 uppercase tracking-widest mt-4">Reset your password</p>
        </div>

        @if (sent()) {
          <div class="border border-green-500/30 bg-green-500/10 p-6 text-center">
            <p class="text-green-400 text-sm font-mono mb-4">Check your email for reset instructions.</p>
            <a routerLink="/app/login" class="text-xs font-mono text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">← back to login</a>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <p class="text-xs font-mono text-white/30 mb-5">enter your email and we'll send you a reset link.</p>
            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" formControlName="email"
                class="w-full px-3 py-2.5 bg-zinc-900 border border-white/15 text-white text-sm placeholder-white/20 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="you@example.com">
            </div>
            <button type="submit" [disabled]="loading()"
              class="mt-4 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
              {{ loading() ? 'Sending...' : 'Send reset link' }}
            </button>
            <p class="mt-5 text-center">
              <a routerLink="/app/login" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">← back to login</a>
            </p>
          </form>
        }
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = signal(false);
  sent = signal(false);

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.http.post(`${environment.apiUrl}/auth/forgot-password`, this.form.value).subscribe({
      next: () => { this.sent.set(true); this.loading.set(false); },
      error: () => { this.sent.set(true); this.loading.set(false); }
    });
  }
}
