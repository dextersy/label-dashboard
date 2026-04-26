import { Component, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

interface PublicEvent {
  id: number;
  title: string;
  date_and_time: string;
  venue?: string;
  poster_url?: string;
  ticket_price_display: string;
  ticket_naming?: string;
  buy_shortlink?: string;
  is_closed: boolean;
  tickets_sold?: number;
}

interface PublicBrand {
  id: number;
  name: string;
  color?: string;
  logo_url?: string;
  events: PublicEvent[];
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Nav -->
    <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
        <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>
        <div class="flex items-center gap-4">
          @if (isLoggedIn()) {
            <a routerLink="/app/dashboard" class="text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors hidden sm:block">
              Go to organizer portal
            </a>
            <!-- Avatar + dropdown -->
            <div class="relative">
              <button (click)="userMenuOpen.set(!userMenuOpen())"
                class="w-7 h-7 bg-yellow-400 flex items-center justify-center flex-shrink-0 focus:outline-none">
                <span class="text-black text-xs font-black">{{ userInitial() }}</span>
              </button>
              @if (userMenuOpen()) {
                <div class="absolute right-0 top-full mt-2 w-44 bg-black border border-white/20 shadow-xl z-50">
                  <div class="px-4 py-3 border-b border-white/10">
                    <p class="text-xs font-mono text-white truncate">{{ userName() }}</p>
                    @if (brandName()) {
                      <p class="text-xs font-mono text-white/40 truncate">{{ brandName() }}</p>
                    }
                  </div>
                  <a routerLink="/app/dashboard" (click)="userMenuOpen.set(false)"
                    class="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Organizer portal
                  </a>
                  <button (click)="logout()"
                    class="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors border-t border-white/10">
                    Log out
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/app/login" class="text-xs text-white/50 hover:text-white uppercase tracking-wider transition-colors">Sign in</a>
            <a routerLink="/app/signup" class="text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-1.5 uppercase tracking-wider transition-colors">
              List a Show
            </a>
          }
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative min-h-screen flex items-center bg-black overflow-hidden">
      <!-- Subtle diagonal stripe texture -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.03]"
        style="background-image: repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%); background-size: 12px 12px;"></div>

      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20">
        <div class="max-w-2xl">
          <!-- Eyebrow -->
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— local gigs, real people —</p>

          <!-- Headline -->
          <h1 class="text-5xl sm:text-7xl font-black text-white leading-[1] mb-6 uppercase tracking-tight">
            Your local scene.<br>
            <span class="text-yellow-400">Live &amp; loud.</span>
          </h1>

          <!-- Subtext -->
          <p class="text-base text-white/50 leading-relaxed mb-10 max-w-md font-mono">
            Find gigs from local organizers, support indie shows, and get tickets straight from the people making it happen.
          </p>

          <!-- CTAs -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button (click)="scrollToShows()"
              class="inline-flex items-center justify-center gap-2 px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold uppercase tracking-wider text-sm transition-colors">
              See Shows
            </button>
            <a routerLink="/app/signup"
              class="inline-flex items-center justify-center gap-2 px-7 py-3 border-2 border-white/30 hover:border-white text-white font-bold uppercase tracking-wider text-sm transition-colors">
              List Your Show
            </a>
          </div>
        </div>
      </div>

      <!-- Scroll hint -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25 font-mono">
        <span class="text-xs uppercase tracking-widest">↓ shows</span>
      </div>
    </section>

    <!-- Shows listing -->
    <section id="shows" class="bg-black border-t-2 border-white/15 py-14 px-4 sm:px-6">
      <div class="max-w-5xl mx-auto">
        <div class="mb-10 flex items-baseline gap-4">
          <h2 class="text-xl font-black text-white uppercase tracking-widest">What's On</h2>
          <span class="text-xs font-mono text-white/30 uppercase tracking-widest">/ upcoming shows</span>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-24">
            <p class="text-sm font-mono text-white/30 uppercase tracking-widest animate-pulse">loading...</p>
          </div>
        } @else if (allEvents().length === 0) {
          <div class="py-24 border-2 border-dashed border-white/10 text-center">
            <p class="text-white/30 text-sm font-mono mb-4">nothing on yet. check back soon.</p>
            <a routerLink="/app/signup" class="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">
              organizer? list your show →
            </a>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            @for (event of allEvents(); track event.id) {
              <div class="group bg-black hover:bg-zinc-950 transition-colors border border-white/10">
                <!-- Poster -->
                @if (event.poster_url) {
                  <a [routerLink]="['/events', event.id]" class="block aspect-[4/3] overflow-hidden bg-zinc-900">
                    <img [src]="event.poster_url" [alt]="event.title"
                      class="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300">
                  </a>
                } @else {
                  <a [routerLink]="['/events', event.id]" class="block aspect-[4/3] bg-zinc-950 flex items-center justify-center border-b border-white/5"
                    style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                    <span class="text-white/10 font-black text-4xl uppercase tracking-widest">GIG</span>
                  </a>
                }

                <!-- Info -->
                <div class="p-4">
                  <a [routerLink]="['/events', event.id]">
                    <h3 class="font-black text-white text-base leading-snug line-clamp-2 mb-3 uppercase hover:text-yellow-400 transition-colors">{{ event.title }}</h3>
                  </a>

                  <!-- Date -->
                  <p class="font-mono text-yellow-400/80 text-xs mb-1 uppercase tracking-wide">
                    {{ event.date_and_time | date:'EEE MMM d · h:mm a' }}
                  </p>

                  <!-- Venue -->
                  @if (event.venue) {
                    <p class="font-mono text-white/35 text-xs mb-4 truncate">{{ event.venue }}</p>
                  } @else {
                    <div class="mb-4"></div>
                  }

                  <!-- Attending count -->
                  @if (event.tickets_sold && event.tickets_sold > 0) {
                    <div class="inline-flex items-center gap-1.5 mb-3 px-2 py-1 bg-white/5 border border-white/10">
                      <svg class="w-3.5 h-3.5 text-yellow-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      <span class="font-mono text-xs text-white/70"><span class="text-white font-bold">{{ event.tickets_sold }}</span> attending</span>
                    </div>
                  }

                  <!-- Footer -->
                  <div class="flex items-center justify-between pt-3 border-t border-white/10">
                    <span class="text-sm font-black text-white">{{ event.ticket_price_display }}</span>
                    @if (event.buy_shortlink && !event.is_closed) {
                      <a [href]="event.buy_shortlink" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-1 px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold uppercase tracking-wider transition-colors">
                        tickets →
                      </a>
                    } @else {
                      <span class="text-xs text-white/20 font-mono uppercase">{{ event.is_closed ? 'closed' : 'no link' }}</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Organizer CTA -->
        <div class="mt-16 border-2 border-white/20 p-8 text-center">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-widest mb-3">— for organizers —</p>
          <h3 class="text-2xl font-black text-white uppercase mb-2">Got a show to list?</h3>
          <p class="text-white/40 text-sm font-mono mb-6 max-w-sm mx-auto">
            run your own ticketing. set your own prices. keep your audience yours.
          </p>
          <a routerLink="/app/signup"
            class="inline-flex items-center gap-2 px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider text-sm transition-colors">
            Start for free →
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-black border-t-2 border-white/15 py-6 px-4 sm:px-6">
      <div class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-4 opacity-30">
        <div class="flex items-center gap-6 text-xs font-mono text-white/25">
          <a routerLink="/app/login" class="hover:text-white/60 uppercase tracking-wider transition-colors">organizer login</a>
          <a routerLink="/app/signup" class="hover:text-white/60 uppercase tracking-wider transition-colors">list a show</a>
        </div>
      </div>
    </footer>
  `
})
export class LandingComponent implements OnInit {
  loading = signal(true);
  allEvents = signal<PublicEvent[]>([]);
  userMenuOpen = signal(false);

  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}

  isLoggedIn = () => this.auth.isLoggedIn();
  userInitial = () => {
    const u = this.auth.getCurrentUser();
    return (u?.first_name?.[0] || u?.email_address?.[0] || u?.email?.[0] || 'U').toUpperCase();
  };
  userName = () => {
    const u = this.auth.getCurrentUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.email_address || u?.email || 'User');
  };
  brandName = () => this.auth.getCurrentUser()?.brand_name || null;

  logout(): void {
    this.auth.logout();
    this.userMenuOpen.set(false);
    this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.userMenuOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.http.get<{ brands: PublicBrand[] }>(
      `${environment.apiUrl}/public/events/domain/${environment.publicListingDomain}`
    ).subscribe({
      next: (res) => {
        const events = res.brands.flatMap(b => b.events);
        events.sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime());
        this.allEvents.set(events);
        this.loading.set(false);
        if (window.location.hash === '#shows') {
          setTimeout(() => document.getElementById('shows')?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  scrollToShows(): void {
    document.getElementById('shows')?.scrollIntoView({ behavior: 'smooth' });
  }
}
