import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AudienceAuthService } from '../../services/audience-auth.service';
import { ShareModalComponent } from '../../components/share-modal/share-modal.component';
import { AudienceAuthModalComponent } from '../../components/audience-auth-modal/audience-auth-modal.component';
import { AudienceHeaderComponent } from '../../components/audience-header/audience-header.component';

interface PublicEvent {
  id: number;
  title: string;
  date_and_time: string;
  venue?: string;
  poster_url?: string;
  ticket_price: number;
  ticket_price_display: string;
  ticket_naming?: string;
  buy_shortlink?: string;
  is_closed: boolean;
  tickets_sold?: number;
  brand_name?: string;
  brand_id?: number;
  event_type?: string | null;
  tags?: { id: number; name: string }[];
  ticketing_enabled?: boolean;
  external_ticket_link?: string | null;
  like_count?: number;
  co_organizer_names?: string[];
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, ShareModalComponent, AudienceAuthModalComponent, AudienceHeaderComponent],
  template: `
    <!-- Nav -->
    <app-audience-header></app-audience-header>

    <!-- Hero -->
    <section class="relative min-h-screen flex items-center bg-black overflow-hidden"
      [class.cursor-pointer]="heroEvents().length > 0"
      (click)="openHeroEvent()">
      <!-- Poster carousel background -->
      @for (poster of heroPosterUrls(); track poster; let i = $index) {
        <div class="absolute inset-0 bg-center bg-cover transition-opacity duration-1000"
          [style.background-image]="'url(' + poster + ')'"
          [style.opacity]="i === heroIndex() ? 1 : 0"></div>
      }
      <!-- Dark overlay -->
      <div class="absolute inset-0 bg-black/70"></div>
      <!-- Subtle diagonal stripe texture -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.03]"
        style="background-image: repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%); background-size: 12px 12px;"></div>

      <div class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20" (click)="$event.stopPropagation()">
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
            <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }"
              class="inline-flex items-center justify-center gap-2 px-7 py-3 border-2 border-white/30 hover:border-white text-white font-bold uppercase tracking-wider text-sm transition-colors">
              List Your Show
            </a>
          </div>
        </div>
      </div>

      <!-- Scroll hint -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25 font-mono" (click)="$event.stopPropagation()">
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

        <!-- Happening Today -->
        @if (!loading() && todayEvents().length > 0) {
          <div class="mb-12">
            <div class="flex items-center gap-3 mb-5">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
              </span>
              <h3 class="text-xs font-black text-yellow-400 uppercase tracking-widest">Happening Today</h3>
            </div>
            <div class="flex flex-col gap-3">
              @for (event of todayEvents(); track event.id) {
                <a [routerLink]="['/events', event.id]"
                  class="group relative flex items-end min-h-48 border-2 border-yellow-400/40 hover:border-yellow-400 transition-all overflow-hidden"
                  [style.background-image]="event.poster_url ? 'url(' + event.poster_url + ')' : null"
                  [style.background-size]="'cover'"
                  [style.background-position]="'center'">
                  <!-- Overlay -->
                  <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20 group-hover:from-black/80 transition-all"></div>
                  @if (!event.poster_url) {
                    <div class="absolute inset-0 bg-yellow-400/5"
                      style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;"></div>
                  }
                  <!-- Content -->
                  <div class="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between w-full gap-4 p-5 sm:p-6">
                    <div class="min-w-0">
                      @if (event.brand_name) {
                        <p class="text-[10px] font-mono text-yellow-400/80 uppercase tracking-wider mb-1 truncate">
                          {{ event.brand_name }}{{ event.co_organizer_names && event.co_organizer_names.length > 0 ? ' · ' + formatCoOrganizers(event.co_organizer_names) : '' }}
                        </p>
                      }
                      <p class="text-2xl font-black text-white group-hover:text-yellow-400 transition-colors uppercase leading-tight mb-1">{{ event.title }}</p>
                      <div class="flex items-stretch gap-2 mt-1 mb-0.5">
                        <div class="flex flex-col items-center justify-center border border-yellow-400/40 bg-black/40 px-2 py-1 text-center w-12 sm:w-20 flex-shrink-0">
                          <p class="text-[9px] font-mono text-yellow-400 uppercase leading-none tracking-wider">today</p>
                          <p class="text-sm font-black text-white leading-tight">{{ event.date_and_time | date:'h:mm' }}</p>
                          <p class="text-[9px] font-mono text-white/50 leading-none">{{ event.date_and_time | date:'a' }}</p>
                        </div>
                        @if (event.venue) {
                          <div class="flex flex-col items-center justify-center border border-white/20 bg-black/40 px-2 py-1 text-center flex-1 sm:max-w-48">
                            <p class="text-[9px] font-mono text-white/40 uppercase leading-none tracking-wider">venue</p>
                            <p class="text-xs font-black text-white leading-tight">{{ event.venue }}</p>
                          </div>
                        }
                      </div>
                      @if (event.event_type || (event.tags && event.tags.length > 0)) {
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          @if (event.event_type) {
                            <span class="px-2 py-0.5 text-[10px] font-mono text-yellow-400/80 border border-yellow-400/30 uppercase">{{ event.event_type.replace('_', ' ') }}</span>
                          }
                          @for (tag of (event.tags || []).slice(0, 3); track tag.id) {
                            <span class="px-2 py-0.5 text-[10px] font-mono text-white/50 border border-white/20">{{ tag.name }}</span>
                          }
                        </div>
                      }
                    </div>
                    <!-- CTA -->
                    <div class="flex-shrink-0 flex flex-col sm:items-end gap-2">
                      @if (event.external_ticket_link && !event.is_closed) {
                        <a [href]="event.external_ticket_link" target="_blank" rel="noopener" (click)="$event.stopPropagation()"
                          class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors">
                          Get Tickets →
                        </a>
                      } @else if (event.buy_shortlink && !event.is_closed && event.ticketing_enabled !== false) {
                        <a [href]="event.buy_shortlink" target="_blank" rel="noopener" (click)="$event.stopPropagation()"
                          class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-black uppercase tracking-wider transition-colors">
                          Get Tickets →
                        </a>
                        <p class="text-[10px] font-mono text-white/40">{{ event.ticket_price === 0 ? 'Free' : event.ticket_price_display }}</p>
                      }
                      @if (event.tickets_sold && event.tickets_sold > 0) {
                        <p class="text-[10px] font-mono text-white/40">{{ event.tickets_sold }} attending</p>
                      }
                    </div>
                  </div>
                </a>
              }
            </div>
          </div>
        }

        @if (loading()) {
          <div class="flex items-center justify-center py-24">
            <p class="text-sm font-mono text-white/30 uppercase tracking-widest animate-pulse">loading...</p>
          </div>
        } @else if (upcomingEvents().length === 0 && todayEvents().length === 0) {
          <div class="py-24 border-2 border-dashed border-white/10 text-center">
            <p class="text-white/30 text-sm font-mono mb-4">nothing on yet. check back soon.</p>
            <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }" class="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">
              organizer? list your show →
            </a>
          </div>
        } @else if (upcomingEvents().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            @for (event of upcomingEvents(); track event.id) {
              <div class="group bg-black hover:bg-zinc-950 transition-colors border border-white/10 flex flex-col">
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
                <div class="p-4 flex flex-col flex-1">
                  @if (event.brand_name) {
                    <p class="font-mono text-white/35 text-xs mb-1.5 uppercase tracking-wider truncate">
                      @if (event.brand_id) {
                        <a [routerLink]="['/organizers', event.brand_id]" class="hover:text-yellow-400/70 transition-colors">{{ event.brand_name }}</a>
                      } @else {
                        {{ event.brand_name }}
                      }
                      @if (event.co_organizer_names && event.co_organizer_names.length > 0) {
                        <span class="text-white/20"> · </span>{{ formatCoOrganizers(event.co_organizer_names) }}
                      }
                    </p>
                  }
                  <a [routerLink]="['/events', event.id]">
                    <h3 class="font-black text-white text-base leading-snug line-clamp-2 mb-3 uppercase hover:text-yellow-400 transition-colors">{{ event.title }}</h3>
                  </a>

                  <!-- Date -->
                  <p class="font-mono text-yellow-400/80 text-xs mb-1 uppercase tracking-wide">
                    {{ event.date_and_time | date:'EEE MMM d · h:mm a' }}
                  </p>

                  <!-- Venue -->
                  @if (event.venue) {
                    <p class="font-mono text-white/35 text-xs mb-2 truncate">{{ event.venue }}</p>
                  } @else {
                    <div class="mb-2"></div>
                  }

                  <!-- Event type + tags -->
                  @if (event.event_type || (event.tags && event.tags.length > 0)) {
                    <div class="flex flex-wrap gap-1.5 mb-3">
                      @if (event.event_type) {
                        <span class="px-2 py-0.5 text-xs font-mono text-yellow-400/80 border border-yellow-400/30 uppercase tracking-wide">{{ event.event_type.replace('_', ' ') }}</span>
                      }
                      @for (tag of (event.tags || []); track tag.id) {
                        <span class="px-2 py-0.5 text-xs font-mono text-white/40 border border-white/15">{{ tag.name }}</span>
                      }
                    </div>
                  }

                  <!-- Ticket CTA + attending count row -->
                  <div class="flex items-center justify-between mb-3">
                    @if (event.external_ticket_link && !event.is_closed) {
                      <a [href]="event.external_ticket_link" target="_blank" rel="noopener"
                        class="inline-flex flex-col px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors">
                        <span class="text-xs font-bold uppercase tracking-wider leading-tight">Get Tickets →</span>
                      </a>
                    } @else if (event.buy_shortlink && !event.is_closed && event.ticketing_enabled !== false) {
                      <a [href]="event.buy_shortlink" target="_blank" rel="noopener"
                        class="inline-flex flex-col px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors">
                        <span class="text-xs font-bold uppercase tracking-wider leading-tight">Get Tickets →</span>
                        <span class="text-[10px] font-mono leading-tight opacity-70">{{ event.ticket_price === 0 ? 'FREE' : event.ticket_price_display }}</span>
                      </a>
                    } @else if (event.is_closed) {
                      <span class="text-xs text-white/20 font-mono uppercase">closed</span>
                    } @else {
                      <a [routerLink]="['/events', event.id]"
                        class="inline-flex flex-col px-3 py-1.5 border border-white/20 hover:border-white/50 text-white/50 hover:text-white transition-colors">
                        <span class="text-xs font-bold uppercase tracking-wider leading-tight">View →</span>
                        <span class="text-[10px] font-mono leading-tight opacity-70">{{ event.ticket_price_display }}</span>
                      </a>
                    }
                    @if (event.tickets_sold && event.tickets_sold > 0) {
                      <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10">
                        <svg class="w-3.5 h-3.5 text-yellow-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span class="font-mono text-xs text-white/70"><span class="text-white font-bold">{{ event.tickets_sold }}</span> attending</span>
                      </div>
                    }
                  </div>

                  <!-- Actions bar -->
                  <div class="flex items-center gap-3 pt-3 mt-auto border-t border-white/10">
                    <button (click)="openShare($event, event)" title="Share"
                      class="inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs font-mono uppercase tracking-wider transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                      </svg>
                      Share
                    </button>
                    <button (click)="onLikeClick($event, event)" title="Like"
                      class="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider transition-colors"
                      [class]="likedEventIds().has(event.id) ? 'text-red-400 hover:text-red-300' : 'text-white/30 hover:text-white/70'">
                      <svg class="w-4 h-4" [attr.fill]="likedEventIds().has(event.id) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      {{ (event.like_count || 0) > 0 ? (event.like_count) : 'Like' }}
                    </button>
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
          <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }"
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
          <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }" class="hover:text-white/60 uppercase tracking-wider transition-colors">list a show</a>
        </div>
      </div>
    </footer>

    <!-- Share modal -->
    @if (shareModal()) {
      <app-share-modal
        [url]="shareModal()!.url"
        [title]="shareModal()!.title"
        (close)="shareModal.set(null)">
      </app-share-modal>
    }

    <!-- Audience auth modal -->
    @if (showAuthModal()) {
      <app-audience-auth-modal
        [signupReturnUrl]="signupReturnUrl()"
        (closed)="showAuthModal.set(false)"
        (authenticated)="onModalAuthenticated()">
      </app-audience-auth-modal>
    }
  `
})
export class LandingComponent implements OnInit, OnDestroy {
  loading = signal(true);
  allEvents = signal<PublicEvent[]>([]);
  shareModal = signal<{ url: string; title: string } | null>(null);
  likedEventIds = signal<Set<number>>(new Set());
  showAuthModal = signal(false);
  pendingLikeEventId = signal<number | null>(null);

