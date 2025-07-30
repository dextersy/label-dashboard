import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, EarningsSummary } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-summary-view-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './summary-view-tab.component.html',
  styleUrls: ['./summary-view-tab.component.scss']
})
export class SummaryViewTabComponent implements OnInit {
  loading: boolean = false;
  startDate: string = '';
  endDate: string = '';
  maxDate: string = '';
  selectedPreset: string = 'last30days';
  lastUpdated: Date = new Date();
  showComparison: boolean = false;
  earningsSummary: EarningsSummary | null = null;
  paymentsRoyaltiesSummary: any = null;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {
    // Set max date to today
    this.maxDate = new Date().toISOString().split('T')[0];
    
    // Initialize with last 30 days preset
    this.applyDatePreset('last30days');
  }

  ngOnInit(): void {
    this.loadSummaryData();
  }

  private loadSummaryData(): void {
    this.loading = true;
    this.lastUpdated = new Date();
    
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

  applyDatePreset(preset: string): void {
    this.selectedPreset = preset;
    const today = new Date();
    let endDate = new Date(today);
    let startDate = new Date(today);

    switch (preset) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate.setDate(today.getDate() - 1);
        break;
      case 'last7days':
        startDate.setDate(today.getDate() - 6);
        break;
      case 'last30days':
        startDate.setDate(today.getDate() - 29);
        break;
      case 'thismonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastmonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        startDate.setDate(today.getDate() - 29);
        break;
    }

    this.startDate = startDate.toISOString().split('T')[0];
    this.endDate = endDate.toISOString().split('T')[0];
    this.loadSummaryData();
  }

  onCustomDateChange(): void {
    if (this.startDate && this.endDate) {
      this.selectedPreset = 'custom';
      this.loadSummaryData();
    }
  }

  refreshData(): void {
    this.loadSummaryData();
  }

  exportData(format: 'csv' | 'pdf'): void {
    // TODO: Implement export functionality
    this.notificationService.showInfo(`Export as ${format.toUpperCase()} - Feature coming soon!`);
  }

  getDaysDifference(): number {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }


  onComparisonToggle(): void {
    if (this.showComparison) {
      // TODO: Load comparison data for previous period
      this.notificationService.showInfo('Comparison feature - Coming soon!');
    }
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}