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
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-primary-600">Your Scene</h1>
          <p class="mt-2 text-gray-500">Reset your password</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          @if (sent()) {
            <div class="text-center">
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p class="text-gray-700 text-sm">Check your email for password reset instructions.</p>
              <a routerLink="/login" class="mt-4 inline-block text-sm text-primary-600 hover:underline">Back to login</a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()">
              <p class="text-sm text-gray-600 mb-4">Enter your email and we'll send you a reset link.</p>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" formControlName="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com">
              </div>
              <button type="submit" [disabled]="loading()"
                class="mt-4 w-full py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {{ loading() ? 'Sending...' : 'Send reset link' }}
              </button>
              <p class="mt-4 text-center text-sm">
                <a routerLink="/login" class="text-primary-600 hover:underline">Back to login</a>
              </p>
            </form>
          }
        </div>
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
