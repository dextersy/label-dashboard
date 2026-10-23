import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService } from '../../services/audience-auth.service';
import { AudienceSocialService } from '../../services/audience-social.service';
import { AuthService } from '../../services/auth.service';
import { InviteFriendModalComponent } from '../invite-friend-modal/invite-friend-modal.component';
import { AudienceNotification } from '../../models/audience-notification';

@Component({
  selector: 'app-audience-header',
  standalone: true,
  imports: [CommonModule, RouterLink, InviteFriendModalComponent],
  template: `
    <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">

        <!-- ── Left side ── -->
        <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>

        <!-- ── Right side ── -->
        <div class="flex items-center gap-4">

          <!-- ── Audience user section ── -->
          @if (isAudienceLoggedIn()) {
            <!-- Notifications bell -->
            <div class="relative">
              <button type="button" (click)="toggleNotifPanel()"
                class="relative text-white/40 hover:text-white transition-colors focus:outline-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                @if (unreadNotifCount() > 0) {
                  <span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 rounded-full flex items-center justify-center text-black text-[8px] font-black leading-none">
                    {{ unreadNotifCount() > 9 ? '9+' : unreadNotifCount() }}
                  </span>
                }
              </button>

              @if (notifPanelOpen()) {
                <div class="fixed sm:absolute right-0 sm:right-0 top-12 sm:top-full sm:mt-2 left-0 sm:left-auto w-auto sm:w-80 bg-black border border-white/20 shadow-xl z-50">
                  <!-- Panel header -->
                  <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                    <span class="text-[10px] font-mono text-white/50 uppercase tracking-widest">Notifications</span>
                    @if (unreadNotifCount() > 0) {
                      <button type="button" (click)="markAllRead()"
                        class="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
                        Mark all read
                      </button>
                    }
                  </div>

                  <!-- List -->
                  @if (notifLoading()) {
                    <div class="flex items-center justify-center py-8">
                      <div class="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  } @else if (recentNotifs().length === 0) {
                    <p class="text-xs font-mono text-white/30 text-center py-8">No notifications yet.</p>
                  } @else {
                    <div class="max-h-80 overflow-y-auto">
                      @for (notif of recentNotifs(); track notif.id) {
                        <div
                          class="flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-colors"
                          [class.bg-yellow-400/5]="!notif.is_read"
                          (click)="onNotifClick(notif)">

                          <!-- Actor avatar -->
                          @if (notif.actor?.profile_photo_url) {
                            <img [src]="notif.actor!.profile_photo_url" [alt]="notif.actor!.first_name"
                              class="w-7 h-7 object-cover border border-white/20 flex-shrink-0 mt-0.5">
                          } @else if (notif.actor) {
                            <div class="w-7 h-7 bg-white flex items-center justify-center border border-white/20 flex-shrink-0 mt-0.5">
                              <span class="text-black text-[10px] font-black">{{ notif.actor.first_name.charAt(0).toUpperCase() }}</span>
                            </div>
                          } @else {
                            <div class="w-7 h-7 bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <svg class="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                              </svg>
                            </div>
                          }

                          <div class="flex-1 min-w-0">
                            <p class="text-xs font-mono text-white leading-snug" [class.font-black]="!notif.is_read">
                              {{ notif.title }}
                            </p>
                            @if (notif.message) {
                              <p class="text-[10px] font-mono text-white/40 mt-0.5 truncate">{{ notif.message }}</p>
                            }
                            <p class="text-[10px] font-mono text-white/20 mt-0.5">{{ formatTime(notif.created_at) }}</p>
                          </div>

                          @if (!notif.is_read) {
                            <div class="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mt-1.5"></div>
                          }
                        </div>
                      }
                    </div>
                  }

                  <!-- Footer -->
                  <a routerLink="/my-notifications" (click)="notifPanelOpen.set(false)"
                    class="flex items-center justify-center px-4 py-2.5 text-[10px] font-mono text-white/40 hover:text-white uppercase tracking-widest transition-colors border-t border-white/10">
                    View all notifications
                  </a>
                </div>
              }
            </div>

            <!-- Invite pill (desktop) -->
            <button type="button" (click)="inviteModalOpen.set(true)"
              class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-[10px] font-mono text-white/50 uppercase tracking-wider hover:border-yellow-400/50 hover:text-yellow-400 transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Invite
            </button>

            <!-- Audience avatar + dropdown -->
            <div class="relative">
              <button type="button" (click)="menuOpen.set(!menuOpen()); notifPanelOpen.set(false)"
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
                    Account Settings
                  </a>
                  <a routerLink="/my-connections" (click)="menuOpen.set(false)"
                    class="flex items-center justify-between px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Connections
                    @if (unreadNotifCount() > 0) {
                      <span class="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-black text-[8px] font-black">
                        {{ unreadNotifCount() > 9 ? '9+' : unreadNotifCount() }}
                      </span>
                    }
                  </a>
                  <button type="button" (click)="inviteModalOpen.set(true); menuOpen.set(false)"
                    class="w-full flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Invite a Friend
                  </button>
                  <button type="button" (click)="audienceLogout()"
                    class="w-full flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors border-t border-white/10">
                    Log out
                  </button>
                </div>
              }
            </div>
          }

          <!-- ── Organizer user section ── -->
          @if (isOrganizerLoggedIn()) {
            <a routerLink="/app/dashboard"
              class="hidden sm:block text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors">
              Go to organizer portal
            </a>
            <div class="relative">
              <button type="button" (click)="orgMenuOpen.set(!orgMenuOpen())"
                class="w-7 h-7 bg-yellow-400 flex items-center justify-center flex-shrink-0 focus:outline-none">
                <span class="text-black text-xs font-black">{{ orgInitial() }}</span>
              </button>
              @if (orgMenuOpen()) {
                <div class="absolute right-0 top-full mt-2 w-44 bg-black border border-white/20 shadow-xl z-50">
                  <div class="px-4 py-3 border-b border-white/10">
                    <p class="text-xs font-mono text-white truncate">{{ orgName() }}</p>
                    @if (orgBrandName()) {
                      <p class="text-xs font-mono text-white/40 truncate">{{ orgBrandName() }}</p>
                    }
                  </div>
                  <a routerLink="/app/dashboard" (click)="orgMenuOpen.set(false)"
                    class="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Organizer portal
                  </a>
                  <button type="button" (click)="orgLogout()"
                    class="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors border-t border-white/10">
                    Log out
                  </button>
                </div>
              }
            </div>
          }

          <!-- ── Logged-out CTAs ── -->
          @if (!isAudienceLoggedIn() && !isOrganizerLoggedIn()) {
            <a routerLink="/app/login"
              class="text-xs text-white/50 hover:text-white uppercase tracking-wider transition-colors">Sign in</a>
            <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }"
              class="text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-1.5 uppercase tracking-wider transition-colors">
              List a Show
            </a>
          }

        </div>
      </div>
    </header>

    @if (inviteModalOpen()) {
      <app-invite-friend-modal
        [referralCode]="userReferralCode()"
        (close)="inviteModalOpen.set(false)">
      </app-invite-friend-modal>
    }
  `
})
export class AudienceHeaderComponent implements OnInit {
  readonly menuOpen = signal(false);
  readonly orgMenuOpen = signal(false);
  readonly inviteModalOpen = signal(false);
  readonly unreadNotifCount = signal(0);
  readonly notifPanelOpen = signal(false);
  readonly notifLoading = signal(false);
  readonly recentNotifs = signal<AudienceNotification[]>([]);

