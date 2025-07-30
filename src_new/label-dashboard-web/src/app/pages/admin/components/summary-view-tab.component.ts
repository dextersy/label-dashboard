import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, EarningsSummary } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-summary-view-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './summary-view-tab.component.html'
})
export class SummaryViewTabComponent implements OnInit {
  loading: boolean = false;
  dateRange: string = '';
  startDate: string = '';
  endDate: string = '';
  earningsSummary: EarningsSummary | null = null;
  paymentsRoyaltiesSummary: any = null;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {
    // Initialize date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
    this.dateRange = `${this.formatDateForDisplay(this.startDate)} - ${this.formatDateForDisplay(this.endDate)}`;
  }

  ngOnInit(): void {
    this.loadSummaryData();
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

  private formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  private parseDisplayDate(displayDate: string): string {
    const [month, day, year] = displayDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}