import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AudienceAuthService } from '../../services/audience-auth.service';
import { environment } from '../../../environments/environment';

interface OrganizerProfile {
  id: number;
  name: string;
  logo_url: string | null;
  brand_color: string;
  brand_website: string | null;
  about_us: string | null;
  follower_count: number;
  upcoming_events: {
    id: number;
    title: string;
    date_and_time: string;
    venue: string;
    event_type: string;
    poster_url?: string | null;
  }[];
}

@Component({
  selector: 'app-organizer-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black text-white">

      <!-- Header -->
      <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>
          @if (isAudienceLoggedIn()) {
            <a routerLink="/my-shows" class="text-white/50 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors">My Shows</a>
          } @else {
            <a routerLink="/login" class="text-white/50 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors">Log In</a>
          }
        </div>
      </header>

      <main class="max-w-3xl mx-auto px-4 pt-20 pb-16">

        @if (loading()) {
          <div class="flex items-center justify-center py-24">
            <p class="text-xs font-mono text-white/30 uppercase tracking-widest animate-pulse">loading...</p>
          </div>
        } @else if (error()) {
          <div class="flex items-center justify-center py-24">
            <p class="text-xs font-mono text-red-400">{{ error() }}</p>
          </div>
        } @else if (profile()) {

          <!-- Profile Header -->
          <div class="mt-8 mb-10">
            <div class="flex items-start gap-6">
              <!-- Logo -->
              <div class="flex-shrink-0">
                @if (profile()!.logo_url) {
                  <div class="w-20 h-20 flex items-center justify-center p-2" [style.background-color]="profile()!.brand_color">
                    <img [src]="profile()!.logo_url" [alt]="profile()!.name" class="w-full h-full object-contain">
                  </div>
                } @else {
                  <div class="w-20 h-20 flex items-center justify-center" [style.background-color]="profile()!.brand_color">
                    <span class="text-white/80 text-3xl font-black">{{ profile()!.name.charAt(0).toUpperCase() }}</span>
                  </div>
                }
              </div>

              <!-- Name + Meta -->
              <div class="flex-1 min-w-0">
                <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— organizer —</p>
                <h1 class="text-2xl font-black uppercase text-white mb-2 leading-tight">{{ profile()!.name }}</h1>
                <div class="flex items-center gap-4 flex-wrap">
                  <span class="text-sm font-mono text-white/50">
                    <span class="text-white font-black">{{ profile()!.follower_count }}</span>
                    {{ profile()!.follower_count === 1 ? 'follower' : 'followers' }}
                  </span>
                  @if (profile()!.brand_website) {
                    <a [href]="profile()!.brand_website!" target="_blank" rel="noopener noreferrer"
                      class="text-xs font-mono text-yellow-400/70 hover:text-yellow-400 transition-colors truncate max-w-48">
                      {{ profile()!.brand_website }}
                    </a>
                  }
                </div>
              </div>

              <!-- Follow Button -->
              <div class="flex-shrink-0 mt-1">
                @if (isAudienceLoggedIn()) {
                  <button (click)="toggleFollow()" [disabled]="followLoading()"
                    class="px-5 py-2 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                    [class]="isFollowing() ? 'border border-white/30 text-white/50 hover:border-red-400/50 hover:text-red-400' : 'bg-yellow-400 text-black hover:bg-yellow-300'">
                    {{ followLoading() ? '...' : (isFollowing() ? 'Following' : 'Follow') }}
                  </button>
                } @else {
                  <a routerLink="/login"
                    class="inline-block px-5 py-2 bg-yellow-400 text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-300 transition-colors">
                    Follow
                  </a>
                }
              </div>
            </div>

            <!-- About Us -->
            @if (profile()!.about_us) {
              <div class="mt-6 border-t border-white/10 pt-6">
                <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">About</p>
                <p class="text-sm text-white/80 leading-relaxed whitespace-pre-line">{{ profile()!.about_us }}</p>
              </div>
            }
          </div>

          <!-- Upcoming Events -->
          <div>
            <p class="text-xs font-mono text-white/40 uppercase tracking-[0.2em] mb-4">— upcoming events —</p>

            @if (profile()!.upcoming_events.length === 0) {
              <div class="border border-white/10 px-6 py-10 text-center">
                <p class="text-xs font-mono text-white/30 uppercase tracking-widest">No upcoming events</p>
              </div>
            } @else {
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                @for (event of profile()!.upcoming_events; track event.id) {
                  <a [routerLink]="['/events', event.id]"
                    class="block border border-white/10 hover:border-yellow-400/50 transition-colors group overflow-hidden">
                    <!-- Poster -->
                    <div class="aspect-[3/4] bg-white/5 overflow-hidden">
                      @if (event.poster_url) {
                        <img [src]="event.poster_url" [alt]="event.title"
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                      } @else {
                        <div class="w-full h-full flex items-center justify-center" [style.background-color]="profile()!.brand_color">
                          <p class="text-white/40 text-xs font-mono uppercase tracking-widest px-2 text-center">No Poster</p>
                        </div>
                      }
                    </div>
                    <!-- Info -->
                    <div class="px-3 py-3">
                      <p class="text-sm font-black text-white uppercase leading-tight group-hover:text-yellow-400 transition-colors line-clamp-2">
                        {{ event.title }}
                      </p>
                      <p class="text-xs font-mono text-white/40 mt-1">
                        {{ event.date_and_time | date:'MMM d, y' }}
                      </p>
                      @if (event.venue) {
                        <p class="text-xs font-mono text-white/30 mt-0.5 truncate">{{ event.venue }}</p>
                      }
                    </div>
                  </a>
                }
              </div>
            }
          </div>

        }
      </main>
    </div>
  `
})
export class OrganizerProfileComponent implements OnInit {
  profile = signal<OrganizerProfile | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  isFollowing = signal(false);
  followLoading = signal(false);

  private brandId!: number;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private audienceAuth: AudienceAuthService
  ) {}

  ngOnInit(): void {
    this.brandId = parseInt(this.route.snapshot.paramMap.get('brandId') || '0');
    this.loadProfile();

    if (this.audienceAuth.isLoggedIn()) {
      this.loadFollowStatus();
    }
  }

  isAudienceLoggedIn(): boolean {
    return this.audienceAuth.isLoggedIn();
  }

  loadProfile(): void {
    this.http.get<OrganizerProfile>(`${environment.apiUrl}/public/organizers/${this.brandId}`)
      .subscribe({
        next: (data) => {
          this.profile.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Organizer not found.');
          this.loading.set(false);
        }
      });
  }

  loadFollowStatus(): void {
    this.audienceAuth.getFollowedOrganizers().subscribe({
      next: (res) => {
        this.isFollowing.set(res.followed_brand_ids.includes(this.brandId));
      },
      error: () => {}
    });
  }

  toggleFollow(): void {
    if (this.followLoading()) return;
    this.followLoading.set(true);

    this.audienceAuth.toggleOrganizerFollow(this.brandId).subscribe({
      next: (res) => {
        this.isFollowing.set(res.following);
        if (this.profile()) {
          this.profile.update(p => p ? { ...p, follower_count: res.follower_count } : p);
        }
        this.followLoading.set(false);
      },
      error: () => {
        this.followLoading.set(false);
      }
    });
  }
}
