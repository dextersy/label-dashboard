import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceUser } from '../../../services/audience-auth.service';

interface EventGroup {
  event: {
    id: number;
    title: string;
    date_and_time: string;
    venue: string;
    poster_url?: string;
    brand?: { id: number; name: string; color?: string; logo_url?: string };
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
                class="w-7 h-7 flex-shrink-0 focus:outline-none overflow-hidden border border-white/20">
                @if (userPhotoUrl()) {
                  <img [src]="userPhotoUrl()" alt="Profile" class="w-full h-full object-cover">
                } @else {
                  <div class="w-full h-full bg-white flex items-center justify-center">
                    <span class="text-black text-xs font-black">{{ userInitial() }}</span>
                  </div>
                }
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
                  <a routerLink="/my-profile" (click)="menuOpen.set(false)"
                    class="flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Edit Profile
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

      <main class="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-12">
        <div class="lg:grid lg:grid-cols-[300px_1fr] lg:gap-10 lg:items-start">

          <!-- ── Left column: membership card + stats ──────────────────────── -->
          <div class="lg:sticky lg:top-20 mb-10 lg:mb-0">

            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-4">— Your Scene Pass —</p>

            <!-- Card — credit card aspect ratio 85.6:54 ≈ 1.586:1 -->
            <div class="rounded-xl overflow-hidden shadow-2xl shadow-black/60" [ngClass]="cardBgClass()">
              <div class="relative p-5 sm:p-6" style="aspect-ratio: 85.6 / 54">

                <!-- Shimmer overlay -->
                <div class="absolute inset-0 pointer-events-none rounded-xl" [ngClass]="cardShimmerClass()"></div>

                <!-- Top row: logo + tier badge -->
                <div class="relative z-10 flex items-start justify-between mb-5">
                  <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-5 opacity-90">
                  <span class="text-[10px] font-black uppercase tracking-[0.3em]" [ngClass]="tierLabelClass()">
                    {{ membershipTier() | uppercase }}
                  </span>
                </div>

                <!-- Chip -->
                <div class="relative z-10 mb-4">
                  <div class="w-9 h-7 rounded-sm border opacity-60 flex items-center justify-center" [ngClass]="chipClass()">
                    <div class="w-full h-px opacity-50" [ngClass]="chipLineClass()"></div>
                  </div>
                </div>

                <!-- Membership number -->
                <div class="relative z-10 mb-4">
                  <p class="font-mono text-base tracking-[0.2em]" [ngClass]="cardNumberClass()">
                    {{ formattedMembershipId() }}
                  </p>
                </div>

                <!-- Bottom row: name + avatar + edit -->
                <div class="relative z-10 flex items-end justify-between">
                  <div>
                    <p class="text-[9px] font-mono uppercase tracking-widest mb-0.5" [ngClass]="cardLabelClass()">Member</p>
                    <p class="font-black text-sm uppercase tracking-wider leading-none" [ngClass]="cardNameClass()">
                      {{ userName() }}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full overflow-hidden border" [ngClass]="avatarBorderClass()">
                      @if (userPhotoUrl()) {
                        <img [src]="userPhotoUrl()" alt="Profile" class="w-full h-full object-cover">
                      } @else {
                        <div class="w-full h-full flex items-center justify-center" [ngClass]="avatarBgClass()">
                          <span class="text-xs font-black" [ngClass]="avatarTextClass()">{{ userInitial() }}</span>
                        </div>
                      }
                    </div>
                    <a routerLink="/my-profile"
                      class="text-[10px] font-mono uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
                      [ngClass]="cardLabelClass()">
                      Edit ›
                    </a>
                  </div>
                </div>

              </div>
            </div>

            <!-- Stats row below card -->
            <div class="mt-4 grid grid-cols-2 gap-3">
              <div class="border border-white/10 rounded-lg p-4">
                <p class="text-2xl font-black text-white leading-none mb-1">
                  {{ loading() ? '—' : upcomingGroups().length }}
                </p>
                <p class="text-[10px] font-mono text-white/35 uppercase tracking-widest">Upcoming</p>
              </div>
              <div class="border border-white/10 rounded-lg p-4">
                <p class="text-2xl font-black text-white/30 leading-none mb-1">
                  {{ loading() ? '—' : pastGroups().length }}
                </p>
                <p class="text-[10px] font-mono text-white/25 uppercase tracking-widest">Past shows</p>
              </div>
            </div>

          </div>

          <!-- ── Right column: shows ────────────────────────────────────────── -->
          <div>

            <!-- Loading -->
            <div *ngIf="loading()" class="flex justify-center py-20">
              <div class="w-8 h-8 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin"></div>
            </div>

            <!-- Error -->
            <div *ngIf="error()" class="border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono p-4 rounded-lg">
              Failed to load your shows. Please try again.
            </div>

            <!-- Empty state -->
            <div *ngIf="!loading() && !error() && eventGroups().length === 0" class="flex flex-col items-center justify-center py-20 text-center">
              <p class="text-4xl mb-4">🎵</p>
              <p class="text-white/40 font-mono text-sm uppercase tracking-widest mb-2">No shows yet</p>
              <p class="text-white/25 text-xs font-mono">Buy your first ticket to get started</p>
            </div>

            <!-- Upcoming shows -->
            <section *ngIf="upcomingGroups().length > 0" class="mb-10">
              <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-5">— upcoming —</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <a *ngFor="let group of upcomingGroups()"
                  [routerLink]="['/my-shows', group.event.id]"
                  class="block border border-white/10 hover:border-white/30 transition-all cursor-pointer bg-white/5 hover:bg-white/[0.08] group rounded-lg overflow-hidden">
                  <div class="aspect-square overflow-hidden bg-white/5">
                    <img *ngIf="group.event.poster_url" [src]="group.event.poster_url" [alt]="group.event.title"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                    <div *ngIf="!group.event.poster_url" class="w-full h-full flex items-center justify-center"
                      style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                      <span class="text-white/10 font-black text-xl uppercase tracking-widest">GIG</span>
                    </div>
                  </div>
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
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <a *ngFor="let group of pastGroups()"
                  [routerLink]="['/my-shows', group.event.id]"
                  class="block border border-white/5 hover:border-white/15 transition-all cursor-pointer opacity-50 hover:opacity-75 group rounded-lg overflow-hidden">
                  <div class="aspect-square overflow-hidden bg-white/5">
                    <img *ngIf="group.event.poster_url" [src]="group.event.poster_url" [alt]="group.event.title"
                      class="w-full h-full object-cover grayscale">
                    <div *ngIf="!group.event.poster_url" class="w-full h-full flex items-center justify-center"
                      style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                      <span class="text-white/10 font-black text-xl uppercase tracking-widest">GIG</span>
                    </div>
                  </div>
                  <div class="p-3">
                    <p class="text-xs font-mono text-white/20 uppercase tracking-widest mb-1">{{ formatDate(group.event.date_and_time) }}</p>
                    <p class="font-semibold text-white/60 leading-tight text-sm line-clamp-2">{{ group.event.title }}</p>
                    <p class="text-xs text-white/20 mt-1.5">{{ group.tickets.length }} ticket{{ group.tickets.length !== 1 ? 's' : '' }}</p>
                  </div>
                </a>
              </div>
            </section>

          </div>
        </div>
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

  currentUser = signal<AudienceUser | null>(null);

  userInitial = () => {
    const u = this.currentUser();
    return (u?.first_name?.[0] || u?.email_address?.[0] || 'A').toUpperCase();
  };
  userName = () => {
    const u = this.currentUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.email_address || 'Guest');
  };
  userEmail = () => this.currentUser()?.email_address || '';
  userPhotoUrl = () => this.currentUser()?.profile_photo_url || null;
  membershipTier = () => this.currentUser()?.membership_tier || 'silver';

