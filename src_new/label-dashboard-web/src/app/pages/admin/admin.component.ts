import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, BrandSettings, User, LoginAttempt, EarningsSummary, ArtistBalance, BulkEarning, EmailLog, EmailDetail } from '../../services/admin.service';
import { ReleaseService, Release } from '../../services/release.service';
import { NotificationService } from '../../services/notification.service';
import { BrandService } from '../../services/brand.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../components/shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginatedTableComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  activeTab: string = 'brand';
  loading: boolean = false;

  // Brand Settings
  brandSettings: BrandSettings | null = null;
  brandForm: FormGroup;
  domains: any[] = [];
  newDomainName: string = '';

  // Summary View
  dateRange: string = '';
  startDate: string = '';
  endDate: string = '';
  earningsSummary: EarningsSummary | null = null;
  paymentsRoyaltiesSummary: any = null;

  // Balance Summary
  artistBalances: ArtistBalance[] = [];
  recuperableExpenses: any[] = [];
  walletBalance: number = 0;
  totalBalance: number = 0;
  totalDueForPayment: number = 0;
  readyForPayment: number = 0;
  pausedPayouts: number = 0;

  // Bulk Add Earnings
  releases: Release[] = [];
  bulkEarnings: BulkEarning[] = [];
  totalEarnings: number = 0;

  // Users
  users: User[] = [];
  usersPagination: PaginationInfo | null = null;
  usersLoading: boolean = false;
  usersFilters: any = {};
  usersSort: SortInfo | null = null;
  loginAttempts: LoginAttempt[] = [];
  loginAttemptsPagination: PaginationInfo | null = null;
  loginAttemptsLoading: boolean = false;
  loginAttemptsFilters: any = {};
  loginAttemptsSort: SortInfo | null = null;

  // Tools
  emailLogs: EmailLog[] = [];
  emailLogsPagination: PaginationInfo | null = null;
  emailLogsLoading: boolean = false;
  emailLogsFilters: any = {};
  emailLogsSort: SortInfo | null = null;
  selectedEmail: EmailDetail | null = null;
  showEmailModal: boolean = false;

  // Table column definitions
  usersColumns: TableColumn[] = [
    { key: 'username', label: 'Username', type: 'text', searchable: true, sortable: true },
    { key: 'first_name', label: 'First Name', type: 'text', searchable: true, sortable: true },
    { key: 'last_name', label: 'Last Name', type: 'text', searchable: true, sortable: true },
    { key: 'email_address', label: 'Email address', type: 'text', searchable: true, sortable: true },
    { key: 'last_logged_in', label: 'Last logged in', type: 'date', searchable: false, sortable: true },
    { key: 'is_admin', label: 'Is administrator', type: 'text', searchable: false, sortable: true }
  ];

  loginAttemptsColumns: TableColumn[] = [
    { key: 'username', label: 'Username', type: 'text', searchable: true, sortable: true },
    { key: 'name', label: 'Name', type: 'text', searchable: true, sortable: true },
    { key: 'date_and_time', label: 'Time', type: 'date', searchable: true, sortable: true },
    { key: 'result', label: 'Result', type: 'text', searchable: true, sortable: true },
    { key: 'remote_ip', label: 'Remote IP', type: 'text', searchable: true, sortable: true }
  ];

  emailLogsColumns: TableColumn[] = [
    { key: 'timestamp', label: 'Timestamp', type: 'date', searchable: true, sortable: true },
    { key: 'recipients', label: 'Recipients', type: 'text', searchable: true, sortable: true },
    { key: 'subject', label: 'Subject', type: 'text', searchable: true, sortable: true },
    { key: 'result', label: 'Result', type: 'text', searchable: true, sortable: true }
  ];

  constructor(
    private adminService: AdminService,
    private releaseService: ReleaseService,
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

    // Initialize date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
    this.dateRange = `${this.formatDateForDisplay(this.startDate)} - ${this.formatDateForDisplay(this.endDate)}`;

    // Initialize bulk earnings with 20 empty rows
    this.initializeBulkEarnings();
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    
    // Load tab-specific data
    switch (tab) {
      case 'brand':
        this.loadBrandSettings();
        break;
      case 'summary':
        this.loadSummaryData();
        break;
      case 'balance':
        this.loadBalanceData();
        break;
      case 'bulk-add-earnings':
        this.loadBulkEarningsData();
        break;
      case 'users':
        this.loadUsersData();
        break;
      case 'tools':
        this.loadToolsData();
        break;
    }
  }

  private loadInitialData(): void {
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

  private loadSummaryData(): void {
    this.loading = true;
    
    this.adminService.getEarningsSummary(this.startDate, this.endDate).subscribe({
      next: (summary) => {
        this.earningsSummary = summary;
        this.loadPaymentsRoyaltiesSummary();
      },
      error: (error) => {
        this.notificationService.showError('Error loading earnings summary');
        this.loading = false;
      }
    });
  }

  private loadPaymentsRoyaltiesSummary(): void {
    this.adminService.getPaymentsAndRoyaltiesSummary(this.startDate, this.endDate).subscribe({
      next: (summary) => {
        this.paymentsRoyaltiesSummary = summary;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading payments and royalties summary');
        this.loading = false;
      }
    });
  }

  private loadBalanceData(): void {
    this.loading = true;
    
    this.adminService.getArtistBalances().subscribe({
      next: (balances) => {
        this.artistBalances = balances;
        this.calculateBalanceTotals();
        this.loadRecuperableExpenses();
      },
      error: (error) => {
        this.notificationService.showError('Error loading artist balances');
        this.loading = false;
      }
    });
  }

  private loadRecuperableExpenses(): void {
    this.adminService.getRecuperableExpenses().subscribe({
      next: (expenses) => {
        this.recuperableExpenses = expenses;
        this.loadWalletBalance();
      },
      error: (error) => {
        this.notificationService.showError('Error loading recuperable expenses');
        this.loading = false;
      }
    });
  }

  private loadWalletBalance(): void {
    this.adminService.getWalletBalance().subscribe({
      next: (balance) => {
        this.walletBalance = balance;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading wallet balance');
        this.loading = false;
      }
    });
  }

  private loadBulkEarningsData(): void {
    this.loading = true;
    
    this.releaseService.getReleases().subscribe({
      next: (response) => {
        this.releases = response.releases;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading releases');
        this.loading = false;
      }
    });
  }

  private loadUsersData(): void {
    this.loadUsers(1, this.usersFilters, this.usersSort);
    this.loadLoginAttempts(1, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  loadUsers(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.usersLoading = true;
    
    this.adminService.getUsers(page, 15, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.users = response.data;
        this.usersPagination = response.pagination;
        this.usersLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading users');
        this.usersLoading = false;
      }
    });
  }

  loadLoginAttempts(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.loginAttemptsLoading = true;
    
    this.adminService.getLoginAttempts(page, 20, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.loginAttempts = response.data;
        this.loginAttemptsPagination = response.pagination;
        this.loginAttemptsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading login attempts');
        this.loginAttemptsLoading = false;
      }
    });
  }

  private loadToolsData(): void {
    this.loadEmailLogs(1, this.emailLogsFilters, this.emailLogsSort);
  }

  loadEmailLogs(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.emailLogsLoading = true;
    
    this.adminService.getEmailLogs(page, 50, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.emailLogs = response.data;
        this.emailLogsPagination = response.pagination;
        this.emailLogsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading email logs');
        this.emailLogsLoading = false;
      }
    });
  }

  viewEmailContent(emailId: number): void {
    this.adminService.getEmailDetail(emailId).subscribe({
      next: (email) => {
        this.selectedEmail = email;
        this.showEmailModal = true;
      },
      error: (error) => {
        this.notificationService.showError('Error loading email content');
      }
    });
  }

  previewEmail(emailId: number): void {
    this.adminService.getEmailDetail(emailId).subscribe({
      next: (email) => {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <title>Email Preview - ${email.subject}</title>
              <style>
                  body { 
                      margin: 10px; 
                      font-family: Arial, sans-serif; 
                      background-color: #f8f9fa;
                  }
                  .email-content {
                      background-color: white;
                      padding: 20px;
                      border-radius: 8px;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .email-header {
                      background-color: #e9ecef;
                      padding: 15px;
                      border-radius: 8px 8px 0 0;
                      margin: -20px -20px 20px -20px;
                      border-bottom: 1px solid #dee2e6;
                  }
                  .email-header h3 {
                      margin: 0 0 10px 0;
                      color: #495057;
                  }
                  .email-meta {
                      font-size: 14px;
                      color: #6c757d;
                  }
              </style>
          </head>
          <body>
              <div class="email-content">
                  <div class="email-header">
                      <h3>${email.subject}</h3>
                      <div class="email-meta">
                          <strong>To:</strong> ${email.recipients}<br>
                          <strong>Date:</strong> ${this.formatDate(email.timestamp)}
                      </div>
                  </div>
                  ${email.body}
              </div>
          </body>
          </html>
        `;
        
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        }
      },
      error: (error) => {
        this.notificationService.showError('Error loading email preview');
      }
    });
  }

  closeEmailModal(): void {
    this.showEmailModal = false;
    this.selectedEmail = null;
  }

  private calculateBalanceTotals(): void {
    this.totalBalance = this.artistBalances.reduce((sum, artist) => sum + artist.total_balance, 0);
    this.totalDueForPayment = this.artistBalances
      .filter(artist => artist.due_for_payment)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
    this.readyForPayment = this.artistBalances
      .filter(artist => artist.due_for_payment && !artist.hold_payouts)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
    this.pausedPayouts = this.artistBalances
      .filter(artist => artist.due_for_payment && artist.hold_payouts)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
  }

  private initializeBulkEarnings(): void {
    this.bulkEarnings = [];
    for (let i = 0; i < 20; i++) {
      this.bulkEarnings.push({
        release_id: 0,
        date_recorded: new Date().toISOString().split('T')[0],
        type: 'Streaming',
        description: '',
        amount: 0,
        calculate_royalties: true
      });
    }
  }

  // Event Handlers
  saveBrandSettings(): void {
    if (this.brandForm.valid && this.brandSettings) {
      this.loading = true;
      const formData = { ...this.brandSettings, ...this.brandForm.value };
      
      this.adminService.updateBrandSettings(formData).subscribe({
        next: (response) => {
          // Update local brand settings with the response
          if (response.brand) {
            this.brandSettings = response.brand;
            this.brandForm.patchValue(response.brand);
            // Convert admin BrandSettings to brand service format and update
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
            // Convert admin BrandSettings to brand service format and update
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
            // Convert admin BrandSettings to brand service format and update
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
        // Update local domain status
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = response.status;
        }
        this.notificationService.showSuccess('Domain verified successfully!');
      },
      error: (error) => {
        // Update local domain status to unverified
        const domainIndex = this.domains.findIndex(d => d.domain_name === domainName);
        if (domainIndex !== -1) {
          this.domains[domainIndex].status = 'Unverified';
        }
        
        const errorMessage = error.error?.error || 'Domain verification failed';
        this.notificationService.showError(errorMessage);
        
        // Show helpful hint if available
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

  filterSummaryData(): void {
    if (this.dateRange) {
      const dates = this.dateRange.split(' - ');
      if (dates.length === 2) {
        this.startDate = this.parseDisplayDate(dates[0]);
        this.endDate = this.parseDisplayDate(dates[1]);
        this.loadSummaryData();
      }
    }
  }

  toggleAdminStatus(userId: number): void {
    this.adminService.toggleAdminStatus(userId).subscribe({
      next: () => {
        this.loadUsers(this.usersPagination?.current_page || 1);
        this.notificationService.showSuccess('Admin status updated successfully');
      },
      error: (error) => {
        this.notificationService.showError('Error updating admin status');
      }
    });
  }

  payAllBalances(): void {
    if (confirm(`Are you sure you want to pay all balances totaling ₱${this.readyForPayment.toLocaleString()}?`)) {
      this.adminService.payAllBalances().subscribe({
        next: () => {
          this.loadBalanceData();
          this.notificationService.showSuccess('All balances paid successfully');
        },
        error: (error) => {
          this.notificationService.showError('Error paying balances');
        }
      });
    }
  }

  onBulkAmountChange(): void {
    this.totalEarnings = this.bulkEarnings.reduce((sum, earning) => sum + (earning.amount || 0), 0);
  }

  applyAllDate(date: string): void {
    this.bulkEarnings.forEach(earning => earning.date_recorded = date);
  }

  applyAllType(type: string): void {
    this.bulkEarnings.forEach(earning => earning.type = type);
  }

  applyAllDescription(description: string): void {
    this.bulkEarnings.forEach(earning => earning.description = description);
  }

  applyAllCalculateRoyalties(calculate: boolean): void {
    this.bulkEarnings.forEach(earning => earning.calculate_royalties = calculate);
  }

  saveBulkEarnings(): void {
    const validEarnings = this.bulkEarnings.filter(earning => 
      earning.release_id > 0 && earning.amount > 0
    );

    if (validEarnings.length === 0) {
      this.notificationService.showError('Please add at least one valid earning entry');
      return;
    }

    this.loading = true;
    this.adminService.bulkAddEarnings(validEarnings).subscribe({
      next: () => {
        this.initializeBulkEarnings();
        this.onBulkAmountChange();
        this.notificationService.showSuccess(`${validEarnings.length} earnings added successfully`);
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error saving bulk earnings');
        this.loading = false;
      }
    });
  }

  // Utility Methods
  private formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  private parseDisplayDate(displayDate: string): string {
    const [month, day, year] = displayDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }


  // Helper Methods for Template
  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
  }

  getReleaseTitle(releaseId: number): string {
    const release = this.releases.find(r => r.id === releaseId);
    return release ? `${release.catalog_no}: ${release.title}` : '';
  }

  // Users table pagination handlers
  onUsersPageChange(page: number): void {
    this.loadUsers(page, this.usersFilters, this.usersSort);
  }

  onUsersFiltersChange(filters: SearchFilters): void {
    this.usersFilters = filters;
    this.loadUsers(1, this.usersFilters, this.usersSort); // Reset to first page when filtering
  }

  onUsersSortChange(sort: SortInfo | null): void {
    this.usersSort = sort;
    this.loadUsers(this.usersPagination?.current_page || 1, this.usersFilters, this.usersSort);
  }

  // Login attempts table pagination handlers
  onLoginAttemptsPageChange(page: number): void {
    this.loadLoginAttempts(page, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  onLoginAttemptsFiltersChange(filters: SearchFilters): void {
    this.loginAttemptsFilters = filters;
    this.loadLoginAttempts(1, this.loginAttemptsFilters, this.loginAttemptsSort); // Reset to first page when filtering
  }

  onLoginAttemptsSortChange(sort: SortInfo | null): void {
    this.loginAttemptsSort = sort;
    this.loadLoginAttempts(this.loginAttemptsPagination?.current_page || 1, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  // Email logs table pagination handlers
  onEmailLogsPageChange(page: number): void {
    this.loadEmailLogs(page, this.emailLogsFilters, this.emailLogsSort);
  }

  onEmailLogsFiltersChange(filters: SearchFilters): void {
    this.emailLogsFilters = filters;
    this.loadEmailLogs(1, this.emailLogsFilters, this.emailLogsSort); // Reset to first page when filtering
  }

  onEmailLogsSortChange(sort: SortInfo | null): void {
    this.emailLogsSort = sort;
    this.loadEmailLogs(this.emailLogsPagination?.current_page || 1, this.emailLogsFilters, this.emailLogsSort);
  }
}