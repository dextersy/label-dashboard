import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';

interface PublicEventView {
  id: number;
  title: string;
  description?: string;
  date_and_time: string;
  close_time?: string;
  venue?: string;
  poster_url?: string;
  ticket_price_display: string;
  ticket_naming?: string;
  buy_shortlink?: string;
  is_closed: boolean;
  tickets_sold?: number;
  venue_address?: string;
  venue_maps_url?: string;
  venue_phone?: string;
  venue_website?: string;
  ticketTypes?: {
    id: number;
    name: string;
    price: number;
    is_available: boolean;
    is_sold_out: boolean;
    remaining_tickets: number | null;
    special_instructions?: string;
  }[];
  brand?: {
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
  } | null;
  event_type?: string | null;
  tags?: { id: number; name: string }[];
}

@Component({
  selector: 'app-event-view',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <!-- Nav -->
    <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
        <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>
        <div class="flex items-center gap-4">
          <a href="/#shows" class="text-xs font-mono text-white/40 hover:text-white uppercase tracking-wider transition-colors">← All Shows</a>
        </div>
      </div>
    </header>

    <main class="bg-black min-h-screen pt-12">
      @if (loading()) {
        <div class="flex items-center justify-center py-40">
          <p class="text-sm font-mono text-white/30 uppercase tracking-widest animate-pulse">loading...</p>
        </div>
      } @else if (error()) {
        <div class="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <p class="text-white/30 font-mono text-sm mb-4 uppercase tracking-widest">event not found</p>
          <a href="/#shows" class="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">← back to shows</a>
        </div>
      } @else if (event()) {
        <!-- Hero: poster + core info -->
        <section class="relative">
          @if (event()!.poster_url) {
            <!-- Blurred bg poster -->
            <div class="absolute inset-0 overflow-hidden">
              <img [src]="event()!.poster_url" alt="" class="w-full h-full object-cover opacity-15 blur-2xl scale-110">
              <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black"></div>
            </div>
          }
          <div class="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-10">
            <div class="flex flex-col md:flex-row gap-8 items-start">
              <!-- Poster -->
              <div class="flex-shrink-0 w-full md:w-64">
                @if (event()!.poster_url) {
                  <img [src]="event()!.poster_url" [alt]="event()!.title"
                    class="w-full md:w-64 aspect-[3/4] object-cover border-2 border-white/10 shadow-2xl">
                } @else {
                  <div class="w-full md:w-64 aspect-[3/4] bg-zinc-950 border-2 border-white/10 flex items-center justify-center"
                    style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                    <span class="text-white/10 font-black text-5xl uppercase tracking-widest">GIG</span>
                  </div>
                }
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 py-2">
                @if (event()!.brand) {
                  <p class="text-xs font-mono text-yellow-400/70 uppercase tracking-[0.2em] mb-3">{{ event()!.brand!.name }}</p>
                }
                <h1 class="text-3xl sm:text-4xl font-black text-white uppercase leading-tight mb-5">{{ event()!.title }}</h1>

                <!-- Date & time -->
                <div class="flex items-start gap-3 mb-3">
                  <svg class="w-4 h-4 text-yellow-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p class="font-mono text-white text-sm">{{ event()!.date_and_time | date:'EEEE, MMMM d, y' }}</p>
                    <p class="font-mono text-white/50 text-xs">{{ event()!.date_and_time | date:'h:mm a' }}</p>
                  </div>
                </div>

                <!-- Venue -->
                @if (event()!.venue || event()!.venue_address) {
                  <div class="flex items-start gap-3 mb-5">
                    <svg class="w-4 h-4 text-yellow-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <div>
                      @if (event()!.venue) {
                        <p class="font-mono text-white text-sm">{{ event()!.venue }}</p>
                      }
                      @if (event()!.venue_address) {
                        <p class="font-mono text-white/40 text-xs mt-0.5">{{ event()!.venue_address }}</p>
                      }
                      @if (event()!.venue_maps_url) {
                        <a [href]="event()!.venue_maps_url" target="_blank" rel="noopener"
                          class="text-xs font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-wider transition-colors mt-1 inline-block">
                          View on maps →
                        </a>
                      }
                    </div>
                  </div>
                }

                <!-- Event type + tags -->
                @if (event()!.event_type || (event()!.tags && event()!.tags!.length > 0)) {
                  <div class="flex flex-wrap gap-1.5 mb-5">
                    @if (event()!.event_type) {
                      <span class="px-2.5 py-1 text-xs font-mono text-yellow-400/80 border border-yellow-400/30 uppercase tracking-wide">{{ event()!.event_type!.replace('_', ' ') }}</span>
                    }
                    @for (tag of (event()!.tags || []); track tag.id) {
                      <span class="px-2.5 py-1 text-xs font-mono text-white/40 border border-white/15">{{ tag.name }}</span>
                    }
                  </div>
                }

                <!-- Status / CTA -->
                @if (event()!.is_closed) {
                  <div class="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-white/20 text-white/30 text-sm font-bold uppercase tracking-wider">
                    <span class="w-2 h-2 rounded-full bg-white/20 flex-shrink-0"></span>
                    Tickets Closed
                  </div>
                } @else if (event()!.buy_shortlink) {
                  <a [href]="event()!.buy_shortlink" target="_blank" rel="noopener"
                    class="inline-flex items-center gap-2 px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider text-sm transition-colors shadow-lg">
                    Get Tickets →
                  </a>
                }

                <!-- Price -->
                <p class="text-white/30 font-mono text-xs mt-3 uppercase tracking-wider">{{ event()!.ticket_price_display }}</p>

                <!-- Attending count -->
                @if (event()!.tickets_sold && event()!.tickets_sold! > 0) {
                  <div class="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-white/5 border border-white/10">
                    <svg class="w-4 h-4 text-yellow-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span class="font-mono text-sm text-white/70"><span class="text-white font-bold">{{ event()!.tickets_sold }}</span> people attending</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- Divider -->
        <div class="border-t-2 border-white/10"></div>

        <!-- Details section -->
        <section class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-10">

            <!-- Left: description + ticket types -->
            <div class="md:col-span-2 space-y-10">
              @if (event()!.description) {
                <div>
                  <h2 class="text-xs font-mono text-white/30 uppercase tracking-widest mb-4">About this show</h2>
                  <p class="text-white/70 text-sm leading-relaxed font-mono" [innerHTML]="event()!.description"></p>
                </div>
              }

              @if (event()!.ticketTypes && event()!.ticketTypes!.length > 0) {
                <div>
                  <h2 class="text-xs font-mono text-white/30 uppercase tracking-widest mb-4">Ticket Types</h2>
                  <div class="space-y-2">
                    @for (tt of event()!.ticketTypes!; track tt.id) {
                      <div class="flex items-center justify-between p-4 border border-white/10 bg-zinc-950">
                        <div>
                          <p class="text-white text-sm font-bold uppercase">{{ tt.name }}</p>
                          @if (tt.special_instructions) {
                            <p class="text-white/35 text-xs font-mono mt-0.5">{{ tt.special_instructions }}</p>
                          }
                          @if (tt.remaining_tickets !== null && tt.remaining_tickets !== undefined && tt.remaining_tickets <= 20 && !tt.is_sold_out) {
                            <p class="text-yellow-400/70 text-xs font-mono mt-0.5 uppercase">Only {{ tt.remaining_tickets }} left</p>
                          }
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                          <p class="text-white font-black text-sm">
                            {{ tt.price === 0 ? 'FREE' : ('₱' + (tt.price | number:'1.0-0')) }}
                          </p>
                          @if (tt.is_sold_out) {
                            <p class="text-white/25 text-xs font-mono uppercase mt-0.5">Sold out</p>
                          } @else if (!tt.is_available) {
                            <p class="text-white/25 text-xs font-mono uppercase mt-0.5">Not available</p>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- CTA below ticket types -->
                  @if (!event()!.is_closed && event()!.buy_shortlink) {
                    <div class="mt-6">
                      <a [href]="event()!.buy_shortlink" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-2 px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider text-sm transition-colors">
                        Get Tickets →
                      </a>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right: sidebar details -->
            <div class="space-y-6">
              <!-- Date summary card -->
              <div class="border border-white/10 p-4">
                <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Date & Time</p>
                <p class="text-white font-bold text-sm">{{ event()!.date_and_time | date:'EEE, MMM d, y' }}</p>
                <p class="text-white/50 text-xs font-mono mt-0.5">{{ event()!.date_and_time | date:'h:mm a' }}</p>
                @if (event()!.close_time) {
                  <p class="text-white/30 text-xs font-mono mt-1">Closes {{ event()!.close_time | date:'h:mm a' }}</p>
                }
              </div>

              <!-- Venue card -->
              @if (event()!.venue) {
                <div class="border border-white/10 p-4">
                  <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Venue</p>
                  <p class="text-white font-bold text-sm">{{ event()!.venue }}</p>
                  @if (event()!.venue_address) {
                    <p class="text-white/40 text-xs font-mono mt-1">{{ event()!.venue_address }}</p>
                  }
                  @if (event()!.venue_phone) {
                    <p class="text-white/40 text-xs font-mono mt-1">{{ event()!.venue_phone }}</p>
                  }
                  @if (event()!.venue_maps_url) {
                    <a [href]="event()!.venue_maps_url" target="_blank" rel="noopener"
                      class="text-xs font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-wider transition-colors mt-2 inline-block">
                      Open in Maps →
                    </a>
                  }
                </div>
              }

              <!-- Organizer card -->
              @if (event()!.brand) {
                <div class="border border-white/10 p-4">
                  <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Organizer</p>
                  @if (event()!.brand!.logo_url) {
                    <img [src]="event()!.brand!.logo_url" [alt]="event()!.brand!.name" class="h-6 mb-2 opacity-70">
                  } @else {
                    <p class="text-white font-bold text-sm">{{ event()!.brand!.name }}</p>
                  }
                </div>
              }
            </div>

          </div>
        </section>

      }
    </main>

    <!-- Footer -->
    <footer class="bg-black border-t-2 border-white/10 py-6 px-4 sm:px-6">
      <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-4 opacity-25">
        <div class="flex items-center gap-6 text-xs font-mono text-white/20">
          <a href="/#shows" class="hover:text-white/50 uppercase tracking-wider transition-colors">All Shows</a>
          <a routerLink="/app/signup" class="hover:text-white/50 uppercase tracking-wider transition-colors">List a Show</a>
        </div>
      </div>
    </footer>
  `
})
export class EventViewComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal(false);
  event = signal<PublicEventView | null>(null);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private titleService: Title,
    private metaService: Meta
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.http.get<{ event: PublicEventView }>(`${environment.apiUrl}/public/events/${id}`).subscribe({
      next: (res) => {
        this.event.set(res.event);
        this.loading.set(false);
        this.updateSEOTags(res.event);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.titleService.setTitle('Event Not Found');
      }
    });
  }

  ngOnDestroy(): void {
    // Reset meta tags when leaving the page
    this.metaService.removeTag('name="description"');
    this.metaService.removeTag('property="og:title"');
    this.metaService.removeTag('property="og:description"');
    this.metaService.removeTag('property="og:image"');
    this.metaService.removeTag('property="og:type"');
    this.metaService.removeTag('property="og:url"');
    this.metaService.removeTag('name="twitter:card"');
    this.metaService.removeTag('name="twitter:title"');
    this.metaService.removeTag('name="twitter:description"');
    this.metaService.removeTag('name="twitter:image"');
  }

  private updateSEOTags(event: PublicEventView): void {
    const dateStr = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(event.date_and_time));

    const venue = event.venue || event.venue_address || '';
    const description = event.description
      ? event.description.slice(0, 160)
      : `${dateStr}${venue ? ' · ' + venue : ''} · ${event.ticket_price_display}`;

    const pageTitle = `${event.title}${venue ? ' at ' + venue : ''} | Your Scene`;

    this.titleService.setTitle(pageTitle);

    // Standard meta
    this.metaService.updateTag({ name: 'description', content: description });

    // Open Graph (Facebook, LinkedIn, WhatsApp, etc.)
    this.metaService.updateTag({ property: 'og:type', content: 'event' });
    this.metaService.updateTag({ property: 'og:title', content: event.title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    if (event.poster_url) {
      this.metaService.updateTag({ property: 'og:image', content: event.poster_url });
    }
    this.metaService.updateTag({ property: 'og:url', content: window.location.href });

    // Twitter card
    this.metaService.updateTag({ name: 'twitter:card', content: event.poster_url ? 'summary_large_image' : 'summary' });
    this.metaService.updateTag({ name: 'twitter:title', content: event.title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    if (event.poster_url) {
      this.metaService.updateTag({ name: 'twitter:image', content: event.poster_url });
    }
  }
}
