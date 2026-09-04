import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceUser } from '../../../services/audience-auth.service';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

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
  imports: [CommonModule, RouterLink, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">

      <app-audience-header></app-audience-header>

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

                <!-- Bottom row: name + avatar -->
                <div class="relative z-10 flex items-end justify-between">
                  <div>
                    <p class="text-[9px] font-mono uppercase tracking-widest mb-0.5" [ngClass]="cardLabelClass()">Member</p>
                    <p class="font-black text-sm uppercase tracking-wider leading-none" [ngClass]="cardNameClass()">
                      {{ userName() }}
                    </p>
                  </div>
                  <div class="w-9 h-9 rounded-full overflow-hidden border" [ngClass]="avatarBorderClass()">
                    @if (userPhotoUrl()) {
                      <img [src]="userPhotoUrl()" alt="Profile" class="w-full h-full object-cover">
                    } @else {
                      <div class="w-full h-full flex items-center justify-center" [ngClass]="avatarBgClass()">
                        <span class="text-xs font-black" [ngClass]="avatarTextClass()">{{ userInitial() }}</span>
                      </div>
                    }
                  </div>
                </div>

              </div>
            </div>

            <!-- Edit profile link -->
            <a routerLink="/my-profile"
              class="mt-3 flex items-center justify-end gap-1 text-[10px] font-mono text-white/30 hover:text-white/70 uppercase tracking-widest transition-colors">
              Edit profile ›
            </a>

            <!-- Stats row below card -->
            <div class="mt-2 grid grid-cols-3 gap-3">
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
              <div class="border border-white/10 rounded-lg p-4">
                <p class="text-2xl font-black leading-none mb-1" [ngClass]="pointsTextClass()">
                  {{ currentUser()?.points_total ?? 0 }}
                </p>
                <p class="text-[10px] font-mono uppercase tracking-widest" [ngClass]="pointsLabelClass()">
                  {{ currentUser()?.card_level ?? 'Silver' }}
                </p>
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
  userPhotoUrl = () => this.currentUser()?.profile_photo_url || null;

  membershipTier = () => (this.currentUser()?.card_level ?? 'Silver').toLowerCase();

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

  private cardLevel = () => (this.currentUser()?.card_level ?? 'Silver').toLowerCase();

  pointsTextClass = () => ({
    silver:   'text-slate-300',
    gold:     'text-yellow-400',
    platinum: 'text-cyan-300',
  }[this.cardLevel()] ?? 'text-slate-300');

  pointsLabelClass = () => ({
    silver:   'text-slate-300/60',
    gold:     'text-yellow-400/60',
    platinum: 'text-cyan-300/60',
  }[this.cardLevel()] ?? 'text-slate-300/60');

  constructor(private audienceAuthService: AudienceAuthService) {}

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

}