  constructor(
    private audienceAuthService: AudienceAuthService,
    private audienceSocialService: AudienceSocialService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.audienceAuthService.isLoggedIn()) {
      this.audienceSocialService.getUnreadCount().subscribe({
        next: (res) => this.unreadNotifCount.set(res.unread_count),
        error: () => {},
      });
    }
  }

  // ── Audience auth ────────────────────────────────────────────────────────────

  isAudienceLoggedIn(): boolean {
    return this.audienceAuthService.isLoggedIn();
  }

  userInitial(): string {
    const u = this.audienceAuthService.getUser();
    return (u?.first_name?.[0] || u?.email_address?.[0] || 'A').toUpperCase();
  }

  userName(): string {
    const u = this.audienceAuthService.getUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.email_address || 'Guest');
  }

  userPhotoUrl(): string | null {
    return this.audienceAuthService.getUser()?.profile_photo_url || null;
  }

  userReferralCode(): string {
    return this.audienceAuthService.getUser()?.referral_code || '';
  }

  audienceLogout(): void {
    this.audienceAuthService.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }

  // ── Organizer auth ───────────────────────────────────────────────────────────

  isOrganizerLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  orgInitial(): string {
    const u = this.authService.getCurrentUser();
    return (u?.first_name?.[0] || u?.email_address?.[0] || u?.email?.[0] || 'O').toUpperCase();
  }

  orgName(): string {
    const u = this.authService.getCurrentUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u?.email_address || u?.email || 'Organizer');
  }

  orgBrandName(): string | null {
    return this.authService.getCurrentUser()?.brand_name || null;
  }

  orgLogout(): void {
    this.authService.logout();
    this.orgMenuOpen.set(false);
    this.router.navigate(['/app/login'], { queryParams: { mode: 'organizer', loggedOut: 'true' } });
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  toggleNotifPanel(): void {
    const opening = !this.notifPanelOpen();
    this.notifPanelOpen.set(opening);
    this.menuOpen.set(false);
    if (opening && this.recentNotifs().length === 0) {
      this.loadNotifs();
    }
  }

  private loadNotifs(): void {
    this.notifLoading.set(true);
    this.audienceSocialService.getNotifications(10, 0).subscribe({
      next: (res) => {
        this.recentNotifs.set(res.notifications);
        this.notifLoading.set(false);
      },
      error: () => this.notifLoading.set(false),
    });
  }

  onNotifClick(notif: AudienceNotification): void {
    if (!notif.is_read) {
      notif.is_read = true;
      this.unreadNotifCount.update((c) => Math.max(0, c - 1));
      this.audienceSocialService.markRead(notif.id).subscribe({ error: () => {} });
    }
    if (notif.link) {
      this.notifPanelOpen.set(false);
      this.router.navigateByUrl(notif.link);
    }
  }

  markAllRead(): void {
    this.recentNotifs.update((list) => list.map((n) => ({ ...n, is_read: true })));
    this.unreadNotifCount.set(0);
    this.audienceSocialService.markAllRead().subscribe({ error: () => {} });
  }

  formatTime(iso: string): string {
    const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.relative')) {
      this.menuOpen.set(false);
      this.orgMenuOpen.set(false);
      this.notifPanelOpen.set(false);
    }
  }
}
