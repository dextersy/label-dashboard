import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminService, BrandSettings, Domain, DomainVerificationState, DomainVerificationEvent, SublabelCreationState } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { BrandService } from '../../../services/brand.service';
import { ConfirmationService } from '../../../services/confirmation.service';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-label-setup',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InPageNavComponent,
    FloatingActionBarComponent,
    BreadcrumbComponent
  ],
  templateUrl: './label-setup.component.html',
  styleUrls: []
})
export class LabelSetupComponent implements OnInit, OnDestroy {
  loading: boolean = false;
  brandSettings: BrandSettings | null = null;
  brandForm: FormGroup;
  domains: Domain[] = [];
  newDomainName: string = '';
  showPaymongoWalletId: boolean = false;
  domainVerificationState: DomainVerificationState = { inProgress: false, pendingDomain: '', pollCount: 0, maxPollCount: 60 };
  sublabelCreationState: SublabelCreationState = { inProgress: false, pendingName: '', pollCount: 0, maxPollCount: 60 };
  activeSection: 'brand-settings' | 'domains' = 'brand-settings';
  private subscriptions: Subscription[] = [];

  get navTabs(): InPageNavTab[] {
    return [
      { id: 'brand-settings', label: 'Brand Settings', icon: 'fas fa-palette' },
      { id: 'domains', label: 'Domains', icon: 'fas fa-globe' }
    ];
  }

  onTabChange(id: string): void {
    this.activeSection = id as 'brand-settings' | 'domains';
  }

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private brandService: BrandService,
    private confirmationService: ConfirmationService
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

    const verificationStateSubscription = this.adminService.domainVerificationState$.subscribe(
      (state) => {
        this.domainVerificationState = state;
      }
    );
    this.subscriptions.push(verificationStateSubscription);

    const sublabelStateSubscription = this.adminService.sublabelCreationState$.subscribe(
      (state) => {
        this.sublabelCreationState = state;
      }
    );
    this.subscriptions.push(sublabelStateSubscription);

    const verificationCompletionSubscription = this.adminService.domainVerificationCompletion$.subscribe(
      (event: DomainVerificationEvent | null) => {
        if (event) {
          this.loadDomains();
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
      error: () => {
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
      error: () => {
        this.notificationService.showError('Error loading domains');
        this.loading = false;
      }
    });
  }

  saveBrandSettings(): void {
    if (!this.brandForm.valid) {
      this.brandForm.markAllAsTouched();
      return;
    }
    if (this.brandSettings) {
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
        error: () => {
          this.notificationService.showError('Error saving brand settings');
          this.loading = false;
        }
      });
    }
  }

  onLogoFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        this.notificationService.showError('Only JPG and PNG files are allowed for logo.');
        event.target.value = '';
        return;
      }
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
        error: () => {
          this.notificationService.showError('Error uploading logo');
          this.loading = false;
        }
      });
    }
  }

  onFaviconFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'image/png') {
        this.notificationService.showError('Only PNG files are allowed for favicon.');
        event.target.value = '';
        return;
      }
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
        error: () => {
          this.notificationService.showError('Error uploading favicon');
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

  addDomain(): void {
    if (this.newDomainName.trim()) {
      this.loading = true;
      this.adminService.addDomain(this.newDomainName.trim()).subscribe({
        next: () => {
          this.newDomainName = '';
          this.loadDomains();
          this.notificationService.showSuccess('Domain added successfully');
        },
        error: () => {
          this.notificationService.showError('Error adding domain');
          this.loading = false;
        }
      });
    }
  }

  async deleteDomain(domainName: string): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Domain',
      message: `Are you sure you want to delete domain "${domainName}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    this.loading = true;
    this.adminService.deleteDomain(domainName).subscribe({
      next: () => {
        this.loadDomains();
        this.notificationService.showSuccess('Domain deleted successfully');
      },
      error: () => {
        this.notificationService.showError('Error deleting domain');
        this.loading = false;
      }
    });
  }

  verifyDomain(domainName: string): void {
    if (this.domainVerificationState.inProgress && this.domainVerificationState.pendingDomain === domainName) {
      return;
    }

    const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
    if (domainIndex !== -1) {
      this.domains[domainIndex].status = 'Pending';
    }

    this.adminService.verifyDomain(domainName).subscribe({
      next: (response) => {
        if (response.status === 'processing') {
          this.adminService.startDomainVerificationTracking(domainName);
          this.notificationService.showInfo(
            `Domain verification started! This may take a few minutes. We'll notify you when it's complete.`
          );
          return;
        }

        const idx = this.domains.findIndex(d => d.domain_name === domainName);
        if (idx !== -1) {
          this.domains[idx].status = response.status;
        }
        switch (response.status) {
          case 'Connected':
            this.notificationService.showSuccess('Domain verified and connected successfully!');
            break;
          case 'No SSL':
            this.notificationService.showWarning('Domain DNS is correct but SSL certificate is pending.');
            break;
          default:
            this.notificationService.showInfo(response.message || 'Domain verification complete.');
        }
      },
      error: (error) => {
        const idx = this.domains.findIndex(d => d.domain_name === domainName);
        if (idx !== -1) {
          this.domains[idx].status = error.error?.status || 'Unverified';
        }

        const errorMessage = error.error?.error || 'Domain verification failed';
        this.notificationService.showError(errorMessage);
      }
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Connected': return 'fas fa-check-circle text-success';
      case 'No SSL': return 'fas fa-exclamation-triangle text-warning';
      case 'Pending': return 'fas fa-clock text-info';
      case 'Unverified':
      default: return 'fas fa-times-circle text-danger';
    }
  }

  getStatusTooltip(status: string): string {
    switch (status) {
      case 'Connected': return 'Domain is fully connected - DNS points to our server and SSL certificate is configured';
      case 'No SSL': return 'Domain DNS is correct but SSL certificate needs to be updated';
      case 'Pending': return 'Domain is being configured - DNS records or SSL certificate are being processed';
      case 'Unverified':
      default: return 'Domain not verified - Click to verify DNS configuration';
    }
  }

  shouldShowVerifyButton(status: string): boolean {
    return status !== 'Pending';
  }

  isDomainVerificationInProgress(domainName: string): boolean {
    return this.domainVerificationState.inProgress && this.domainVerificationState.pendingDomain === domainName;
  }

  isAnyPollingInProgress(): boolean {
    return this.domainVerificationState.inProgress || this.sublabelCreationState.inProgress;
  }

  isVerifyButtonDisabled(domainName: string, status: string): boolean {
    return status === 'Pending' || this.isAnyPollingInProgress();
  }

  getVerifyButtonTooltip(domainName: string, status: string): string {
    if (status === 'Pending') return 'Domain verification in progress...';
    if (this.domainVerificationState.inProgress) {
      return `Please wait - domain verification in progress for "${this.domainVerificationState.pendingDomain}"`;
    }
    if (this.sublabelCreationState.inProgress) {
      return `Please wait - sublabel creation in progress for "${this.sublabelCreationState.pendingName}"`;
    }
    switch (status) {
      case 'Connected': return 'Recheck domain configuration';
      case 'No SSL': return 'Retry SSL certificate configuration';
      case 'Unverified':
      default: return 'Verify domain configuration';
    }
  }

  getVerifyButtonText(status: string): string {
    switch (status) {
      case 'Connected': return 'Recheck';
      case 'No SSL': return 'Retry SSL';
      case 'Unverified':
      default: return 'Verify';
    }
  }
}
