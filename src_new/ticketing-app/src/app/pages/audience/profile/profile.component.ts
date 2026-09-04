import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceUser } from '../../../services/audience-auth.service';
import { InviteFriendModalComponent } from '../../../components/invite-friend-modal/invite-friend-modal.component';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

interface FollowedOrganizer {
  id: number;
  name: string;
  logo_url: string | null;
  about_us: string | null;
  brand_color: string;
}

@Component({
  selector: 'app-audience-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InviteFriendModalComponent, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">

      <app-audience-header></app-audience-header>

      <main class="max-w-2xl mx-auto px-4 py-10 pt-20">

        <div class="mb-8 flex items-end justify-between">
          <div>
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— account —</p>
            <h1 class="text-2xl font-black uppercase text-white">Edit Profile</h1>
          </div>
          @if (user()?.membership_id) {
            <div class="text-right">
              <p class="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-0.5">
                {{ (user()?.card_level || 'Silver') | uppercase }} member
              </p>
              <p class="text-xs font-mono text-white/50 tracking-[0.15em]">
                {{ formattedMembershipId() }}
              </p>
            </div>
          }
        </div>

        <!-- Profile Photo -->
        <div class="bg-white/5 border border-white/10 p-6 mb-6">
          <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">Profile Photo</p>
          <div class="flex items-center gap-6">
            <!-- Current avatar -->
            <div class="flex-shrink-0">
              @if (photoPreview() || user()?.profile_photo_url) {
                <img [src]="photoPreview() || user()?.profile_photo_url" alt="Profile photo"
                  class="w-20 h-20 object-cover border-2 border-white/20">
              } @else {
                <div class="w-20 h-20 bg-white flex items-center justify-center border-2 border-white/20">
                  <span class="text-black text-2xl font-black">{{ userInitial() }}</span>
                </div>
              }
            </div>
            <div>
              <label class="block cursor-pointer">
                <span class="inline-block px-4 py-2 border border-white/30 text-xs font-mono text-white/70 uppercase tracking-wider hover:border-white/60 hover:text-white transition-colors">
                  Choose Photo
                </span>
                <input type="file" accept="image/*" class="hidden" (change)="onPhotoSelected($event)">
              </label>
              <p class="text-xs font-mono text-white/30 mt-2">PNG, JPG or WebP, max 5 MB</p>
              @if (photoFile()) {
                <button type="button" (click)="uploadPhoto()" [disabled]="uploadingPhoto()"
                  class="mt-3 px-4 py-2 bg-yellow-400 text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-300 transition-colors disabled:opacity-50">
                  {{ uploadingPhoto() ? 'Uploading...' : 'Upload Photo' }}
                </button>
              }
              @if (photoError()) {
                <p class="text-xs font-mono text-red-400 mt-2">{{ photoError() }}</p>
              }
              @if (photoSuccess()) {
                <p class="text-xs font-mono text-green-400 mt-2">Photo updated!</p>
              }
            </div>
          </div>
        </div>

        <!-- Profile Form -->
        <div class="bg-white/5 border border-white/10 p-6 mb-6">
          <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">Personal Info</p>
          <div class="space-y-4">

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                  First Name <span class="text-red-400">*</span>
                </label>
                <input [(ngModel)]="firstName" type="text" name="first_name"
                  class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20"
                  placeholder="First name">
              </div>
              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                  Last Name <span class="text-red-400">*</span>
                </label>
                <input [(ngModel)]="lastName" type="text" name="last_name"
                  class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20"
                  placeholder="Last name">
              </div>
            </div>

            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Contact Number</label>
              <input [(ngModel)]="contactNumber" type="tel" name="contact_number"
                class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20"
                placeholder="+63 912 345 6789">
            </div>

            <div>
              <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Email Address</label>
              <input [value]="user()?.email_address || ''" type="email" disabled
                class="w-full px-3 py-2.5 bg-white/5 border border-white/10 text-sm font-mono text-white/30 cursor-not-allowed">
              <p class="text-xs font-mono text-white/20 mt-1">Email cannot be changed</p>
            </div>

          </div>
        </div>

        @if (saveError()) {
          <div class="border border-red-500/30 bg-red-500/10 px-4 py-3 mb-4">
            <p class="text-xs font-mono text-red-400">{{ saveError() }}</p>
          </div>
        }
        @if (saveSuccess()) {
          <div class="border border-green-500/30 bg-green-500/10 px-4 py-3 mb-4">
            <p class="text-xs font-mono text-green-400">Profile updated successfully.</p>
          </div>
        }

        <div class="flex items-center gap-4">
          <button type="button" (click)="save()" [disabled]="saving()"
            class="px-6 py-3 bg-yellow-400 text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-300 transition-colors disabled:opacity-50">
            {{ saving() ? 'Saving...' : 'Save Changes' }}
          </button>
          <a routerLink="/my-shows"
            class="px-6 py-3 border border-white/20 text-xs font-mono text-white/60 uppercase tracking-wider hover:border-white/40 hover:text-white transition-colors">
            Cancel
          </a>
        </div>

        <!-- Your Scene Card -->
        @if (user()?.referral_code) {
          <div class="mt-8 pt-8 border-t border-white/10">
            <p class="text-xs font-mono text-white/40 uppercase tracking-[0.2em] mb-4">— your scene card —</p>
            <div class="bg-white/5 border border-white/10 p-5">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <span class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-0.5">Card Level</span>
                  <span class="text-lg font-black uppercase" [class]="cardLevelClass()">{{ user()?.card_level ?? 'Bronze' }}</span>
                </div>
                <div class="text-right">
                  <span class="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-0.5">Points</span>
                  <span class="text-lg font-black text-white">{{ user()?.points_total ?? 0 }} pts</span>
                </div>
              </div>
              <div class="border-t border-white/10 pt-4">
                <p class="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Referral Link</p>
                <div class="flex items-center gap-2">
                  <span class="flex-1 text-xs font-mono text-white/50 truncate">{{ referralLink() }}</span>
                  <button type="button" (click)="copyReferralLink()"
                    class="px-3 py-1.5 border border-white/20 text-[10px] font-mono text-white/60 uppercase tracking-wider hover:border-white/40 hover:text-white transition-colors flex-shrink-0">
                    {{ copySuccess() ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <p class="text-[10px] font-mono text-white/20 mt-1.5">Earn +10 pts when a friend signs up using your link and verifies their email.</p>
              </div>
              <div class="border-t border-white/10 pt-4 mt-4">
                <button type="button" (click)="inviteModalOpen.set(true)"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-white/20 text-xs font-mono text-white/60 uppercase tracking-wider hover:border-yellow-400/50 hover:text-yellow-400 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  Invite a Friend via Email
                </button>
              </div>
            </div>
          </div>
        }

        @if (inviteModalOpen()) {
          <app-invite-friend-modal
            [referralCode]="user()?.referral_code || ''"
            (close)="inviteModalOpen.set(false)">
          </app-invite-friend-modal>
        }

        <!-- Following -->
        <div class="mt-10 pt-8 border-t border-white/10">
          <p class="text-xs font-mono text-white/40 uppercase tracking-[0.2em] mb-4">— following —</p>
          @if (followedOrganizers().length === 0) {
            <p class="text-xs font-mono text-white/30">You're not following any organizers yet.</p>
          } @else {
            <div class="space-y-3">
              @for (org of followedOrganizers(); track org.id) {
                <a [routerLink]="['/organizers', org.id]"
                  class="flex items-center gap-4 border border-white/10 hover:border-yellow-400/40 transition-colors px-4 py-3 group">
                  @if (org.logo_url) {
                    <div class="w-10 h-10 flex items-center justify-center p-1 flex-shrink-0" [style.background-color]="org.brand_color">
                      <img [src]="org.logo_url" [alt]="org.name" class="w-full h-full object-contain">
                    </div>
                  } @else {
                    <div class="w-10 h-10 flex items-center justify-center flex-shrink-0" [style.background-color]="org.brand_color">
                      <span class="text-white/80 text-sm font-black">{{ org.name.charAt(0).toUpperCase() }}</span>
                    </div>
                  }
                  <span class="text-sm font-black text-white uppercase truncate group-hover:text-yellow-400 transition-colors">{{ org.name }}</span>
                  <svg class="w-3.5 h-3.5 text-white/20 group-hover:text-yellow-400/60 flex-shrink-0 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </a>
              }
            </div>
          }
        </div>

      </main>
    </div>
  `
})
export class AudienceProfileComponent implements OnInit {
  user = signal<AudienceUser | null>(null);

  firstName = '';
  lastName = '';
  contactNumber = '';

  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  photoFile = signal<File | null>(null);
  photoPreview = signal<string | null>(null);
  uploadingPhoto = signal(false);
  photoError = signal('');
  photoSuccess = signal(false);

  followedOrganizers = signal<FollowedOrganizer[]>([]);
  copySuccess = signal(false);
  inviteModalOpen = signal(false);

  referralLink(): string {
    const code = this.user()?.referral_code;
    if (!code) return '';
    return `${window.location.origin}/login?ref=${code}`;
  }

  cardLevelClass(): string {
    const level = (this.user()?.card_level ?? 'Silver').toLowerCase();
    const map: Record<string, string> = {
      silver:   'text-slate-300',
      gold:     'text-yellow-400',
      platinum: 'text-cyan-300',
    };
    return map[level] ?? 'text-slate-300';
  }

  copyReferralLink(): void {
    const link = this.referralLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    }).catch(() => {});
  }

  formattedMembershipId(): string {
    const id = this.user()?.membership_id;
    if (!id) return '';
    return `${id.slice(0, 4)} ${id.slice(4, 8)} ${id.slice(8, 12)}`;
  }

  constructor(
    private audienceAuthService: AudienceAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const u = this.audienceAuthService.getUser();
    if (!u) { this.router.navigate(['/login']); return; }
    this.user.set(u);
    this.firstName = u.first_name || '';
    this.lastName = u.last_name || '';
    this.contactNumber = u.contact_number || '';

    this.audienceAuthService.getFollowedOrganizers().subscribe({
      next: (res) => this.followedOrganizers.set(res.followed_organizers),
      error: () => {}
    });
  }

  userInitial(): string {
    const u = this.user();
    return (u?.first_name?.[0] || u?.email_address?.[0] || 'A').toUpperCase();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.photoError.set('File is too large. Maximum size is 5 MB.');
      return;
    }

    this.photoFile.set(file);
    this.photoError.set('');
    this.photoSuccess.set(false);

    const reader = new FileReader();
    reader.onload = (e) => this.photoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  uploadPhoto(): void {
    const file = this.photoFile();
    if (!file) return;

    this.uploadingPhoto.set(true);
    this.photoError.set('');
    this.photoSuccess.set(false);

    this.audienceAuthService.uploadProfilePhoto(file).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.photoFile.set(null);
        this.uploadingPhoto.set(false);
        this.photoSuccess.set(true);
      },
      error: () => {
        this.uploadingPhoto.set(false);
        this.photoError.set('Failed to upload photo. Please try again.');
      }
    });
  }

  save(): void {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.saveError.set('First name and last name are required.');
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    this.audienceAuthService.updateProfile({
      first_name: this.firstName.trim(),
      last_name: this.lastName.trim(),
      contact_number: this.contactNumber.trim() || undefined,
    }).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.saving.set(false);
        this.saveSuccess.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Failed to save changes. Please try again.');
      }
    });
  }
}
