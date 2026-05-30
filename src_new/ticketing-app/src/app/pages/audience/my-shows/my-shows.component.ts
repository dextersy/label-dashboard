import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService } from '../../../services/audience-auth.service';

interface EventGroup {
  event: {
    id: number;
    title: string;
    date_and_time: string;
    venue: string;
    poster_url?: string;
    brand?: { name: string; color?: string; logo_url?: string };
  };
  tickets: any[];
  isPast: boolean;
}

@Component({
  selector: 'app-my-shows',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black text-white">

      <!-- Header -->
      <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <div class="flex items-center gap-4">
            <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>
            <span class="text-white/20 text-sm font-mono">/ My Shows</span>
          </div>
          <div class="flex items-center gap-4">
            <div class="relative">
              <button (click)="menuOpen.set(!menuOpen())"
                class="w-7 h-7 bg-white flex items-center justify-center flex-shrink-0 focus:outline-none">
                <span class="text-black text-xs font-black">{{ userInitial() }}</span>
              </button>
              @if (menuOpen()) {
                <div class="absolute right-0 top-full mt-2 w-44 bg-black border border-white/20 shadow-xl z-50">
                  <div class="px-4 py-3 border-b border-white/10">
                    <p class="text-xs font-mono text-white truncate">{{ userName() }}</p>
                    <p class="text-xs font-mono text-white/40">Audience</p>
                  </div>
                  <a routerLink="/my-shows" (click)="menuOpen.set(false)"
                    class="flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    My Shows
                  </a>
                  <button (click)="logout()"
                    class="w-full flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors border-t border-white/10">
                    Log out
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Email verification banner -->
      @if (!emailVerified()) {
        <div class="border-b-2 border-yellow-400/50 bg-yellow-400/10 px-4 py-3">
          <div class="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p class="text-yellow-300 text-xs font-mono">
              Please verify your email address to keep your account secure.
            </p>
            <div class="flex items-center gap-4">
              @if (verificationSent()) {
                <span class="text-green-400 text-xs font-mono">Verification email sent!</span>
              } @else {
                <button type="button" (click)="resendVerification()" [disabled]="resendingVerification()"
                  class="text-xs font-mono text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ resendingVerification() ? 'Sending...' : 'Resend email' }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <main class="max-w-5xl mx-auto px-4 py-10 pt-20">

        <h1 class="text-3xl font-black uppercase text-white mb-8">My Shows</h1>

        <!-- Loading -->
        <div *ngIf="loading()" class="flex justify-center py-20">
          <div class="w-8 h-8 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin"></div>
        </div>

        <!-- Error -->
        <div *ngIf="error()" class="border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono p-4">
          Failed to load your shows. Please try again.
        </div>

        <!-- Empty state -->
        <div *ngIf="!loading() && !error() && eventGroups().length === 0" class="text-center py-20">
          <p class="text-4xl mb-4">🎵</p>
          <p class="text-white/40 font-mono text-sm uppercase tracking-widest mb-2">No shows yet</p>
          <p class="text-white/25 text-xs font-mono">Buy your first ticket to get started</p>
        </div>

        <!-- Upcoming shows -->
        <section *ngIf="upcomingGroups().length > 0" class="mb-12">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— upcoming —</p>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <a *ngFor="let group of upcomingGroups()"
              [routerLink]="['/my-shows', group.event.id]"
              class="block border border-white/10 hover:border-white/30 transition-all cursor-pointer bg-white/5 hover:bg-white/8 group">
              <!-- Poster -->
              <div class="aspect-square overflow-hidden bg-white/5">
                <img *ngIf="group.event.poster_url" [src]="group.event.poster_url" [alt]="group.event.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <div *ngIf="!group.event.poster_url" class="w-full h-full flex items-center justify-center border-b border-white/5"
                  style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                  <span class="text-white/10 font-black text-2xl uppercase tracking-widest">GIG</span>
                </div>
              </div>
              <!-- Info -->
              <div class="p-3">
                <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-1">{{ formatDate(group.event.date_and_time) }}</p>
                <p class="font-bold text-white leading-tight text-sm line-clamp-2">{{ group.event.title }}</p>
                <p class="text-xs text-white/35 mt-1.5">{{ group.tickets.length }} ticket{{ group.tickets.length !== 1 ? 's' : '' }}</p>
              </div>
            </a>
          </div>
        </section>

        <!-- Past shows -->
        <section *ngIf="pastGroups().length > 0">
          <p class="text-xs font-mono text-white/30 uppercase tracking-[0.25em] mb-5">— past shows —</p>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <a *ngFor="let group of pastGroups()"
              [routerLink]="['/my-shows', group.event.id]"
              class="block border border-white/5 hover:border-white/15 transition-all cursor-pointer opacity-50 hover:opacity-75 group">
              <!-- Poster -->
              <div class="aspect-square overflow-hidden bg-white/5">
                <img *ngIf="group.event.poster_url" [src]="group.event.poster_url" [alt]="group.event.title"
                  class="w-full h-full object-cover grayscale">
                <div *ngIf="!group.event.poster_url" class="w-full h-full flex items-center justify-center border-b border-white/5"
                  style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                  <span class="text-white/10 font-black text-2xl uppercase tracking-widest">GIG</span>
                </div>
              </div>
              <!-- Info -->
              <div class="p-3">
                <p class="text-xs font-mono text-white/20 uppercase tracking-widest mb-1">{{ formatDate(group.event.date_and_time) }}</p>
                <p class="font-semibold text-white/60 leading-tight text-sm line-clamp-2">{{ group.event.title }}</p>
                <p class="text-xs text-white/20 mt-1.5">{{ group.tickets.length }} ticket{{ group.tickets.length !== 1 ? 's' : '' }}</p>
              </div>
            </a>
          </div>
        </section>

      </main>
    </div>
  `
})
export class MyShowsComponent implements OnInit {
  loading = signal(true);
  error = signal(false);
  eventGroups = signal<EventGroup[]>([]);
  menuOpen = signal(false);
  emailVerified = signal(true);
  resendingVerification = signal(false);
  verificationSent = signal(false);

  userInitial = () => {
    const u = this.audienceAuthService.getUser();
    return (u?.first_name?.[0] || u?.email_address?.[0] || 'A').toUpperCase();
  };
  userName = () => {
    const u = this.audienceAuthService.getUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.email_address || 'Guest');
  };

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.relative')) {
      this.menuOpen.set(false);
    }
  }

  constructor(
    private audienceAuthService: AudienceAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.audienceAuthService.getUser();
    this.emailVerified.set(user?.email_verified !== false);
    this.loadTickets();
  }

  resendVerification(): void {
    this.resendingVerification.set(true);
    this.audienceAuthService.resendVerification().subscribe({
      next: () => { this.resendingVerification.set(false); this.verificationSent.set(true); },
      error: () => { this.resendingVerification.set(false); },
    });
  }

  loadTickets(): void {
    this.audienceAuthService.getTickets().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.eventGroups.set(this.groupByEvent(res.tickets));
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private groupByEvent(tickets: any[]): EventGroup[] {
    const map = new Map<number, EventGroup>();
    const now = new Date();

    for (const ticket of tickets) {
      const event = ticket.event;
      if (!event) continue;
      if (!map.has(event.id)) {
        map.set(event.id, {
          event,
          tickets: [],
          isPast: new Date(event.date_and_time) < now
        });
      }
      map.get(event.id)!.tickets.push(ticket);
    }

    return Array.from(map.values()).sort((a, b) =>
      new Date(b.event.date_and_time).getTime() - new Date(a.event.date_and_time).getTime()
    );
  }

  upcomingGroups(): EventGroup[] {
    return this.eventGroups().filter(g => !g.isPast);
  }

  pastGroups(): EventGroup[] {
    return this.eventGroups().filter(g => g.isPast);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  logout(): void {
    this.audienceAuthService.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }
}
