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
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-primary-600">Your Scene</h1>
          <p class="mt-2 text-gray-500">Create your organizer account</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          @if (error()) {
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" formControlName="full_name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Jane Smith">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" formControlName="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="you@example.com">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Organization / Event Brand Name</label>
                <input type="text" formControlName="brand_name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="My Events Co.">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" formControlName="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••">
                <!-- Password strength indicator -->
                @if (form.get('password')?.value) {
                  <div class="mt-2">
                    <div class="flex gap-1">
                      @for (i of [1,2,3,4]; track i) {
                        <div class="h-1 flex-1 rounded-full transition-colors"
                          [class]="i <= passwordStrength() ? strengthColor() : 'bg-gray-200'"></div>
                      }
                    </div>
                    <p class="text-xs mt-1" [class]="strengthTextColor()">{{ strengthLabel() }}</p>
                  </div>
                }
              </div>
            </div>

            <button type="submit" [disabled]="loading()"
              class="mt-6 w-full py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {{ loading() ? 'Creating account...' : 'Create account' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-gray-500">
            Already have an account?
            <a routerLink="/login" class="text-primary-600 font-medium hover:underline">Sign in</a>
          </p>
        </div>
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
    if (s <= 1) return 'bg-red-400';
    if (s === 2) return 'bg-yellow-400';
    if (s === 3) return 'bg-blue-400';
    return 'bg-green-500';
  });

  strengthTextColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'text-red-500';
    if (s === 2) return 'text-yellow-600';
    if (s === 3) return 'text-blue-600';
    return 'text-green-600';
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
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
