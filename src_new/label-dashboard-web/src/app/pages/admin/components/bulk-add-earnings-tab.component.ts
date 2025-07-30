import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, BulkEarning } from '../../../services/admin.service';
import { ReleaseService, Release } from '../../../services/release.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-bulk-add-earnings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-add-earnings-tab.component.html'
})
export class BulkAddEarningsTabComponent implements OnInit {
  loading: boolean = false;
  releases: Release[] = [];
  bulkEarnings: BulkEarning[] = [];
  totalEarnings: number = 0;

  constructor(
    private adminService: AdminService,
    private releaseService: ReleaseService,
    private notificationService: NotificationService
  ) {
    this.initializeBulkEarnings();
  }

  ngOnInit(): void {
    this.loadBulkEarningsData();
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

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}