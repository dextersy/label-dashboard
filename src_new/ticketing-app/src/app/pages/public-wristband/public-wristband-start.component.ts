import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PublicWristbandService } from '../../services/public-wristband.service';

@Component({
  selector: 'app-public-wristband-start',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
  <div class="w-full max-w-md">

    <div class="text-center mb-8">
      <img src="/assets/logo-light-bg.png" alt="Your Scene" class="h-8 mx-auto mb-6" />
      <h1 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Order Wristbands</h1>
      <p class="text-sm text-gray-500 mt-2">Enter your name and email to get started. We'll send you a secure link to manage your order.</p>
    </div>

    @if (submitted) {
      <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div class="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-900 mb-2">Check your email!</h2>
        <p class="text-sm text-gray-500 leading-relaxed">
          We sent a link to <strong>{{ email }}</strong>.<br>
          Click the link in your email to continue filling in your order.
        </p>
        <p class="text-xs text-gray-400 mt-4">Didn't receive it? Check your spam folder or <button (click)="reset()" class="underline hover:text-gray-600">try again</button>.</p>
      </div>
    } @else {
      <div class="bg-white rounded-2xl border border-gray-200 p-8">
        <form (ngSubmit)="start()" #form="ngForm" novalidate>
          <div class="tw-space-y-4">

            <div>
              <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">Name *</label>
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Your full name"
                [disabled]="loading"
              />
            </div>

            <div>
              <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1.5">Email address *</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="you@example.com"
                [disabled]="loading"
              />
              <p class="text-xs text-gray-400 mt-1">We'll email you a secure link to manage your order.</p>
            </div>

            @if (error) {
              <p class="text-sm text-red-600">{{ error }}</p>
            }

            <button
              type="submit"
              [disabled]="loading || !name.trim() || !email.trim()"
              class="w-full rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm py-2.5 transition-colors uppercase tracking-wide">
              @if (loading) { Creating order… } @else { Get Started }
            </button>

          </div>
        </form>
      </div>
    }

  </div>
</div>
  `,
})
export class PublicWristbandStartComponent {
  name = '';
  email = '';
  loading = false;
  error = '';
  submitted = false;

  constructor(private svc: PublicWristbandService, private router: Router) {}

  start(): void {
    if (!this.name.trim() || !this.email.trim()) return;
    this.loading = true;
    this.error = '';
    this.svc.createOrder(this.name.trim(), this.email.trim()).subscribe({
      next: ({ token }) => {
        this.loading = false;
        this.submitted = true;
        // Also navigate directly to the order page so the user can continue immediately
        this.router.navigate(['/wristband-order', token]);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? 'Something went wrong. Please try again.';
      },
    });
  }

  reset(): void {
    this.submitted = false;
    this.error = '';
  }
}
