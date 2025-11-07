import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminService, BrandSettings, DomainVerificationState, DomainVerificationEvent, SublabelCreationState } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { BrandService } from '../../../services/brand.service';

@Component({
  selector: 'app-brand-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './brand-settings-tab.component.html',
  styleUrls: ['./brand-settings-tab.component.scss']
})
export class BrandSettingsTabComponent implements OnInit, OnDestroy {
  loading: boolean = false;
  brandSettings: BrandSettings | null = null;
  brandForm: FormGroup;
  domains: any[] = [];
  newDomainName: string = '';
  showPaymongoWalletId: boolean = false;
  domainVerificationState: DomainVerificationState = { inProgress: false, pendingDomain: '', pollCount: 0, maxPollCount: 60 };
  sublabelCreationState: SublabelCreationState = { inProgress: false, pendingName: '', pollCount: 0, maxPollCount: 60 };
  private subscriptions: Subscription[] = [];

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private brandService: BrandService
  ) {
    this.brandForm = this.fb.group({
      name: ['', Validators.required],
      brand_website: [''],
      brand_color: ['#800080', Validators.required],
      catalog_prefix: [''],
      release_submission_url: [''],
      paymongo_wallet_id: [''],
      payment_processing_fee_for_payouts: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadBrandSettings();
    
    // Subscribe to domain verification state
    const verificationStateSubscription = this.adminService.domainVerificationState$.subscribe(
      (state) => {
        this.domainVerificationState = state;
      }
    );
    this.subscriptions.push(verificationStateSubscription);
    
    // Subscribe to sublabel creation state
    const sublabelStateSubscription = this.adminService.sublabelCreationState$.subscribe(
      (state) => {
        this.sublabelCreationState = state;
      }
    );
    this.subscriptions.push(sublabelStateSubscription);
    
    // Subscribe to domain verification completion events
    const verificationCompletionSubscription = this.adminService.domainVerificationCompletion$.subscribe(
      (event: DomainVerificationEvent | null) => {
        if (event) {
          // Refresh the domains list to show the updated status
          this.loadDomains();
          
          // Show completion notification
          switch (event.status) {
            case 'Connected':
              this.notificationService.showSuccess(event.message);
              break;
            case 'No SSL':
              this.notificationService.showWarning(event.message);
              break;
            case 'Unverified':
              this.notificationService.showError(event.message);
              break;
            default:
              this.notificationService.showInfo(event.message);
          }
        }
      }
    );
    this.subscriptions.push(verificationCompletionSubscription);
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

  onHexColorChange(event: any): void {
    const hexValue = event.target.value;
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    
    if (hexPattern.test(hexValue)) {
      this.brandForm.patchValue({ brand_color: hexValue.toLowerCase() });
    }
  }

  togglePaymongoWalletIdVisibility(): void {
    this.showPaymongoWalletId = !this.showPaymongoWalletId;
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
    // Don't start verification if one is already in progress for this domain
    if (this.domainVerificationState.inProgress && this.domainVerificationState.pendingDomain === domainName) {
      return;
    }
    
    // Set domain status to Pending immediately
    const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
    if (domainIndex !== -1) {
      this.domains[domainIndex].status = 'Pending';
    }
    
    this.adminService.verifyDomain(domainName).subscribe({
      next: (response) => {
        console.log('[Domain Verification] API Response:', response);
        
        // Check if this is an async operation
        if (response.status === 'processing') {
          // Start tracking through global service
          this.adminService.startDomainVerificationTracking(domainName);
          
          console.log(`[Domain Verification] Starting async verification for "${domainName}"`);
          
          // Show initial async notification
          this.notificationService.showInfo(
            `Domain verification started! This may take a few minutes. We'll notify you when it's complete.`
          );
          
          return;
        }
        
        // Handle legacy synchronous response (shouldn't happen with new async backend)
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = response.status;
        }
        this.notificationService.showSuccess('Domain verified successfully!');
      },
      error: (error) => {
        console.error('[Domain Verification] Error response:', error);
        
        // Reset domain status on error
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = error.error?.status || 'Unverified';
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
      case 'Connected':
        return 'fas fa-check-circle text-success';
      case 'No SSL':
        return 'fas fa-exclamation-triangle text-warning';
      case 'Pending':
        return 'fas fa-clock text-info';
      case 'Unverified':
      default:
        return 'fas fa-times-circle text-danger';
    }
  }

  getStatusTooltip(status: string): string {
    switch (status) {
      case 'Connected':
        return 'Domain is fully connected - DNS points to our server and SSL certificate is configured';
      case 'No SSL':
        return 'Domain DNS is correct but SSL certificate needs to be updated';
      case 'Pending':
        return 'Domain is being configured - DNS records or SSL certificate are being processed';
      case 'Unverified':
      default:
        return 'Domain not verified - Click to verify DNS configuration';
    }
  }

  shouldShowVerifyButton(status: string): boolean {
    // Hide verify button for Pending status
    return status !== 'Pending';
  }
  
  isDomainVerificationInProgress(domainName: string): boolean {
    return this.domainVerificationState.inProgress && this.domainVerificationState.pendingDomain === domainName;
  }
  
  isAnyPollingInProgress(): boolean {
    return this.domainVerificationState.inProgress || this.sublabelCreationState.inProgress;
  }
  
  isVerifyButtonDisabled(domainName: string, status: string): boolean {
    // Disable if:
    // 1. Status is Pending, or
    // 2. Any polling is in progress (domain verification or sublabel creation)
    return status === 'Pending' || this.isAnyPollingInProgress();
  }
  
  getVerifyButtonTooltip(domainName: string, status: string): string {
    if (status === 'Pending') {
      return 'Domain verification in progress...';
    }
    if (this.domainVerificationState.inProgress) {
      return `Please wait - domain verification in progress for "${this.domainVerificationState.pendingDomain}"`;
    }
    if (this.sublabelCreationState.inProgress) {
      return `Please wait - sublabel creation in progress for "${this.sublabelCreationState.pendingName}"`;
    }
    
    // Default tooltips
    switch (status) {
      case 'Connected':
        return 'Recheck domain configuration';
      case 'No SSL':
        return 'Retry SSL certificate configuration';
      case 'Unverified':
      default:
        return 'Verify domain configuration';
    }
  }

  getVerifyButtonText(status: string): string {
    switch (status) {
      case 'Connected':
        return 'Recheck';
      case 'No SSL':
        return 'Retry SSL';
      case 'Unverified':
      default:
        return 'Verify';
    }
  }
}