import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, EarningsSummary } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { DateRangeFilterComponent, DateRangeSelection } from '../../../components/shared/date-range-filter/date-range-filter.component';

@Component({
  selector: 'app-summary-view-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent],
  templateUrl: './summary-view-tab.component.html',
  styleUrls: ['./summary-view-tab.component.scss']
})
export class SummaryViewTabComponent implements OnInit {
  loading: boolean = false;
  startDate: string = '';
  endDate: string = '';
  earningsSummary: EarningsSummary | null = null;
  paymentsRoyaltiesSummary: any = null;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSummaryData();
  }

  private loadSummaryData(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }
    
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

  onDateRangeChange(dateRange: DateRangeSelection): void {
    this.startDate = dateRange.startDate;
    this.endDate = dateRange.endDate;
    this.loadSummaryData();
  }

  onRefresh(): void {
    this.loadSummaryData();
  }

  onExport(format: string): void {
    this.notificationService.showInfo(`Export as ${format.toUpperCase()} - Feature coming soon!`);
  }

  onComparisonToggle(enabled: boolean): void {
    if (enabled) {
      this.notificationService.showInfo('Comparison feature - Coming soon!');
    }
  }

  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}