  todayEvents = computed(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return this.allEvents().filter(e =>
      new Date(e.date_and_time).toLocaleDateString('en-CA') === todayStr
    );
  });

  upcomingEvents = computed(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return this.allEvents().filter(e =>
      new Date(e.date_and_time).toLocaleDateString('en-CA') !== todayStr
    );
  });

  heroIndex = signal(0);
  heroEvents = computed(() =>
    this.allEvents()
      .filter(e => !!e.poster_url)
      .slice(0, 10)
  );
  heroPosterUrls = computed(() => this.heroEvents().map(e => e.poster_url!));
  private heroTimer: ReturnType<typeof setInterval> | null = null;

  signupReturnUrl = computed(() => {
    const id = this.pendingLikeEventId();
    return id !== null ? `/?pendingLike=${id}` : '/';
  });

  constructor(
    private http: HttpClient,
    private audienceAuth: AudienceAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private titleService: Title,
    private metaService: Meta
  ) {}

  ngOnInit(): void {
    const homeTitle = 'Your Scene – Local Shows, Indie Concerts & Live Music in the Philippines';
    const homeDesc = 'Discover local shows, indie concerts, and live music events in the Philippines — Cebu, Manila, and beyond. Browse upcoming gigs, get tickets, and support your local scene.';
    this.titleService.setTitle(homeTitle);
    this.metaService.updateTag({ name: 'description', content: homeDesc });
    this.metaService.updateTag({ property: 'og:title', content: homeTitle });
    this.metaService.updateTag({ property: 'og:description', content: homeDesc });
    this.metaService.updateTag({ property: 'og:url', content: window.location.href });
    this.metaService.updateTag({ property: 'og:image', content: `${window.location.origin}/assets/og-image.png` });
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:image', content: `${window.location.origin}/assets/og-image.png` });
    this.metaService.updateTag({ name: 'twitter:title', content: homeTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: homeDesc });

    this.http.get<{ events: PublicEvent[] }>(
      `${environment.apiUrl}/public/events`
    ).subscribe({
      next: (res) => {
        const events = res.events;
        this.allEvents.set(events);
        this.loading.set(false);
        this.startHeroCarousel();
        if (window.location.hash === '#shows') {
          setTimeout(() => document.getElementById('shows')?.scrollIntoView({ behavior: 'smooth' }), 50);
        }

        // Handle pendingLike query param
        const pendingLike = this.route.snapshot.queryParamMap.get('pendingLike');
        if (pendingLike && this.audienceAuth.isLoggedIn()) {
          const eventId = parseInt(pendingLike, 10);
          const ev = events.find(e => e.id === eventId);
          if (ev) {
            this.likeEvent(new MouseEvent('click'), ev);
          }
          // Clear the query param from URL
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      },
      error: () => this.loading.set(false)
    });

    if (this.audienceAuth.isLoggedIn()) {
      this.audienceAuth.getLikedEvents().subscribe({
        next: (res) => this.likedEventIds.set(new Set(res.liked_event_ids))
      });
    }
  }

  onLikeClick(event: MouseEvent, ev: PublicEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.audienceAuth.isLoggedIn()) {
      this.likeEvent(event, ev);
    } else {
      this.pendingLikeEventId.set(ev.id);
      this.showAuthModal.set(true);
    }
  }

  onModalAuthenticated(): void {
    this.showAuthModal.set(false);
    const id = this.pendingLikeEventId();
    if (id !== null) {
      const ev = this.allEvents().find(e => e.id === id);
      if (ev) this.likeEvent(new MouseEvent('click'), ev);
      this.pendingLikeEventId.set(null);
    }
  }

  likeEvent(event: MouseEvent, ev: PublicEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.audienceAuth.toggleEventLike(ev.id).subscribe({
      next: (res) => {
        const ids = new Set(this.likedEventIds());
        if (res.liked) {
          ids.add(ev.id);
        } else {
          ids.delete(ev.id);
        }
        this.likedEventIds.set(ids);
        this.allEvents.update(events =>
          events.map(e => e.id === ev.id ? { ...e, like_count: res.like_count } : e)
        );
      }
    });
  }

  openHeroEvent(): void {
    const ev = this.heroEvents()[this.heroIndex()];
    if (ev) this.router.navigate(['/events', ev.id]);
  }

  private startHeroCarousel(): void {
    if (this.heroPosterUrls().length < 2) return;
    this.heroTimer = setInterval(() => {
      this.heroIndex.update(i => (i + 1) % this.heroPosterUrls().length);
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
  }

  scrollToShows(): void {
    document.getElementById('shows')?.scrollIntoView({ behavior: 'smooth' });
  }

  formatCoOrganizers(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  openShare(event: MouseEvent, ev: PublicEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}/events/${ev.id}`;
    this.shareModal.set({ url, title: ev.title });
  }
}
