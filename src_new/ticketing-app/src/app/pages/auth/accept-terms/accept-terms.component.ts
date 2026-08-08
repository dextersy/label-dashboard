import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-accept-terms',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black flex">
      <!-- Left panel -->
      <div class="hidden lg:flex flex-col justify-between w-2/5 border-r-2 border-white/15 p-10 relative overflow-hidden">
        <div class="absolute inset-0 opacity-[0.04]"
          style="background-image: repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%); background-size: 12px 12px;"></div>
        <div class="relative z-10">
          <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-30"></a>
        </div>
        <div class="relative z-10">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— one more step —</p>
          <h2 class="text-5xl font-black text-white uppercase leading-[1] mb-5">
            Quick update to our terms.
          </h2>
          <p class="text-sm font-mono text-white/25 max-w-xs leading-relaxed">
            we've updated our terms and privacy policy. please review and accept to continue using your scene.
          </p>
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

          <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— terms update —</p>
          <h2 class="text-xl font-black text-black uppercase leading-[1] mb-4">
            Please accept our updated terms.
          </h2>
          <p class="text-xs font-mono text-gray-400 leading-relaxed mb-6">
            We've updated our Terms and Conditions and Privacy Policy. Please review and accept them to continue using Your Scene.
          </p>

          @if (error()) {
            <div class="mb-5 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="space-y-4">
              <div>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" formControlName="terms_accepted"
                    class="mt-0.5 h-4 w-4 flex-shrink-0 accent-yellow-400 cursor-pointer">
                  <span class="text-xs font-mono text-gray-600 leading-relaxed">
                    I have read and agree to the
                    <a routerLink="/terms" target="_blank"
                      class="text-yellow-500 hover:text-yellow-600 underline transition-colors">Terms and Conditions</a>
                  </span>
                </label>
                @if (form.get('terms_accepted')?.invalid && form.get('terms_accepted')?.touched) {
                  <p class="mt-1 text-xs font-mono text-red-500">You must accept the Terms and Conditions.</p>
                }
              </div>

              <div>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" formControlName="privacy_accepted"
                    class="mt-0.5 h-4 w-4 flex-shrink-0 accent-yellow-400 cursor-pointer">
                  <span class="text-xs font-mono text-gray-600 leading-relaxed">
                    I have read and understood the
                    <a routerLink="/privacy" target="_blank"
                      class="text-yellow-500 hover:text-yellow-600 underline transition-colors">Privacy Policy</a>
                  </span>
                </label>
                @if (form.get('privacy_accepted')?.invalid && form.get('privacy_accepted')?.touched) {
                  <p class="mt-1 text-xs font-mono text-red-500">You must accept the Privacy Policy.</p>
                }
              </div>

              <div>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" formControlName="age_confirmed"
                    class="mt-0.5 h-4 w-4 flex-shrink-0 accent-yellow-400 cursor-pointer">
                  <span class="text-xs font-mono text-gray-600 leading-relaxed">
                    I confirm I am at least 13 years old
                  </span>
                </label>
                @if (form.get('age_confirmed')?.invalid && form.get('age_confirmed')?.touched) {
                  <p class="mt-1 text-xs font-mono text-red-500">You must confirm your age to continue.</p>
                }
              </div>
            </div>

            <button type="submit" [disabled]="loading()"
              class="mt-6 w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50">
              {{ loading() ? 'Saving...' : 'Accept and continue' }}
            </button>
          </form>

          <p class="mt-4 text-center text-xs font-mono text-gray-400">
            Not you?
            <button type="button" (click)="signOut()"
              class="text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors ml-1">
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  `
})
export class AcceptTermsComponent {
  form: FormGroup;
  loading = signal(false);
  error = signal('');

  constructor(
    private fb: FormBuilder,
    private audienceAuth: AudienceAuthService,
    private router: Router,
    private http: HttpClient
  ) {
    this.form = this.fb.group({
      terms_accepted: [false, Validators.requiredTrue],
      privacy_accepted: [false, Validators.requiredTrue],
      age_confirmed: [false, Validators.requiredTrue],
    });

    // If the user doesn't need to accept terms, redirect them away
    const user = this.audienceAuth.getUser();
    if (!audienceAuth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { mode: 'audience' } });
    } else if (user?.terms_accepted_at && user?.privacy_accepted_at && user?.age_confirmed_at) {
      this.router.navigate(['/my-shows']);
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const headers = this.audienceAuth.getAuthHeaders();
    this.http.post<any>(`${environment.apiUrl}/auth/audience/accept-terms`, this.form.value, { headers })
      .subscribe({
        next: (user) => {
          this.audienceAuth.updateStoredUser(user);
          this.loading.set(false);
          this.router.navigate(['/my-shows']);
        },
        error: (err: any) => {
          this.error.set(err.error?.error || 'Failed to save. Please try again.');
          this.loading.set(false);
        }
      });
  }

  signOut(): void {
    this.audienceAuth.logout();
    this.router.navigate(['/login'], { queryParams: { mode: 'audience' } });
  }
}
