import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { OrganizationService } from '../../services/organization.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— organization —</p>
        <h1 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Settings</h1>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
        </div>
      } @else {
        <!-- Profile Card -->
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">
          <div class="bg-white border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Organization Profile</h2>
            </div>
            <div class="px-6 py-5 space-y-5">
              <!-- Org Name -->
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
                  Organization Name <span class="text-red-400">*</span>
                </label>
                <input formControlName="name" type="text"
                  class="w-full px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400"
                  placeholder="Your organization name">
                @if (form.get('name')?.invalid && form.get('name')?.touched) {
                  <p class="mt-1 text-xs font-mono text-red-500">Organization name is required.</p>
                }
              </div>

              <!-- Website -->
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Website</label>
                <input formControlName="brand_website" type="url"
                  class="w-full px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400"
                  placeholder="https://yourwebsite.com">
                @if (form.get('brand_website')?.invalid && form.get('brand_website')?.touched) {
                  <p class="mt-1 text-xs font-mono text-red-500">Enter a valid URL (must start with http:// or https://).</p>
                }
              </div>

              <!-- Brand Color -->
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Brand Color</label>
                <p class="text-xs font-mono text-gray-400 mb-2">Used on your public event pages and ticket confirmations.</p>
                <div class="flex items-center gap-3">
                  <input formControlName="brand_color" type="color"
                    class="w-10 h-10 border border-gray-300 cursor-pointer p-0.5 bg-white">
                  <input formControlName="brand_color" type="text"
                    class="w-32 px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400 uppercase"
                    placeholder="#000000" maxlength="7">
                </div>
              </div>
            </div>
          </div>

          <!-- Save feedback -->
          @if (saveError()) {
            <div class="px-4 py-3 border border-red-200 bg-red-50">
              <p class="text-xs font-mono text-red-600">{{ saveError() }}</p>
            </div>
          }
          @if (saveSuccess()) {
            <div class="px-4 py-3 border border-green-200 bg-green-50">
              <p class="text-xs font-mono text-green-700">Settings saved successfully.</p>
            </div>
          }

          <div class="flex justify-end">
            <button type="submit" [disabled]="saving() || form.invalid"
              class="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider transition-colors">
              {{ saving() ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>

        <!-- Logo Card (separate from main form) -->
        <div class="bg-white border border-gray-200 mt-6">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Organization Logo</h2>
          </div>
          <div class="px-6 py-5">
            <p class="text-xs font-mono text-gray-400 mb-4">Displayed on your public event pages and ticket emails.</p>

            <!-- Current logo preview -->
            <div class="mb-4">
              @if (logoUrl()) {
                <div class="inline-block border border-gray-200 p-3 bg-gray-50">
                  <img [src]="logoUrl()" alt="Organization logo" class="h-16 object-contain">
                </div>
              } @else {
                <div class="inline-flex items-center justify-center w-28 h-16 border border-dashed border-gray-300 bg-gray-50">
                  <p class="text-xs font-mono text-gray-400">No logo</p>
                </div>
              }
            </div>

            <!-- Upload -->
            <div class="flex items-center gap-4">
              <label class="cursor-pointer">
                <span class="px-4 py-2 border border-gray-300 text-xs font-mono text-gray-600 hover:border-gray-500 hover:text-gray-900 uppercase tracking-wider transition-colors inline-block">
                  {{ uploadingLogo() ? 'Uploading...' : 'Choose File' }}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden" (change)="onLogoSelected($event)" [disabled]="uploadingLogo()">
              </label>
              @if (pendingLogoFile()) {
                <div class="flex items-center gap-3">
                  <span class="text-xs font-mono text-gray-500 truncate max-w-40">{{ pendingLogoFile()!.name }}</span>
                  <button type="button" (click)="uploadLogo()"
                    [disabled]="uploadingLogo()"
                    class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider transition-colors">
                    Upload
                  </button>
                  <button type="button" (click)="clearLogoSelection()"
                    class="text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors">
                    Cancel
                  </button>
                </div>
              }
            </div>
            <p class="mt-2 text-xs font-mono text-gray-400">PNG, JPG, SVG or WebP. Max 5MB.</p>

            @if (logoError()) {
              <p class="mt-2 text-xs font-mono text-red-500">{{ logoError() }}</p>
            }
            @if (logoSuccess()) {
              <p class="mt-2 text-xs font-mono text-green-600">Logo updated successfully.</p>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsComponent implements OnInit {
  form!: FormGroup;

  loading = signal(true);
  saving = signal(false);
  saveSuccess = signal(false);
  saveError = signal<string | null>(null);

  logoUrl = signal<string | null>(null);
  pendingLogoFile = signal<File | null>(null);
  uploadingLogo = signal(false);
  logoSuccess = signal(false);
  logoError = signal<string | null>(null);

  private brandId!: number;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private orgService: OrganizationService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      brand_website: ['', [Validators.pattern(/^https?:\/\/.+/)]],
      brand_color: ['#6366f1']
    });

    const user = this.auth.getCurrentUser();
    if (!user?.brand_id) {
      this.loading.set(false);
      return;
    }
    this.brandId = user.brand_id;

    this.orgService.getSettings(this.brandId).subscribe({
      next: (settings) => {
        this.form.patchValue({
          name: settings.name,
          brand_website: settings.brand_website || '',
          brand_color: settings.brand_color || '#6366f1'
        });
        this.logoUrl.set(settings.logo_url || null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);

    const { name, brand_website, brand_color } = this.form.value;

    this.orgService.updateSettings(this.brandId, {
      name,
      brand_color: brand_color || undefined,
      brand_website: brand_website || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.auth.updateUserBrandName(name);
        setTimeout(() => this.saveSuccess.set(false), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.error || 'Failed to save settings. Please try again.');
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.logoError.set('File is too large. Max 5MB.');
      return;
    }
    this.logoError.set(null);
    this.logoSuccess.set(false);
    this.pendingLogoFile.set(file);
    // Reset input so same file can be re-selected
    input.value = '';
  }

  uploadLogo(): void {
    const file = this.pendingLogoFile();
    if (!file || this.uploadingLogo()) return;
    this.uploadingLogo.set(true);
    this.logoError.set(null);
    this.logoSuccess.set(false);

    this.orgService.uploadLogo(this.brandId, file).subscribe({
      next: (res) => {
        this.logoUrl.set(res.logo_url);
        this.pendingLogoFile.set(null);
        this.uploadingLogo.set(false);
        this.logoSuccess.set(true);
        setTimeout(() => this.logoSuccess.set(false), 4000);
      },
      error: (err) => {
        this.uploadingLogo.set(false);
        this.logoError.set(err?.error?.error || 'Failed to upload logo. Please try again.');
      }
    });
  }

  clearLogoSelection(): void {
    this.pendingLogoFile.set(null);
    this.logoError.set(null);
  }
}
