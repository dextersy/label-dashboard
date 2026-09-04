import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService } from '../../services/audience-auth.service';
import { InviteFriendModalComponent } from '../invite-friend-modal/invite-friend-modal.component';

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
          @if (isLoggedIn()) {
            <!-- Invite pill (desktop) -->
            <button type="button" (click)="inviteModalOpen.set(true)"
              class="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-[10px] font-mono text-white/50 uppercase tracking-wider hover:border-yellow-400/50 hover:text-yellow-400 transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Invite
            </button>

            <!-- Avatar button + dropdown -->
            <div class="relative">
              <button type="button" (click)="menuOpen.set(!menuOpen())"
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
                  <button type="button" (click)="inviteModalOpen.set(true); menuOpen.set(false)"
                    class="w-full flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors">
                    Invite a Friend
                  </button>
                  <button type="button" (click)="logout()"
                    class="w-full flex items-center px-4 py-2.5 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 uppercase tracking-wider transition-colors border-t border-white/10">
                    Log out
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login"
              class="text-white/50 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors">Log In</a>
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
export class AudienceHeaderComponent {
  menuOpen = signal(false);
  inviteModalOpen = signal(false);

  constructor(
    private audienceAuthService: AudienceAuthService,
    private router: Router
  ) {}

  isLoggedIn(): boolean {
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

  logout(): void {
    this.audienceAuthService.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.relative')) {
      this.menuOpen.set(false);
    }
  }
}
