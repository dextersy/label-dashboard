import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, BrandSettings } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { BrandService } from '../../../services/brand.service';

@Component({
  selector: 'app-brand-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './brand-settings-tab.component.html'
})
export class BrandSettingsTabComponent implements OnInit {
  loading: boolean = false;
  brandSettings: BrandSettings | null = null;
  brandForm: FormGroup;
  domains: any[] = [];
  newDomainName: string = '';

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private brandService: BrandService
  ) {
    this.brandForm = this.fb.group({
      name: ['', Validators.required],
      brand_website: [''],
      brand_color: ['purple', Validators.required],
      catalog_prefix: [''],
      release_submission_url: [''],
      payment_processing_fee_for_payouts: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadBrandSettings();
  }

  private loadBrandSettings(): void {
    this.loading = true;
    this.adminService.getBrandSettings().subscribe({
      next: (settings) => {
        this.brandSettings = settings;
        this.brandForm.patchValue(settings);
        this.loadDomains();
      },
      error: (error) => {
        this.notificationService.showError('Error loading brand settings');
        this.loading = false;
      }
    });
  }

  private loadDomains(): void {
    this.adminService.getDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading domains');
        this.loading = false;
      }
    });
  }

  saveBrandSettings(): void {
    if (this.brandForm.valid && this.brandSettings) {
      this.loading = true;
      const formData = { ...this.brandSettings, ...this.brandForm.value };
      
      this.adminService.updateBrandSettings(formData).subscribe({
        next: (response) => {
          if (response.brand) {
            this.brandSettings = response.brand;
            this.brandForm.patchValue(response.brand);
            const brandServiceSettings = {
              id: response.brand.id,
              name: response.brand.name,
              logo_url: response.brand.logo_url,
              brand_color: response.brand.brand_color,
              brand_website: response.brand.brand_website,
              favicon_url: response.brand.favicon_url,
              domain: this.brandService.getCurrentBrandSettings()?.domain,
              release_submission_url: response.brand.release_submission_url,
              catalog_prefix: response.brand.catalog_prefix
            };
            this.brandService.updateBrandSettings(brandServiceSettings);
          }
          this.notificationService.showSuccess('Brand settings saved successfully');
          this.loading = false;
        },
        error: (error) => {
          console.error('Error saving brand settings:', error);
          this.notificationService.showError('Error saving brand settings');
          this.loading = false;
        }
      });
    }
  }

  onLogoFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.loading = true;
      this.adminService.uploadBrandLogo(file).subscribe({
        next: (response) => {
          if (this.brandSettings) {
            this.brandSettings.logo_url = response.logo_url;
            const brandServiceSettings = {
              id: this.brandSettings.id,
              name: this.brandSettings.name,
              logo_url: response.logo_url,
              brand_color: this.brandSettings.brand_color,
              brand_website: this.brandSettings.brand_website,
              favicon_url: this.brandSettings.favicon_url,
              domain: this.brandService.getCurrentBrandSettings()?.domain,
              release_submission_url: this.brandSettings.release_submission_url,
              catalog_prefix: this.brandSettings.catalog_prefix
            };
            this.brandService.updateBrandSettings(brandServiceSettings);
          }
          this.notificationService.showSuccess('Logo uploaded successfully');
          this.loading = false;
        },
        error: (error) => {
          this.notificationService.showError('Error uploading logo');
          this.loading = false;
        }
      });
    }
  }

  onFaviconFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.loading = true;
      this.adminService.uploadFavicon(file).subscribe({
        next: (response) => {
          if (this.brandSettings) {
            this.brandSettings.favicon_url = response.favicon_url;
            const brandServiceSettings = {
              id: this.brandSettings.id,
              name: this.brandSettings.name,
              logo_url: this.brandSettings.logo_url,
              brand_color: this.brandSettings.brand_color,
              brand_website: this.brandSettings.brand_website,
              favicon_url: response.favicon_url,
              domain: this.brandService.getCurrentBrandSettings()?.domain,
              release_submission_url: this.brandSettings.release_submission_url,
              catalog_prefix: this.brandSettings.catalog_prefix
            };
            this.brandService.updateBrandSettings(brandServiceSettings);
          }
          this.notificationService.showSuccess('Favicon uploaded successfully');
          this.loading = false;
        },
        error: (error) => {
          this.notificationService.showError('Error uploading favicon');
          this.loading = false;
        }
      });
    }
  }

  addDomain(): void {
    if (this.newDomainName.trim()) {
      this.loading = true;
      this.adminService.addDomain(this.newDomainName.trim()).subscribe({
        next: () => {
          this.newDomainName = '';
          this.loadDomains();
          this.notificationService.showSuccess('Domain added successfully');
        },
        error: (error) => {
          this.notificationService.showError('Error adding domain');
          this.loading = false;
        }
      });
    }
  }

  deleteDomain(domainName: string): void {
    if (confirm(`Are you sure you want to delete domain "${domainName}"?`)) {
      this.adminService.deleteDomain(domainName).subscribe({
        next: () => {
          this.loadDomains();
          this.notificationService.showSuccess('Domain deleted successfully');
        },
        error: (error) => {
          this.notificationService.showError('Error deleting domain');
        }
      });
    }
  }

  verifyDomain(domainName: string): void {
    this.adminService.verifyDomain(domainName).subscribe({
      next: (response) => {
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = response.status;
        }
        this.notificationService.showSuccess('Domain verified successfully!');
      },
      error: (error) => {
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = 'Unverified';
        }
        
        const errorMessage = error.error?.error || 'Domain verification failed';
        this.notificationService.showError(errorMessage);
        
        if (error.error?.hint) {
          console.log('DNS Configuration Hint:', error.error.hint);
        }
      }
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Verified':
        return 'fas fa-check-circle text-success';
      case 'Unverified':
      default:
        return 'fas fa-times-circle text-danger';
    }
  }

  getStatusTooltip(status: string): string {
    switch (status) {
      case 'Verified':
        return 'Domain verified successfully - DNS points to our server';
      case 'Unverified':
      default:
        return 'Domain not verified - Click to verify';
    }
  }
}