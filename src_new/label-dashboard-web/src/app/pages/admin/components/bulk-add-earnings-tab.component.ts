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
  templateUrl: './bulk-add-earnings-tab.component.html',
  styles: [`
    .release-option:hover {
      background-color: #f8f9fa !important;
    }
  `]
})
export class BulkAddEarningsTabComponent implements OnInit {
  loading: boolean = false;
  releases: Release[] = [];
  filteredReleases: Release[] = [];
  bulkEarnings: BulkEarning[] = [];
  totalEarnings: number = 0;
  searchTerms: string[] = [];
  showDropdown: boolean[] = [];

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
        this.filteredReleases = [...this.releases];
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
    this.searchTerms = [];
    this.showDropdown = [];
    for (let i = 0; i < 10; i++) {
      this.addEarningRow();
    }
  }

  private addEarningRow(): void {
    this.bulkEarnings.push({
      release_id: 0,
      date_recorded: new Date().toISOString().split('T')[0],
      type: 'Streaming',
      description: '',
      amount: 0,
      calculate_royalties: true
    });
    this.searchTerms.push('');
    this.showDropdown.push(false);
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

  addRows(count: number): void {
    for (let i = 0; i < count; i++) {
      this.addEarningRow();
    }
  }

  removeRow(index: number): void {
    this.bulkEarnings.splice(index, 1);
    this.searchTerms.splice(index, 1);
    this.showDropdown.splice(index, 1);
    this.onBulkAmountChange();
  }

  onReleaseSearch(index: number, searchTerm: string): void {
    this.searchTerms[index] = searchTerm;
    
    if (searchTerm.length === 0) {
      this.filteredReleases = [...this.releases];
    } else {
      this.filteredReleases = this.releases.filter(release => 
        release.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        release.catalog_no.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }

  onInputFocus(index: number): void {
    this.showDropdown[index] = true;
    if (this.searchTerms[index].length === 0) {
      this.filteredReleases = [...this.releases];
    } else {
      this.onReleaseSearch(index, this.searchTerms[index]);
    }
  }

  onInputBlur(index: number): void {
    // Delay hiding to allow for click events on dropdown items
    setTimeout(() => {
      this.showDropdown[index] = false;
    }, 200);
  }

  selectRelease(index: number, release: Release): void {
    this.bulkEarnings[index].release_id = release.id;
    this.searchTerms[index] = `${release.catalog_no}: ${release.title}`;
    this.showDropdown[index] = false;
    this.filteredReleases = [];
  }

  getSelectedRelease(releaseId: number): Release | undefined {
    return this.releases.find(r => r.id === releaseId);
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}