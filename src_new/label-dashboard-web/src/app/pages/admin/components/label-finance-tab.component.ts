import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';
import { LabelFinanceService, LabelFinanceDashboard, LabelFinanceBreakdown, LabelPaymentMethod, LabelPayment, LabelPaymentsResponse } from '../../../services/label-finance.service';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-label-finance-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent],
  templateUrl: './label-finance-tab.component.html',
  styleUrl: './label-finance-tab.component.scss'
})
export class LabelFinanceTabComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private brandId!: number;

  dashboard: LabelFinanceDashboard | null = null;
  breakdown: LabelFinanceBreakdown | null = null;
  breakdownType: 'music' | 'event' = 'music';
  showBreakdownModal = false;

  paymentMethods: LabelPaymentMethod[] = [];
  payments: LabelPayment[] = [];
  paymentsResponse: LabelPaymentsResponse | null = null;
  
  showAddPaymentMethodModal = false;
  newPaymentMethod: any = {}; // Using 'any' to allow bank_selection property
  isAddingPaymentMethod = false;
  supportedBanks: Array<{bank_code: string, bank_name: string}> = [];

  startDate?: string;
  endDate?: string;

  constructor(
    private labelFinanceService: LabelFinanceService,
    private adminService: AdminService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSupportedBanks();
    
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        if (user?.brand_id) {
          this.brandId = user.brand_id;
          this.loadDashboard();
          this.loadPaymentMethods();
          this.loadPayments();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSupportedBanks(): void {
    this.subscriptions.add(
      this.adminService.getSupportedBanks().subscribe({
        next: (banks) => {
          this.supportedBanks = banks;
        },
        error: (error) => {
          console.error('Error loading supported banks:', error);
          this.notificationService.showError('Failed to load supported banks. Payment methods may not work properly.');
        }
      })
    );
  }

  onDateRangeChanged(selection: DateRangeSelection): void {
    this.startDate = selection.startDate;
    this.endDate = selection.endDate;
    this.loadDashboard();
  }

  private loadDashboard(): void {
    if (!this.brandId) return;

    this.subscriptions.add(
      this.labelFinanceService.getDashboard(this.brandId, this.startDate, this.endDate)
        .subscribe({
          next: (data) => {
            this.dashboard = data;
          },
          error: (error) => {
            console.error('Error loading dashboard:', error);
            this.notificationService.showError('Failed to load dashboard data');
          }
        })
    );
  }

  showBreakdown(type: 'music' | 'event'): void {
    if (!this.brandId) {
      this.notificationService.showError('Brand information not loaded yet');
      return;
    }

    this.breakdownType = type;
    this.subscriptions.add(
      this.labelFinanceService.getBreakdown(this.brandId, type, this.startDate, this.endDate)
        .subscribe({
          next: (data) => {
            this.breakdown = data;
            this.showBreakdownModal = true;
          },
          error: (error) => {
            console.error('Error loading breakdown:', error);
            this.notificationService.showError('Failed to load breakdown data');
          }
        })
    );
  }

  closeBreakdownModal(): void {
    this.showBreakdownModal = false;
  }

  private loadPaymentMethods(): void {
    this.subscriptions.add(
      this.adminService.getLabelPaymentMethods().subscribe({
        next: (response) => {
          this.paymentMethods = (response as any)?.paymentMethods || response || [];
        },
        error: (error) => {
          console.error('Error loading payment methods:', error);
          this.notificationService.showError('Failed to load payment methods');
        }
      })
    );
  }

  loadPayments(page: number = 1): void {
    if (!this.brandId) return;

    this.subscriptions.add(
      this.labelFinanceService.getPayments(this.brandId, page, 10, 'date_paid', 'desc', this.startDate, this.endDate)
        .subscribe({
          next: (response) => {
            this.paymentsResponse = response;
            this.payments = response.payments;
          },
          error: (error) => {
            console.error('Error loading payments:', error);
            this.notificationService.showError('Failed to load payments');
          }
        })
    );
  }

  openAddPaymentMethodModal(): void {
    this.newPaymentMethod = {
      bank_selection: '',
      account_name: '',
      account_number_or_email: '',
      is_default_for_brand: false
    };
    this.showAddPaymentMethodModal = true;
  }

  closeAddPaymentMethodModal(): void {
    this.showAddPaymentMethodModal = false;
    this.newPaymentMethod = {};
  }

  addPaymentMethod(): void {
    if (!this.newPaymentMethod.bank_selection || !this.newPaymentMethod.account_name || !this.newPaymentMethod.account_number_or_email) {
      this.notificationService.showError('Please fill in all required fields');
      return;
    }

    // Parse bank_selection to get bank_code and type
    const [bank_code, bank_name] = this.newPaymentMethod.bank_selection.split(',');
    
    const paymentMethodData = {
      ...this.newPaymentMethod,
      type: bank_name,
      bank_code: bank_code
    };

    this.isAddingPaymentMethod = true;
    this.subscriptions.add(
      this.adminService.addLabelPaymentMethod(paymentMethodData as LabelPaymentMethod).subscribe({
        next: () => {
          this.notificationService.showSuccess('Payment method added successfully');
          this.closeAddPaymentMethodModal();
          this.loadPaymentMethods();
          this.isAddingPaymentMethod = false;
        },
        error: (error) => {
          console.error('Error adding payment method:', error);
          this.notificationService.showError('Failed to add payment method');
          this.isAddingPaymentMethod = false;
        }
      })
    );
  }

  // Note: Delete functionality not available in AdminService yet
  // deletePaymentMethod(id: number): void {
  //   if (!confirm('Are you sure you want to delete this payment method?')) {
  //     return;
  //   }
  //   // Implementation would go here when delete method is available
  // }

  getPageNumbers(): number[] {
    if (!this.paymentsResponse?.pagination) return [];
    
    const totalPages = this.paymentsResponse.pagination.total_pages;
    const currentPage = this.paymentsResponse.pagination.current_page;
    
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const halfRange = Math.floor(maxPagesToShow / 2);
    
    let start = Math.max(1, currentPage - halfRange);
    let end = Math.min(totalPages, start + maxPagesToShow - 1);
    
    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}