  formattedMembershipId = () => {
    const id = this.currentUser()?.membership_id;
    if (!id) return '•••• •••• ••••';
    return `${id.slice(0, 4)} ${id.slice(4, 8)} ${id.slice(8, 12)}`;
  };

  // ── Tier-based card styling ────────────────────────────────────────────────
  private tier = () => this.membershipTier();

  cardBgClass = () => ({
    silver: 'bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-xl shadow-black/50',
    gold:   'bg-gradient-to-br from-zinc-900 via-zinc-800 to-black shadow-xl shadow-black/60',
    platinum: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black shadow-xl shadow-black/60',
  }[this.tier()] ?? 'bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-xl shadow-black/50');

  cardShimmerClass = () => ({
    silver:   'bg-gradient-to-tr from-white/5 via-white/10 to-transparent',
    gold:     'bg-gradient-to-tr from-yellow-400/5 via-yellow-300/10 to-transparent',
    platinum: 'bg-gradient-to-tr from-blue-200/5 via-blue-100/10 to-transparent',
  }[this.tier()] ?? 'bg-gradient-to-tr from-white/5 via-white/10 to-transparent');

  tierLabelClass = () => ({
    silver:   'text-zinc-300',
    gold:     'text-yellow-400',
    platinum: 'text-blue-200',
  }[this.tier()] ?? 'text-zinc-300');

  chipClass = () => ({
    silver:   'border-zinc-400/50 bg-zinc-500/20',
    gold:     'border-yellow-500/50 bg-yellow-400/10',
    platinum: 'border-blue-300/40 bg-blue-200/10',
  }[this.tier()] ?? 'border-zinc-400/50 bg-zinc-500/20');

  chipLineClass = () => ({
    silver:   'bg-zinc-400',
    gold:     'bg-yellow-400',
    platinum: 'bg-blue-200',
  }[this.tier()] ?? 'bg-zinc-400');

  cardNumberClass = () => ({
    silver:   'text-white/90',
    gold:     'text-yellow-100/90',
    platinum: 'text-blue-50/90',
  }[this.tier()] ?? 'text-white/90');

  cardLabelClass = () => ({
    silver:   'text-zinc-400',
    gold:     'text-yellow-600',
    platinum: 'text-blue-300/70',
  }[this.tier()] ?? 'text-zinc-400');

  cardNameClass = () => ({
    silver:   'text-white',
    gold:     'text-yellow-50',
    platinum: 'text-blue-50',
  }[this.tier()] ?? 'text-white');

  avatarBorderClass = () => ({
    silver:   'border-zinc-400/40',
    gold:     'border-yellow-500/40',
    platinum: 'border-blue-300/40',
  }[this.tier()] ?? 'border-zinc-400/40');

  avatarBgClass = () => ({
    silver:   'bg-zinc-500',
    gold:     'bg-yellow-500',
    platinum: 'bg-blue-400',
  }[this.tier()] ?? 'bg-zinc-500');

  avatarTextClass = () => ({
    silver:   'text-white',
    gold:     'text-black',
    platinum: 'text-white',
  }[this.tier()] ?? 'text-white');

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
    const cached = this.audienceAuthService.getUser();
    this.currentUser.set(cached);
    this.emailVerified.set(cached?.email_verified !== false);
    this.loadTickets();
    // Refresh from API to pick up any fields missing from the cached localStorage user
    this.audienceAuthService.getMe().subscribe({
      next: (user) => {
        this.currentUser.set(user);
        this.emailVerified.set(user.email_verified !== false);
      },
      error: () => {} // non-critical, cached data still displayed
    });
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
