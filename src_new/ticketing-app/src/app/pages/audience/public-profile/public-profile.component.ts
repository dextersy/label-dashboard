import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';
import { ConnectButtonComponent } from '../../../components/connect-button/connect-button.component';
import { AudienceProfileService, PublicUserProfile, AttendedShow } from '../../../services/audience-profile.service';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { AudienceSocialService } from '../../../services/audience-social.service';
import { ConnectionMeta } from '../../../models/audience-connection';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, AudienceHeaderComponent, ConnectButtonComponent],
  template: `
    <div class="min-h-screen bg-black text-white">
      <app-audience-header></app-audience-header>

      <main class="max-w-xl mx-auto px-4 pt-20 pb-16">

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>

        } @else if (notFound()) {
          <div class="text-center py-20">
            <p class="text-white/30 font-mono text-sm">This profile is not available.</p>
          </div>

        } @else if (user()) {
          <div class="flex flex-col items-center text-center pt-8">

            <!-- Avatar -->
            @if (user()!.profile_photo_url) {
              <img [src]="user()!.profile_photo_url" [alt]="user()!.first_name"
                class="w-24 h-24 object-cover mb-4">
            } @else {
              <div class="w-24 h-24 bg-white flex items-center justify-center mb-4">
                <span class="text-black text-4xl font-black">{{ user()!.first_name.charAt(0).toUpperCase() }}</span>
              </div>
            }

            <!-- Name -->
            <h1 class="text-2xl font-black uppercase text-white">
              {{ user()!.first_name }}
              @if (user()!.last_name) { {{ user()!.last_name }} }
              @else if (user()!.last_name_initial) { {{ user()!.last_name_initial }} }
            </h1>

            <!-- City -->
            @if (user()!.city) {
              <p class="text-xs font-mono text-white/40 mt-1">{{ user()!.city }}</p>
            }

            <!-- Tier badge -->
            <span class="mt-3 px-3 py-1 text-[10px] font-mono uppercase tracking-widest"
              [class.bg-yellow-400]="user()!.membership_tier === 'Gold' || user()!.membership_tier === 'Platinum'"
              [class.text-black]="user()!.membership_tier === 'Gold' || user()!.membership_tier === 'Platinum'"
              [class.bg-white/10]="user()!.membership_tier === 'Silver'"
              [class.text-white/50]="user()!.membership_tier === 'Silver'">
              {{ user()!.membership_tier }}
            </span>

            <!-- Connect button (only for logged-in audience users viewing someone else's profile) -->
            @if (showConnectButton()) {
              <div class="mt-4">
                <app-connect-button [userId]="user()!.id" [connectionMeta]="connectionMeta()"></app-connect-button>
              </div>
            }

            <!-- Music genres -->
            @if (user()!.music_genres.length > 0) {
              <div class="flex flex-wrap justify-center gap-2 mt-6">
                @for (genre of user()!.music_genres; track genre) {
                  <span class="px-2.5 py-1 border border-white/15 text-[10px] font-mono text-white/50 uppercase tracking-wider">
                    {{ genre }}
                  </span>
                }
              </div>
            }

          </div>

          <!-- Attended shows -->
          @if (attendedShows().length > 0) {
            <div class="mt-12">
              <p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-4">Shows attended</p>
              <div class="grid grid-cols-3 gap-1">
                @for (show of attendedShows(); track show.id) {
                  <a [routerLink]="['/events', show.id]" class="relative aspect-square group overflow-hidden">
                    @if (show.poster_url) {
                      <img [src]="show.poster_url" [alt]="show.title" class="w-full h-full object-cover">
                    } @else {
                      <div class="w-full h-full bg-white/5 flex items-center justify-center">
                        <svg class="w-6 h-6 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                      </div>
                    }
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                      <p class="text-[10px] font-mono text-white text-center leading-tight line-clamp-2">{{ show.title }}</p>
                      <p class="text-[9px] font-mono text-white/50 mt-1">{{ formatDate(show.date_and_time) }}</p>
                    </div>
                  </a>
                }
              </div>
            </div>
          }

        }

      </main>
    </div>
  `
})
export class PublicProfileComponent implements OnInit {
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly user = signal<PublicUserProfile | null>(null);
  readonly attendedShows = signal<AttendedShow[]>([]);
  readonly connectionMeta = signal<ConnectionMeta | null>(null);
  readonly showConnectButton = signal(false);

  constructor(
    private route: ActivatedRoute,
    private audienceProfileService: AudienceProfileService,
    private audienceAuthService: AudienceAuthService,
    private audienceSocialService: AudienceSocialService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = parseInt(params.get('id') as string, 10);
      this.loadProfile(id);
    });
  }

  private loadProfile(id: number): void {
    if (isNaN(id)) { this.notFound.set(true); this.loading.set(false); return; }

    this.loading.set(true);
    this.notFound.set(false);
    this.user.set(null);
    this.attendedShows.set([]);
    this.connectionMeta.set(null);
    this.showConnectButton.set(false);

    const meId = this.audienceAuthService.getUser()?.id;
    const isAudienceLoggedIn = this.audienceAuthService.isLoggedIn();

    this.audienceProfileService.getPublicUserProfile(id).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.attendedShows.set(res.attended_shows);
        this.loading.set(false);

        // Show connect button if logged-in audience user viewing someone else's profile
        if (isAudienceLoggedIn && meId !== id) {
          this.showConnectButton.set(true);
          this.audienceSocialService.getUserProfile(id).subscribe({
            next: (r) => this.connectionMeta.set(r.connection),
            error: () => {},
          });
        }
      },
      error: (err) => {
        this.notFound.set(err.status === 404);
        this.loading.set(false);
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
