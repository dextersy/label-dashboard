import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { environment } from '../../../../environments/environment';

type View = 'login' | 'signup' | 'forgot-password' | 'reset-password';

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
          <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30"></a>
        </div>
        <div class="relative z-10">
          @if (mode() === 'audience') {
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— your tickets —</p>
            <h2 class="text-5xl font-black text-white uppercase leading-[1] mb-5">
              Support your scene.<br>One show at a time.
            </h2>
            <p class="text-sm font-mono text-white/25 max-w-xs leading-relaxed">
              log in to view your tickets, see upcoming shows, and never lose a ticket again.
            </p>
          } @else {
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— organizer portal —</p>
            <h2 class="text-5xl font-black text-white uppercase leading-[1] mb-5">
              Your shows.<br>Your rules.
            </h2>
            <p class="text-sm font-mono text-white/25 max-w-xs leading-relaxed">
              list your gig, sell tickets, track the door. built for the people putting on shows.
            </p>
          }
        </div>
        <div class="relative z-10">
          <p class="text-xs font-mono text-white/15 uppercase tracking-wider">no service fees. no gatekeeping.</p>
        </div>
      </div>

      <!-- Right panel -->
      <div class="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div class="w-full max-w-sm">

          <div class="lg:hidden mb-8">
            <a routerLink="/"><img src="/assets/logo-light-bg.png" alt="Your Scene" class="h-6"></a>
          </div>

          <!-- Mode tabs — hidden on reset-password (mode is fixed by the reset link) -->
          <div class="flex border border-gray-200 mb-5" [class.hidden]="view() === 'reset-password'">
            <button type="button"
              class="flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors"
              [class.bg-black]="mode() === 'audience'"
              [class.text-white]="mode() === 'audience'"
              [class.text-gray-400]="mode() !== 'audience'"
              (click)="setMode('audience')">
              For Audiences
            </button>
            <button type="button"
              class="flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors border-l border-gray-200"
              [class.bg-black]="mode() === 'organizer'"
              [class.text-white]="mode() === 'organizer'"
              [class.text-gray-400]="mode() !== 'organizer'"
              (click)="setMode('organizer')">
              For Organizers
            </button>
          </div>

          <!-- Mobile copy — shown below toggle -->
          @if (view() !== 'reset-password') {
            <div class="lg:hidden mb-6">
              @if (mode() === 'audience') {
                <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— your tickets —</p>
                <h2 class="text-xl font-black text-black uppercase leading-[1] mb-1">
                  Support your scene.<br>One show at a time.
                </h2>
                <p class="text-xs font-mono text-gray-400 leading-relaxed">
                  log in to view your tickets, see upcoming shows, and never lose a ticket again.
                </p>
              } @else {
                <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— organizer portal —</p>
                <h2 class="text-xl font-black text-black uppercase leading-[1] mb-1">
                  Your shows.<br>Your rules.
                </h2>
                <p class="text-xs font-mono text-gray-400 leading-relaxed">
                  list your gig, sell tickets, track the door. built for the people putting on shows.
                </p>
              }
            </div>
          }

          <!-- Error banner -->
          @if (error()) {
            <div class="mb-5 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">
              {{ error() }}
              @if (unverifiedEmail()) {
                <div class="mt-2 pt-2 border-t border-red-200">
                  @if (resentFromLogin()) {
                    <span class="text-green-600">Verification email sent — check your inbox.</span>
                  } @else {
                    <button type="button" (click)="resendFromLogin()" [disabled]="resendingFromLogin()"
                      class="underline hover:no-underline disabled:opacity-50">
                      {{ resendingFromLogin() ? 'Sending...' : 'Resend verification email' }}
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- ── LOGIN VIEW ─────────────────────────────────────────── -->
          @if (view() === 'login') {

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

            <form [formGroup]="loginForm" (ngSubmit)="submitLogin()">
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                  <input type="email" formControlName="email"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="you@example.com" autocomplete="email">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                  <input type="password" formControlName="password"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="••••••••" autocomplete="current-password">
                </div>
              </div>
              <div class="mt-2 text-right">
                <button type="button" (click)="setView('forgot-password')"
                  class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                  Forgot password?
                </button>
              </div>
              <button type="submit" [disabled]="loginLoading()"
                class="mt-5 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                {{ loginLoading() ? 'Signing in...' : 'Sign in' }}
              </button>
            </form>

            <p class="mt-6 text-xs font-mono text-gray-500 text-center">
              Don't have an account?
              <button type="button" (click)="setView('signup')"
                class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
                Create one
              </button>
            </p>
          }

          <!-- ── SIGNUP VIEW ─────────────────────────────────────────── -->
          @if (view() === 'signup') {

            <!-- Verification pending screen (shown after successful audience signup) -->
            @if (signupPendingEmail() && mode() === 'audience') {
              <div class="border border-green-200 bg-green-50 p-6 text-center">
                <p class="text-green-700 font-mono text-sm font-bold mb-2">Check your inbox!</p>
                <p class="text-green-700 text-xs font-mono mb-4">
                  We sent a verification link to <strong>{{ signupPendingEmail() }}</strong>.
                  Click it to activate your account before signing in.
                </p>
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-yellow-600 hover:text-yellow-700 uppercase tracking-wider transition-colors">
                  ← Back to sign in
                </button>
              </div>
            } @else {

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

            <!-- Audience signup form -->
            @if (mode() === 'audience') {
              <form [formGroup]="audienceForm" (ngSubmit)="submitAudience()">
                <div class="space-y-4">
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">First name</label>
                      <input type="text" formControlName="first_name"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                        autocomplete="given-name">
                    </div>
                    <div class="flex-1">
                      <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Last name</label>
                      <input type="text" formControlName="last_name"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                        autocomplete="family-name">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email address</label>
                    <input type="email" formControlName="email"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="you@example.com" autocomplete="email">
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                    <div class="relative">
                      <input [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                        class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors pr-14"
                        placeholder="Min. 8 characters" autocomplete="new-password">
                      <button type="button" (click)="showPassword.set(!showPassword())"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs font-mono uppercase tracking-wider">
                        {{ showPassword() ? 'Hide' : 'Show' }}
                      </button>
                    </div>
                  </div>
                </div>
                <p class="mt-3 text-xs text-gray-400 leading-snug">
                  Tickets previously purchased with your email address will be automatically linked to your profile.
                </p>
                <button type="submit" [disabled]="audienceLoading()"
                  class="mt-5 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ audienceLoading() ? 'Creating account...' : 'Create account' }}
                </button>
              </form>
            }

            <!-- Organizer signup form -->
            @if (mode() === 'organizer') {
              <form [formGroup]="organizerForm" (ngSubmit)="submitOrganizer()">
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Full Name</label>
                    <input type="text" formControlName="full_name"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="Jane Smith" autocomplete="name">
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
                    <input type="email" formControlName="email"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="you@example.com" autocomplete="email">
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Organization / Event Brand</label>
                    <input type="text" formControlName="brand_name"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="My Events Co.">
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Username</label>
                    <input type="text" formControlName="username"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="your_username" autocomplete="username">
                    <p class="mt-1 text-xs font-mono text-gray-400">3–30 characters. Letters, numbers, _ and - only.</p>
                    @if (organizerForm.get('username')?.invalid && organizerForm.get('username')?.touched) {
                      <p class="mt-1 text-xs font-mono text-red-500">3–30 characters, letters, numbers, _ and - only.</p>
                    }
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
                    <input type="password" formControlName="password"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="••••••••" autocomplete="new-password">
                    @if (organizerForm.get('password')?.value) {
                      <div class="mt-2">
                        <div class="flex gap-1">
                          @for (i of [1,2,3,4]; track i) {
                            <div class="h-0.5 flex-1 transition-colors"
                              [class]="i <= passwordStrength() ? strengthColor() : 'bg-gray-200'"></div>
                          }
                        </div>
                        <p class="text-xs font-mono mt-1" [class]="strengthTextColor()">{{ strengthLabel() }}</p>
                      </div>
                    }
                  </div>
                  <div class="pt-1">
                    <label class="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" formControlName="terms_accepted"
                        class="mt-0.5 h-4 w-4 flex-shrink-0 accent-yellow-400 cursor-pointer">
                      <span class="text-xs font-mono text-gray-500 leading-relaxed">
                        I have read and agree to the
                        <a routerLink="/app/terms" target="_blank"
                          class="text-yellow-500 hover:text-yellow-600 underline transition-colors">Terms and Conditions</a>
                      </span>
                    </label>
                    @if (organizerForm.get('terms_accepted')?.invalid && organizerForm.get('terms_accepted')?.touched) {
                      <p class="mt-1 text-xs font-mono text-red-500">You must accept the terms to continue.</p>
                    }
                  </div>
                </div>
                <button type="submit" [disabled]="organizerLoading()"
                  class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ organizerLoading() ? 'Creating account...' : 'Create account' }}
                </button>
              </form>
            }

            <p class="mt-6 text-xs font-mono text-gray-500 text-center">
              Already have an account?
              <button type="button" (click)="setView('login')"
                class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
                Sign in
              </button>
            </p>
            } <!-- end @else (signupPendingEmail) -->
          }

          <!-- ── FORGOT PASSWORD VIEW ─────────────────────────────────── -->
          @if (view() === 'forgot-password') {

            @if (forgotSent()) {
              <div class="border border-green-200 bg-green-50 p-5 text-center">
                <p class="text-green-700 text-sm font-mono mb-4">Check your email for reset instructions.</p>
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-yellow-600 hover:text-yellow-700 uppercase tracking-wider transition-colors">
                  ← Back to sign in
                </button>
              </div>
            } @else {
              <form [formGroup]="forgotForm" (ngSubmit)="submitForgot()">
                <p class="text-xs font-mono text-gray-400 mb-5">Enter your email and we'll send you a reset link.</p>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email address</label>
                  <input type="email" formControlName="email"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="you@example.com" autocomplete="email">
                </div>
                <button type="submit" [disabled]="forgotLoading()"
                  class="mt-4 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ forgotLoading() ? 'Sending...' : 'Send reset link' }}
                </button>
              </form>
              <p class="mt-5 text-center">
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                  ← Back to sign in
                </button>
              </p>
            }
          }

          <!-- ── RESET PASSWORD VIEW ─────────────────────────────────── -->
          @if (view() === 'reset-password') {

            @if (resetValidating()) {
              <p class="text-xs font-mono text-gray-400 animate-pulse">Verifying reset link...</p>
            } @else if (!resetTokenValid()) {
              <div class="border border-red-200 bg-red-50 p-5 text-center">
                <p class="text-red-600 text-sm font-mono mb-4">This reset link is invalid or has already been used.</p>
                <button type="button" (click)="setView('forgot-password')"
                  class="text-xs font-mono text-yellow-600 hover:text-yellow-700 uppercase tracking-wider transition-colors">
                  Request a new link
                </button>
              </div>
              <p class="mt-5 text-center">
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                  ← Back to sign in
                </button>
              </p>
            } @else if (resetDone()) {
              <div class="border border-green-200 bg-green-50 p-5 text-center">
                <p class="text-green-700 text-sm font-mono mb-4">Password updated successfully.</p>
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-yellow-600 hover:text-yellow-700 uppercase tracking-wider transition-colors">
                  ← Sign in
                </button>
              </div>
            } @else {
              <p class="mb-5 text-xs font-mono text-gray-400">
                Setting a new password for your
                <span class="text-gray-600 font-medium">{{ resetMode === 'audience' ? 'audience' : 'organizer' }}</span>
                account.
              </p>
              <form [formGroup]="resetForm" (ngSubmit)="submitReset()">
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">New Password</label>
                    <input type="password" formControlName="password"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="••••••••" autocomplete="new-password">
                    @if (resetPasswordValue()) {
                      <div class="mt-2">
                        <div class="flex gap-1">
                          @for (i of [1,2,3,4]; track i) {
                            <div class="h-0.5 flex-1 transition-colors"
                              [class]="i <= resetStrength() ? resetStrengthColor() : 'bg-gray-200'"></div>
                          }
                        </div>
                        <p class="text-xs font-mono mt-1" [class]="resetStrengthTextColor()">{{ resetStrengthLabel() }}</p>
                      </div>
                    }
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Confirm Password</label>
                    <input type="password" formControlName="confirm"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="••••••••" autocomplete="new-password">
                    @if (resetForm.get('confirm')?.value && resetForm.get('password')?.value !== resetForm.get('confirm')?.value) {
                      <p class="mt-1 text-xs font-mono text-red-500">Passwords do not match.</p>
                    }
                  </div>
                </div>
                <button type="submit" [disabled]="resetLoading()"
                  class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ resetLoading() ? 'Updating...' : 'Set new password' }}
                </button>
              </form>
              <p class="mt-5 text-center">
                <button type="button" (click)="setView('login')"
                  class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                  ← Back to sign in
                </button>
              </p>
            }
          }

        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  audienceForm: FormGroup;
  organizerForm: FormGroup;
  forgotForm: FormGroup;
  resetForm: FormGroup;

  view = signal<View>('login');
  mode = signal<'audience' | 'organizer'>('audience');

  loginLoading = signal(false);
  audienceLoading = signal(false);
  organizerLoading = signal(false);
  forgotLoading = signal(false);
  forgotSent = signal(false);
  resetLoading = signal(false);
  resetValidating = signal(false);
  resetTokenValid = signal(false);
  resetDone = signal(false);
  resetPasswordValue = signal('');
  error = signal('');
  showPassword = signal(false);
  unverifiedEmail = signal('');
  resendingFromLogin = signal(false);
  resentFromLogin = signal(false);
  signupPendingEmail = signal('');

  private resetCode = '';
  resetMode: 'audience' | 'organizer' = 'organizer';

  googleAuthEnabled = environment.googleAuthEnabled;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private audienceAuth: AudienceAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
    this.audienceForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
    this.organizerForm = this.fb.group({
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      brand_name: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      terms_accepted: [false, Validators.requiredTrue]
    });
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const routeData = this.route.snapshot.data;

    // Mode from query param or route data
    if (params.get('mode') === 'organizer') this.mode.set('organizer');

    // View from query param or route data (e.g. when /signup or /reset-password redirects here)
    const viewParam = (params.get('view') || routeData['view'] || 'login') as View;
    if (['login', 'signup', 'forgot-password', 'reset-password'].includes(viewParam)) {
      this.view.set(viewParam as View);
    }

    // Handle reset-password: validate hash/code from email link
    if (this.view() === 'reset-password') {
      this.resetMode = params.get('mode') === 'audience' ? 'audience' : 'organizer';
      // Audience emails use ?hash=, organizer emails use ?code=
      this.resetCode = this.resetMode === 'audience'
        ? (params.get('hash') || '')
        : (params.get('code') || '');
      this.resetForm.get('password')!.valueChanges.subscribe(v => this.resetPasswordValue.set(v || ''));
      if (!this.resetCode) {
        this.resetTokenValid.set(false);
        return;
      }
      this.resetValidating.set(true);
      const validateUrl = this.resetMode === 'audience'
        ? `${environment.apiUrl}/auth/audience/validate-reset-hash/${this.resetCode}`
        : `${environment.apiUrl}/auth/ticketing/validate-reset-hash/${this.resetCode}`;
      this.http.get(validateUrl).subscribe({
        next: () => { this.resetTokenValid.set(true); this.resetValidating.set(false); },
        error: () => { this.resetTokenValid.set(false); this.resetValidating.set(false); }
      });
      return;
    }

    // Handle Google OAuth error
    const errorParam = params.get('error');
    if (errorParam) this.error.set('Google sign-in failed. Please try again.');

    // Handle audience Google exchange code (redirected back from Google)
    // Backend uses ?audience_code= when return_to is set, ?code= otherwise
    const codeParam = params.get('audience_code') || params.get('code');
    if (codeParam && this.mode() !== 'organizer') {
      this.loginLoading.set(true);
      this.http.post<any>(`${environment.apiUrl}/auth/audience/google/exchange`, { code: codeParam })
        .subscribe({
          next: (res) => {
            this.loginLoading.set(false);
            localStorage.setItem('ys_audience_token', res.token);
            localStorage.setItem('ys_audience_user', JSON.stringify(res.user));
            this.router.navigate(['/my-shows']);
          },
          error: () => {
            this.loginLoading.set(false);
            this.error.set('Google sign-in failed. Please try again.');
          }
        });
      return;
    }

    // Redirect if already logged in
    if (this.audienceAuth.isLoggedIn() && this.mode() !== 'organizer') {
      this.router.navigate(['/my-shows']);
    }
    if (this.auth.isLoggedIn() && this.mode() === 'organizer') {
      this.router.navigate(['/app/dashboard']);
    }
  }

  setMode(m: 'audience' | 'organizer'): void {
    this.mode.set(m);
    this.error.set('');
    this.showPassword.set(false);
    this.forgotSent.set(false);
    this.unverifiedEmail.set('');
    this.resentFromLogin.set(false);
    this.signupPendingEmail.set('');
  }

  setView(v: View): void {
    this.view.set(v);
    this.error.set('');
    this.showPassword.set(false);
    this.forgotSent.set(false);
    this.unverifiedEmail.set('');
    this.resentFromLogin.set(false);
    this.signupPendingEmail.set('');
    this.router.navigate([], {
      queryParams: { view: v === 'login' ? null : v, mode: this.mode() === 'organizer' ? 'organizer' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  googleSignIn(): void {
    if (this.mode() === 'audience') {
      const returnTo = `${window.location.origin}/login?mode=audience`;
      window.location.href = `${environment.apiUrl}/auth/audience/google?return_to=${encodeURIComponent(returnTo)}`;
    } else {
      window.location.href = `${environment.apiUrl}/auth/ticketing/google`;
    }
  }

  submitLogin(): void {
    if (this.loginForm.invalid) return;
    this.loginLoading.set(true);
    this.error.set('');
    const { email, password } = this.loginForm.value;

    if (this.mode() === 'audience') {
      this.unverifiedEmail.set('');
      this.resentFromLogin.set(false);
      this.audienceAuth.login(email, password).subscribe({
        next: () => { this.loginLoading.set(false); this.router.navigate(['/my-shows']); },
        error: (err: any) => {
          this.loginLoading.set(false);
          if (err.error?.code === 'EMAIL_NOT_VERIFIED') {
            this.unverifiedEmail.set(email);
          }
          this.error.set(err.error?.error || 'Login failed. Please try again.');
        }
      });
    } else {
      this.auth.login(email, password).subscribe({
        next: (res: any) => {
          this.loginLoading.set(false);
          if (res.status === 'profile_incomplete') {
            this.router.navigate(['/app/complete-profile']);
          } else {
            this.router.navigate(['/app/dashboard']);
          }
        },
        error: (err: any) => {
          this.error.set(err.error?.error || 'Login failed. Please try again.');
          this.loginLoading.set(false);
        }
      });
    }
  }

  resendFromLogin(): void {
    this.resendingFromLogin.set(true);
    this.audienceAuth.resendVerificationByEmail(this.unverifiedEmail()).subscribe({
      next: () => { this.resendingFromLogin.set(false); this.resentFromLogin.set(true); },
      error: () => { this.resendingFromLogin.set(false); },
    });
  }

  submitAudience(): void {
    if (this.audienceForm.invalid) { this.audienceForm.markAllAsTouched(); return; }
    this.audienceLoading.set(true);
    this.error.set('');
    const { first_name, last_name, email, password } = this.audienceForm.value;
    this.audienceAuth.signup(email, password, first_name, last_name).subscribe({
      next: () => {
        this.audienceLoading.set(false);
        this.signupPendingEmail.set(email);
      },
      error: (err: any) => {
        this.audienceLoading.set(false);
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
      }
    });
  }

  submitOrganizer(): void {
    if (this.organizerForm.invalid) { this.organizerForm.markAllAsTouched(); return; }
    this.organizerLoading.set(true);
    this.error.set('');
    this.auth.signup(this.organizerForm.value).subscribe({
      next: (res: any) => {
        this.organizerLoading.set(false);
        if (res.status === 'profile_incomplete') {
          this.router.navigate(['/app/complete-profile']);
        } else {
          this.router.navigate(['/app/dashboard']);
        }
      },
      error: (err: any) => {
        this.organizerLoading.set(false);
        this.error.set(err.error?.error || 'Signup failed. Please try again.');
      }
    });
  }

  submitForgot(): void {
    if (this.forgotForm.invalid) return;
    this.forgotLoading.set(true);
    const endpoint = this.mode() === 'audience'
      ? `${environment.apiUrl}/auth/audience/forgot-password`
      : `${environment.apiUrl}/auth/ticketing/forgot-password`;
    this.http.post(endpoint, this.forgotForm.value).subscribe({
      next: () => { this.forgotSent.set(true); this.forgotLoading.set(false); },
      error: () => { this.forgotSent.set(true); this.forgotLoading.set(false); }
    });
  }

  submitReset(): void {
    const { password, confirm } = this.resetForm.value;
    if (this.resetForm.invalid || password !== confirm) return;
    this.resetLoading.set(true);
    this.error.set('');
    const endpoint = this.resetMode === 'audience'
      ? `${environment.apiUrl}/auth/audience/reset-password`
      : `${environment.apiUrl}/auth/reset-password`;
    const body = this.resetMode === 'audience'
      ? { hash: this.resetCode, password }
      : { token: this.resetCode, password };
    this.http.post(endpoint, body).subscribe({
      next: () => { this.resetDone.set(true); this.resetLoading.set(false); },
      error: (err: any) => {
        this.error.set(err.error?.error || 'Failed to reset password. Please try again.');
        this.resetLoading.set(false);
      }
    });
  }

  // Password strength for reset-password view
  resetStrength = computed(() => {
    const p = this.resetPasswordValue();
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  });
  resetStrengthColor = computed(() => {
    const s = this.resetStrength();
    if (s <= 1) return 'bg-red-500';
    if (s === 2) return 'bg-yellow-400';
    if (s === 3) return 'bg-yellow-300';
    return 'bg-green-400';
  });
  resetStrengthTextColor = computed(() => {
    const s = this.resetStrength();
    if (s <= 1) return 'text-red-500';
    if (s === 2) return 'text-yellow-500';
    if (s === 3) return 'text-yellow-400';
    return 'text-green-500';
  });
  resetStrengthLabel = computed(() => {
    const s = this.resetStrength();
    if (s <= 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Good';
    return 'Strong';
  });

  // Password strength for organizer signup
  passwordStrength = computed(() => {
    const p = this.organizerForm.get('password')?.value || '';
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
    if (s <= 1) return 'text-red-500';
    if (s === 2) return 'text-yellow-500';
    if (s === 3) return 'text-yellow-400';
    return 'text-green-500';
  });

  strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Good';
    return 'Strong';
  });
}
