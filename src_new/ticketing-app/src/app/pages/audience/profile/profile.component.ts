import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceUser, AudienceEmailPreferences, AudiencePushNotifPreferences } from '../../../services/audience-auth.service';
import { InviteFriendModalComponent } from '../../../components/invite-friend-modal/invite-friend-modal.component';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

interface PrefCategory {
  key: keyof AudienceEmailPreferences;
  label: string;
  description: string;
}

type AccountTab = 'profile' | 'notifications' | 'privacy';

@Component({
  selector: 'app-audience-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InviteFriendModalComponent, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">

      <app-audience-header></app-audience-header>

      <main class="max-w-4xl mx-auto px-4 py-10 pt-20">

        <!-- Page Header -->
        <div class="mb-6 flex items-end justify-between">
          <div>
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— account —</p>
            <h1 class="text-2xl font-black uppercase text-white">Account Settings</h1>
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

        <!-- Mobile tabs (sticky, top) -->
        <div class="sm:hidden sticky top-0 z-10 bg-black border-b border-white/10 -mx-4 px-4 mb-6 flex gap-0">
          @for (tab of tabs; track tab.id) {
            <button type="button"
              (click)="activeTab = tab.id"
              class="px-5 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 -mb-px"
              [class.border-yellow-400]="activeTab === tab.id"
              [class.text-yellow-400]="activeTab === tab.id"
              [class.border-transparent]="activeTab !== tab.id"
              [class.text-white/30]="activeTab !== tab.id">
              {{ tab.label }}
            </button>
          }
        </div>

        <!-- Desktop layout: left nav + content -->
        <div class="sm:flex sm:gap-10 sm:items-start">

          <!-- Desktop sidebar nav -->
          <nav class="hidden sm:flex flex-col gap-0.5 w-44 flex-shrink-0 sticky top-6">
            @for (tab of tabs; track tab.id) {
              <button type="button"
                (click)="activeTab = tab.id"
                class="text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors border-l-2"
                [class.border-yellow-400]="activeTab === tab.id"
                [class.text-yellow-400]="activeTab === tab.id"
                [class.border-transparent]="activeTab !== tab.id"
                [class.text-white/30]="activeTab !== tab.id"
                [class.hover:text-white/60]="activeTab !== tab.id">
                {{ tab.label }}
              </button>
            }
          </nav>

          <!-- Tab content -->
          <div class="flex-1 min-w-0">

        <!-- ─── MY PROFILE TAB ─── -->
        @if (activeTab === 'profile') {

          <!-- Profile Photo -->
          <div class="bg-white/5 border border-white/10 p-6 mb-6">
            <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-4">Profile Photo</p>
            <div class="flex items-center gap-6">
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

          <!-- Personal Info -->
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

          <!-- About You -->
          <div class="bg-white/5 border border-white/10 p-6 mb-6">
            <div class="flex items-start justify-between mb-4">
              <p class="text-xs font-mono text-white/40 uppercase tracking-widest">About You</p>
              @if (!isProfileComplete()) {
                <span class="text-[10px] font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-1 uppercase tracking-wider">
                  +10 pts on completion
                </span>
              } @else {
                <span class="text-[10px] font-mono text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 uppercase tracking-wider">
                  ✓ Profile complete
                </span>
              }
            </div>
            <p class="text-xs font-mono text-white/30 mb-5">Used to recommend events you'll like. Fill in all fields to earn +10 points.</p>

            <div class="space-y-4">

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">City</label>
                  <input [(ngModel)]="city" type="text" name="city"
                    class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20"
                    placeholder="">
                </div>
                <div>
                  <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Country</label>
                  <select [(ngModel)]="country" name="country"
                    class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400">
                    <option value="">Select country</option>
                    @for (c of COUNTRIES; track c.code) {
                      <option [value]="c.code">{{ c.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Date of Birth</label>
                  <input [(ngModel)]="dateOfBirth" type="date" name="date_of_birth"
                    class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400"
                    [max]="today">
                  <p class="text-[10px] font-mono text-white/20 mt-1">Stored securely. Used for age-gating and birthday promos only.</p>
                </div>
                <div>
                  <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Gender Identity</label>
                  <select [(ngModel)]="genderIdentity" name="gender_identity"
                    class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400">
                    <option value="">— select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2">Music Genres <span class="text-white/20 normal-case">(pick all that apply)</span></label>

                @if (musicGenres.length > 0) {
                  <div class="flex flex-wrap gap-2 mb-2">
                    @for (genre of musicGenres; track genre) {
                      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-black text-xs font-mono uppercase tracking-wider">
                        {{ genre }}
                        <button type="button" (click)="toggleGenre(genre)" class="hover:opacity-60 transition-opacity leading-none">&times;</button>
                      </span>
                    }
                  </div>
                }

                <div class="relative">
                  <input
                    [(ngModel)]="genreQuery"
                    (focus)="genreDropdownOpen.set(true)"
                    (blur)="onGenreBlur()"
                    (input)="genreDropdownOpen.set(true)"
                    type="text"
                    name="genre_search"
                    autocomplete="off"
                    placeholder="Search genres…"
                    class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20">

                  @if (genreDropdownOpen() && filteredGenres.length > 0) {
                    <div class="absolute z-20 left-0 right-0 mt-0.5 bg-[#111] border border-white/20 max-h-48 overflow-y-auto">
                      @for (genre of filteredGenres; track genre) {
                        <button type="button"
                          (mousedown)="selectGenre(genre)"
                          class="w-full text-left px-3 py-2 text-xs font-mono text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                          {{ genre }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>

              <div>
                <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">How often do you attend events?</label>
                <select [(ngModel)]="eventFrequency" name="event_frequency"
                  class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400">
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="rarely">Rarely</option>
                </select>
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

        }

        <!-- ─── NOTIFICATIONS TAB ─── -->
        @if (activeTab === 'notifications') {

          <!-- Push Notification Settings -->
          <div class="bg-white/5 border border-white/10 mb-8">
            <p class="text-xs font-mono text-white/40 uppercase tracking-widest px-6 pt-5 pb-4">Push Notifications</p>

            @if (pushLoading()) {
              <div class="flex items-center justify-center py-10">
                <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            } @else {

            <div class="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">Connection requests</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">When someone sends you a connection request or accepts yours.</p>
              </div>
              <button type="button" (click)="togglePushPref('connection_requests')"
                [disabled]="pushSaving()"
                class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                [class]="pushPrefs().connection_requests ? 'bg-yellow-400' : 'bg-white/20'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                  [class.translate-x-5]="pushPrefs().connection_requests"></span>
              </button>
            </div>
            <div class="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">New events</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">When organizers you follow post a new event.</p>
              </div>
              <button type="button" (click)="togglePushPref('new_events')"
                [disabled]="pushSaving()"
                class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                [class]="pushPrefs().new_events ? 'bg-yellow-400' : 'bg-white/20'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                  [class.translate-x-5]="pushPrefs().new_events"></span>
              </button>
            </div>
            <div class="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">Points & rewards</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">When you earn points or unlock a new tier.</p>
              </div>
              <button type="button" (click)="togglePushPref('points_rewards')"
                [disabled]="pushSaving()"
                class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                [class]="pushPrefs().points_rewards ? 'bg-yellow-400' : 'bg-white/20'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                  [class.translate-x-5]="pushPrefs().points_rewards"></span>
              </button>
            </div>

            @if (pushSaveError()) {
              <div class="border-t border-white/10 px-6 py-3">
                <p class="text-xs font-mono text-red-400">{{ pushSaveError() }}</p>
              </div>
            }
            @if (pushSaveSuccess()) {
              <div class="border-t border-white/10 px-6 py-3">
                <p class="text-xs font-mono text-green-400">Preferences saved.</p>
              </div>
            }

            }
          </div>

          <!-- Email Preferences -->
          <div>
            <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">Email Preferences</p>
            <p class="text-xs font-mono text-white/20 mb-4">Control which emails you receive from us.</p>

            @if (prefLoading()) {
              <div class="flex items-center justify-center py-10">
                <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            } @else {

              <div class="bg-white/5 border border-white/10 mb-4">
                @for (cat of prefCategories; track cat.key; let last = $last) {
                  <div class="flex items-center justify-between px-6 py-4"
                    [class.border-b]="!last"
                    [class.border-white/10]="!last">
                    <div class="flex-1 min-w-0 pr-6">
                      <p class="text-sm font-black text-white uppercase">{{ cat.label }}</p>
                      <p class="text-xs font-mono text-white/40 mt-0.5">{{ cat.description }}</p>
                    </div>
                    <button type="button" (click)="togglePref(cat.key)"
                      [disabled]="prefSaving()"
                      class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                      [class]="prefs()[cat.key] ? 'bg-yellow-400' : 'bg-white/20'">
                      <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                        [class.translate-x-5]="prefs()[cat.key]">
                      </span>
                    </button>
                  </div>
                }
              </div>

              <div class="bg-white/5 border border-white/10">
                <div class="flex items-center justify-between px-6 py-4">
                  <div class="flex-1 min-w-0 pr-6">
                    <p class="text-sm font-black text-white uppercase">Account &amp; Security</p>
                    <p class="text-xs font-mono text-white/40 mt-0.5">Ticket confirmations, password resets, and email verification. Always sent.</p>
                  </div>
                  <div class="flex-shrink-0 w-11 h-6 rounded-full bg-white/10 relative">
                    <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white/30 rounded-full translate-x-5"></span>
                  </div>
                </div>
              </div>

              @if (prefSaveError()) {
                <div class="border border-red-500/30 bg-red-500/10 px-4 py-3 mt-4">
                  <p class="text-xs font-mono text-red-400">{{ prefSaveError() }}</p>
                </div>
              }
              @if (prefSaveSuccess()) {
                <div class="border border-green-500/30 bg-green-500/10 px-4 py-3 mt-4">
                  <p class="text-xs font-mono text-green-400">Preferences saved.</p>
                </div>
              }

            }
          </div>

        }

        <!-- ─── PRIVACY TAB ─── -->
        @if (activeTab === 'privacy') {

          <p class="text-xs font-mono text-white/20 mb-4">Enabling either setting will allow other users to see your full name.</p>

          <div class="bg-white/5 border border-white/10">
            <div class="flex items-center justify-between px-6 py-4">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">Allow users to view my full profile</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">Anyone can visit your public profile page.</p>
              </div>
              <button type="button" (click)="togglePrivacy('is_public')"
                [disabled]="privacySaving()"
                class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                [class]="privacyForm.is_public ? 'bg-yellow-400' : 'bg-white/20'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                  [class.translate-x-5]="privacyForm.is_public">
                </span>
              </button>
            </div>
            <div class="flex items-center justify-between px-6 py-4 border-t border-white/10">
              <div class="flex-1 min-w-0 pr-6">
                <p class="text-sm font-black text-white uppercase">Allow users to discover me and send connection requests</p>
                <p class="text-xs font-mono text-white/40 mt-0.5">You'll appear in search results and other users can send you connection requests.</p>
              </div>
              <button type="button" (click)="togglePrivacy('social_discoverable')"
                [disabled]="privacySaving()"
                class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                [class]="privacyForm.social_discoverable ? 'bg-yellow-400' : 'bg-white/20'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform"
                  [class.translate-x-5]="privacyForm.social_discoverable">
                </span>
              </button>
            </div>
          </div>

          @if (privacySaveError()) {
            <div class="border border-red-500/30 bg-red-500/10 px-4 py-3 mt-4">
              <p class="text-xs font-mono text-red-400">{{ privacySaveError() }}</p>
            </div>
          }
          @if (privacySaveSuccess()) {
            <div class="border border-green-500/30 bg-green-500/10 px-4 py-3 mt-4">
              <p class="text-xs font-mono text-green-400">Privacy settings saved.</p>
            </div>
          }

        }

          </div><!-- /tab content -->
        </div><!-- /desktop flex -->

        @if (inviteModalOpen()) {
          <app-invite-friend-modal
            [referralCode]="user()?.referral_code || ''"
            (close)="inviteModalOpen.set(false)">
          </app-invite-friend-modal>
        }

      </main>
    </div>
  `
})
export class AudienceProfileComponent implements OnInit {
  user = signal<AudienceUser | null>(null);

  // Tab state
  activeTab: AccountTab = 'profile';
  readonly tabs: { id: AccountTab; label: string }[] = [
    { id: 'profile', label: 'My Profile' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'privacy', label: 'Privacy' },
  ];

  firstName = '';
  lastName = '';
  contactNumber = '';

  // Extended profile fields
  city = '';
  country = '';
  dateOfBirth = '';
  genderIdentity = '';
  musicGenres: string[] = [];
  eventFrequency = '';

  readonly GENRES = [
    // Electronic / Dance
    'Ambient', 'Bass Music', 'Breakbeat', 'Chillout', 'Chillwave', 'Dance / EDM',
    'Deep House', 'Disco', 'Drum & Bass', 'Dubstep', 'EBM', 'Electro',
    'Experimental Electronic', 'Footwork', 'Future Bass', 'Garage', 'House',
    'Hyperpop', 'IDM', 'Industrial', 'Jersey Club', 'Jungle', 'Lo-Fi',
    'Melodic Techno', 'Minimal', 'Nu-Disco', 'Psytrance', 'Tech House',
    'Techno', 'Trance', 'UK Garage', 'Vaporwave',
    // Hip-Hop / Urban
    'Afrobeats', 'Afropop', 'Amapiano', 'Drill', 'Grime', 'Hip-Hop / Rap',
    'R&B / Soul', 'Trap',
    // Rock / Alternative
    'Alternative Rock', 'Classic Rock', 'Darkwave', 'Emo', 'Grunge', 'Hardcore',
    'Indie Rock', 'Math Rock', 'Metal', 'New Wave', 'Noise Rock', 'Post-Metal',
    'Post-Punk', 'Post-Rock', 'Prog Rock', 'Psychedelic Rock', 'Punk', 'Rock', 'Nu Metal',
    'Shoegaze', 'Stoner Rock',
    // Pop
    'Bedroom Pop', 'Dream Pop', 'Indie Pop', 'K-Pop', 'OPM', 'Pop', 'Synth-Pop',
    // Jazz / Blues / Soul
    'Blues', 'Classical', 'Contemporary Jazz', 'Jazz', 'Neo-Soul',
    // World / Roots
    'Americana', 'Bluegrass', 'Bossa Nova', 'Country', 'Cumbia', 'Dancehall',
    'Dub', 'Flamenco', 'Folk / Acoustic', 'Funk', 'Gospel', 'Latin', 'Reggae',
    'Reggaeton', 'Singer-Songwriter', 'Ska', 'Soca', 'Zouk',
    // Other
    'Acoustic', 'Musical Theatre', 'Spoken Word', 'World Music',
  ].sort();

  genreQuery = '';
  genreDropdownOpen = signal(false);

  get filteredGenres(): string[] {
    const q = this.genreQuery.toLowerCase().trim();
    if (!q) return this.GENRES.filter(g => !this.musicGenres.includes(g));
    return this.GENRES.filter(g => g.toLowerCase().includes(q) && !this.musicGenres.includes(g));
  }

  readonly COUNTRIES = [
    { code: 'PH', name: 'Philippines' }, { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' }, { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' }, { code: 'SG', name: 'Singapore' },
    { code: 'MY', name: 'Malaysia' }, { code: 'ID', name: 'Indonesia' },
    { code: 'TH', name: 'Thailand' }, { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' }, { code: 'NZ', name: 'New Zealand' },
    { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
    { code: 'AE', name: 'United Arab Emirates' },
  ];

  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  photoFile = signal<File | null>(null);
  photoPreview = signal<string | null>(null);
  uploadingPhoto = signal(false);
  photoError = signal('');
  photoSuccess = signal(false);

  inviteModalOpen = signal(false);

  // Push notification preferences state
  pushLoading = signal(true);
  pushSaving = signal(false);
  pushSaveError = signal('');
  pushSaveSuccess = signal(false);
  pushPrefs = signal<AudiencePushNotifPreferences>({
    connection_requests: true,
    new_events: true,
    points_rewards: true,
  });

  // Email preferences state
  prefLoading = signal(true);
  prefSaving = signal(false);
  prefSaveError = signal('');
  prefSaveSuccess = signal(false);
  prefs = signal<AudienceEmailPreferences>({
    marketing_promos: true,
    event_recommendations: true,
    organizer_updates: true,
    points_rewards: true,
    connection_emails: true,
  });
  readonly prefCategories: PrefCategory[] = [
    { key: 'connection_emails', label: 'Connections', description: 'Emails when someone sends you a connection request or accepts yours.' },
    { key: 'marketing_promos', label: 'Promotions & Offers', description: 'Targeted deals, discounts, and early-bird ticket offers.' },
    { key: 'event_recommendations', label: 'Event Recommendations', description: "Events we think you'll like based on your profile." },
    { key: 'organizer_updates', label: 'Organizer Updates', description: 'News and announcements from organizers you follow.' },
    { key: 'points_rewards', label: 'Points & Rewards', description: 'Points earned, tier upgrades, and rewards notifications.' },
  ];

  // Privacy state
  privacyForm = {
    is_public: false,
    social_discoverable: false,
  };
  privacySaving = signal(false);
  privacySaveError = signal('');
  privacySaveSuccess = signal(false);

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
    this.city = u.city || '';
    this.country = u.country || '';
    this.dateOfBirth = u.date_of_birth ? u.date_of_birth.substring(0, 10) : '';
    this.genderIdentity = u.gender_identity || '';
    this.musicGenres = u.music_genres ? [...u.music_genres] : [];
    this.eventFrequency = u.event_frequency || '';
    this.audienceAuthService.getMe().subscribe({
      next: (freshUser) => {
        this.user.set(freshUser);
        this.privacyForm.is_public = freshUser.is_public ?? false;
        this.privacyForm.social_discoverable = freshUser.social_discoverable ?? false;
      },
      error: () => {
        this.privacyForm.is_public = u.is_public ?? false;
        this.privacyForm.social_discoverable = u.social_discoverable ?? false;
      },
    });

    this.audienceAuthService.getEmailPreferences().subscribe({
      next: (p) => { this.prefs.set(p); this.prefLoading.set(false); },
      error: () => this.prefLoading.set(false),
    });

    this.audienceAuthService.getPushNotifPreferences().subscribe({
      next: (p) => { this.pushPrefs.set(p); this.pushLoading.set(false); },
      error: () => this.pushLoading.set(false),
    });
  }

  readonly today = new Date().toISOString().substring(0, 10);

  toggleGenre(genre: string): void {
    const idx = this.musicGenres.indexOf(genre);
    if (idx === -1) {
      this.musicGenres = [...this.musicGenres, genre];
    } else {
      this.musicGenres = this.musicGenres.filter(g => g !== genre);
    }
  }

  selectGenre(genre: string): void {
    if (!this.musicGenres.includes(genre)) {
      this.musicGenres = [...this.musicGenres, genre];
    }
    this.genreQuery = '';
    this.genreDropdownOpen.set(false);
  }

  onGenreBlur(): void {
    setTimeout(() => this.genreDropdownOpen.set(false), 150);
  }

  isProfileComplete(): boolean {
    return !!(this.city.trim() && this.country && this.dateOfBirth && this.genderIdentity && this.musicGenres.length > 0 && this.eventFrequency);
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
      city: this.city.trim() || null,
      country: this.country || null,
      date_of_birth: this.dateOfBirth || null,
      gender_identity: this.genderIdentity || null,
      music_genres: this.musicGenres.length > 0 ? this.musicGenres : null,
      event_frequency: this.eventFrequency || null,
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

  // Email preferences
  togglePref(key: keyof AudienceEmailPreferences): void {
    const current = this.prefs();
    const newValue = !current[key];
    const updated = { ...current, [key]: newValue };
    this.prefs.set(updated);
    this.prefSaving.set(true);
    this.prefSaveError.set('');
    this.prefSaveSuccess.set(false);

    this.audienceAuthService.updateEmailPreferences({ [key]: newValue }).subscribe({
      next: (p) => {
        this.prefs.set(p);
        this.prefSaving.set(false);
        this.prefSaveSuccess.set(true);
        setTimeout(() => this.prefSaveSuccess.set(false), 2000);
      },
      error: () => {
        this.prefs.set(current);
        this.prefSaving.set(false);
        this.prefSaveError.set('Failed to save. Please try again.');
      },
    });
  }

  // Push notification preferences
  togglePushPref(key: keyof AudiencePushNotifPreferences): void {
    const current = this.pushPrefs();
    const newValue = !current[key];
    const updated = { ...current, [key]: newValue };
    this.pushPrefs.set(updated);
    this.pushSaving.set(true);
    this.pushSaveError.set('');
    this.pushSaveSuccess.set(false);

    this.audienceAuthService.updatePushNotifPreferences({ [key]: newValue }).subscribe({
      next: (p) => {
        this.pushPrefs.set(p);
        this.pushSaving.set(false);
        this.pushSaveSuccess.set(true);
        setTimeout(() => this.pushSaveSuccess.set(false), 2000);
      },
      error: () => {
        this.pushPrefs.set(current);
        this.pushSaving.set(false);
        this.pushSaveError.set('Failed to save. Please try again.');
      },
    });
  }

  // Privacy
  togglePrivacy(key: 'is_public' | 'social_discoverable'): void {
    const previous = { ...this.privacyForm };
    this.privacyForm[key] = !this.privacyForm[key];
    this.privacySaving.set(true);
    this.privacySaveError.set('');
    this.privacySaveSuccess.set(false);

    this.audienceAuthService.updatePrivacy({ [key]: this.privacyForm[key] }).subscribe({
      next: (updatedUser) => {
        this.user.set(updatedUser);
        this.privacySaving.set(false);
        this.privacySaveSuccess.set(true);
        setTimeout(() => this.privacySaveSuccess.set(false), 2000);
      },
      error: () => {
        this.privacyForm[key] = previous[key];
        this.privacySaving.set(false);
        this.privacySaveError.set('Failed to save. Please try again.');
      },
    });
  }
}
