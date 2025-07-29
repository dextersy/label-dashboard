import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, BrandSettings, User, LoginAttempt, EarningsSummary, ArtistBalance, BulkEarning } from '../../services/admin.service';
import { ReleaseService, Release } from '../../services/release.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  activeTab: string = 'brand';
  loading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';

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
  loginAttempts: LoginAttempt[] = [];

  constructor(
    private adminService: AdminService,
    private releaseService: ReleaseService,
    private fb: FormBuilder
  ) {
    this.brandForm = this.fb.group({
      brand_name: ['', Validators.required],
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
    this.clearMessage();
    
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
        this.showMessage('Error loading brand settings', 'error');
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
        this.showMessage('Error loading domains', 'error');
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
        this.showMessage('Error loading earnings summary', 'error');
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
        this.showMessage('Error loading payments and royalties summary', 'error');
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
        this.showMessage('Error loading artist balances', 'error');
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
        this.showMessage('Error loading recuperable expenses', 'error');
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
        this.showMessage('Error loading wallet balance', 'error');
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
        this.showMessage('Error loading releases', 'error');
        this.loading = false;
      }
    });
  }

  private loadUsersData(): void {
    this.loading = true;
    
    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loadLoginAttempts();
      },
      error: (error) => {
        this.showMessage('Error loading users', 'error');
        this.loading = false;
      }
    });
  }

  private loadLoginAttempts(): void {
    this.adminService.getLoginAttempts().subscribe({
      next: (attempts) => {
        this.loginAttempts = attempts;
        this.loading = false;
      },
      error: (error) => {
        this.showMessage('Error loading login attempts', 'error');
        this.loading = false;
      }
    });
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
        next: () => {
          this.showMessage('Brand settings saved successfully', 'success');
          this.loading = false;
        },
        error: (error) => {
          this.showMessage('Error saving brand settings', 'error');
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
          }
          this.showMessage('Logo uploaded successfully', 'success');
          this.loading = false;
        },
        error: (error) => {
          this.showMessage('Error uploading logo', 'error');
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
          }
          this.showMessage('Favicon uploaded successfully', 'success');
          this.loading = false;
        },
        error: (error) => {
          this.showMessage('Error uploading favicon', 'error');
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
          this.showMessage('Domain added successfully', 'success');
        },
        error: (error) => {
          this.showMessage('Error adding domain', 'error');
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
          this.showMessage('Domain deleted successfully', 'success');
        },
        error: (error) => {
          this.showMessage('Error deleting domain', 'error');
        }
      });
    }
  }

  verifyDomain(domainName: string): void {
    this.adminService.verifyDomain(domainName).subscribe({
      next: () => {
        this.loadDomains();
        this.showMessage('Domain verification initiated', 'success');
      },
      error: (error) => {
        this.showMessage('Error verifying domain', 'error');
      }
    });
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
        this.loadUsersData();
        this.showMessage('Admin status updated successfully', 'success');
      },
      error: (error) => {
        this.showMessage('Error updating admin status', 'error');
      }
    });
  }

  payAllBalances(): void {
    if (confirm(`Are you sure you want to pay all balances totaling ₱${this.readyForPayment.toLocaleString()}?`)) {
      this.adminService.payAllBalances().subscribe({
        next: () => {
          this.loadBalanceData();
          this.showMessage('All balances paid successfully', 'success');
        },
        error: (error) => {
          this.showMessage('Error paying balances', 'error');
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
      this.showMessage('Please add at least one valid earning entry', 'error');
      return;
    }

    this.loading = true;
    this.adminService.bulkAddEarnings(validEarnings).subscribe({
      next: () => {
        this.initializeBulkEarnings();
        this.onBulkAmountChange();
        this.showMessage(`${validEarnings.length} earnings added successfully`, 'success');
        this.loading = false;
      },
      error: (error) => {
        this.showMessage('Error saving bulk earnings', 'error');
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

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
    setTimeout(() => this.clearMessage(), 5000);
  }

  clearMessage(): void {
    this.message = '';
    this.messageType = '';
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
}