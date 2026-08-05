import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AudienceAuthService, AudienceUser } from '../../../services/audience-auth.service';

@Component({
  selector: 'app-audience-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black text-white">

      <!-- Header -->
      <header class="fixed top-0 inset-x-0 z-50 bg-black border-b-2 border-white/15">
        <div class="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <div class="flex items-center gap-4">
            <a routerLink="/my-shows" class="text-white/40 hover:text-white transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </a>
            <a routerLink="/"><img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6"></a>
          </div>
          <span class="text-white/30 text-xs font-mono uppercase tracking-widest">Edit Profile</span>
        </div>
      </header>

      <main class="max-w-2xl mx-auto px-4 py-10 pt-20">

        <div class="mb-8 flex items-end justify-between">
          <div>
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— account —</p>
            <h1 class="text-2xl font-black uppercase text-white">Edit Profile</h1>
          </div>
          @if (user()?.membership_id) {
            <div class="text-right">
              <p class="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-0.5">
                {{ (user()?.membership_tier || 'silver') | uppercase }} member
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
