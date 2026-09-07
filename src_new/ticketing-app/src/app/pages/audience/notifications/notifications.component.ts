import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceEmailPreferences } from '../../../services/audience-auth.service';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

interface PrefCategory {
  key: keyof AudienceEmailPreferences;
  label: string;
  description: string;
}

@Component({
  selector: 'app-audience-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">

      <app-audience-header></app-audience-header>

      <main class="max-w-2xl mx-auto px-4 py-10 pt-20">

        <div class="mb-8">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— account —</p>
          <h1 class="text-2xl font-black uppercase text-white">Email Notifications</h1>
          <p class="text-xs font-mono text-white/30 mt-1">Control which emails you receive from us.</p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else {

          <!-- Toggleable categories -->
          <div class="bg-white/5 border border-white/10 mb-6">
            @for (cat of categories; track cat.key; let last = $last) {
              <div class="flex items-center justify-between px-6 py-4"
                [class.border-b]="!last"
                [class.border-white/10]="!last">
                <div class="flex-1 min-w-0 pr-6">
                  <p class="text-sm font-black text-white uppercase">{{ cat.label }}</p>
                  <p class="text-xs font-mono text-white/40 mt-0.5">{{ cat.description }}</p>
                </div>
                <button type="button" (click)="toggle(cat.key)"
                  [disabled]="saving()"
                  class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                  [class]="prefs()[cat.key] ? 'bg-yellow-400' : 'bg-white/20'">
                  <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                    [class.translate-x-5]="prefs()[cat.key]">
                  </span>
                </button>
              </div>
            }
          </div>

          <!-- Always-on notice -->
          <div class="bg-white/5 border border-white/10 mb-6">
            <div class="flex items-center justify-between px-6 py-4">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">Account &amp; Security</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">Ticket confirmations, password resets, and email verification. Always sent.</p>
              </div>
              <div class="flex-shrink-0 w-11 h-6 rounded-full bg-white/10 relative">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white/30 rounded-full translate-x-5"></span>
              </div>
            </div>
          </div>

          @if (saveError()) {
            <div class="border border-red-500/30 bg-red-500/10 px-4 py-3 mb-4">
              <p class="text-xs font-mono text-red-400">{{ saveError() }}</p>
            </div>
          }
          @if (saveSuccess()) {
            <div class="border border-green-500/30 bg-green-500/10 px-4 py-3 mb-4">
              <p class="text-xs font-mono text-green-400">Preferences saved.</p>
            </div>
          }

          <div>
            <a routerLink="/my-profile"
              class="text-xs font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
              &larr; Back to profile
            </a>
          </div>

        }

      </main>
    </div>
  `
})
export class AudienceNotificationsComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  prefs = signal<AudienceEmailPreferences>({
    marketing_promos: true,
    event_recommendations: true,
    organizer_updates: true,
    points_rewards: true,
  });

  readonly categories: PrefCategory[] = [
    {
      key: 'marketing_promos',
      label: 'Promotions & Offers',
      description: 'Targeted deals, discounts, and early-bird ticket offers.',
    },
    {
      key: 'event_recommendations',
      label: 'Event Recommendations',
      description: 'Events we think you\'ll like based on your profile.',
    },
    {
      key: 'organizer_updates',
      label: 'Organizer Updates',
      description: 'News and announcements from organizers you follow.',
    },
    {
      key: 'points_rewards',
      label: 'Points & Rewards',
      description: 'Points earned, tier upgrades, and rewards notifications.',
    },
  ];

  constructor(private audienceAuthService: AudienceAuthService) {}

  ngOnInit(): void {
    this.audienceAuthService.getEmailPreferences().subscribe({
      next: (p) => {
        this.prefs.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  toggle(key: keyof AudienceEmailPreferences): void {
    const current = this.prefs();
    const newValue = !current[key];
    const updated = { ...current, [key]: newValue };
    this.prefs.set(updated);

    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    this.audienceAuthService.updateEmailPreferences({ [key]: newValue }).subscribe({
      next: (p) => {
        this.prefs.set(p);
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 2000);
      },
      error: () => {
        // Revert on failure
        this.prefs.set(current);
        this.saving.set(false);
        this.saveError.set('Failed to save. Please try again.');
      }
    });
  }
}
