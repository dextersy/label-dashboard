import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, BulkEarning } from '../../../services/admin.service';
import { ReleaseService, Release } from '../../../services/release.service';
import { NotificationService } from '../../../services/notification.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo } from '../../../components/shared/paginated-table/paginated-table.component';

interface CsvEarningRow {
  catalog_no: string;
  release_title: string;
  artist_name: string;
  earning_amount: number;
}

@Component({
  selector: 'app-bulk-add-earnings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatedTableComponent],
  templateUrl: './bulk-add-earnings-tab.component.html',
  styles: [`
    .release-option:hover {
      background-color: #f8f9fa !important;
    }
    .view-toggle {
      background: linear-gradient(145deg, #f8f9fa, #e9ecef);
      border-radius: 12px;
      padding: 6px;
      border: 1px solid #dee2e6;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
      display: inline-flex;
      position: relative;
    }
    .view-toggle .btn {
      border: none;
      border-radius: 8px;
      padding: 14px 28px;
      font-weight: 500;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: transparent;
      color: #6c757d;
      position: relative;
      z-index: 1;
      margin: 0;
      font-size: 14px;
      letter-spacing: 0.025em;
    }
    .view-toggle .btn:hover:not(.active) {
      background: rgba(13, 110, 253, 0.08);
      color: #0d6efd;
      transform: translateY(-1px);
    }
    .view-toggle .btn.active {
      background: linear-gradient(145deg, #ffffff, #f8f9fa);
      color: #0d6efd;
      box-shadow: 
        0 4px 12px rgba(13, 110, 253, 0.15),
        0 2px 4px rgba(0,0,0,0.1),
        inset 0 1px 2px rgba(255,255,255,0.9);
      font-weight: 600;
      transform: translateY(-2px);
    }
    .view-toggle .btn:focus {
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
      outline: none;
    }
    .view-toggle .btn i {
      transition: transform 0.2s ease;
    }
    .view-toggle .btn.active i {
      transform: scale(1.1);
    }
    .csv-upload-area {
      border: 2px dashed #dee2e6;
      border-radius: 10px;
      padding: 40px;
      text-align: center;
      background-color: #f8f9fa;
      transition: all 0.3s ease;
    }
    .csv-upload-area:hover {
      border-color: #007bff;
      background-color: #e3f2fd;
    }
    .csv-upload-area.dragover {
      border-color: #007bff;
      background-color: #e3f2fd;
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

  // View toggle
  currentView: 'manual' | 'csv' = 'manual';

  // CSV Import properties
  csvFile: File | null = null;
  csvData: CsvEarningRow[] = [];
  csvTotalAmount: number = 0;
  csvTotalCount: number = 0;
  csvCalculateRoyalties: boolean = true;
  csvPagination: PaginationInfo = {
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10,
    has_next: false,
    has_prev: false
  };

  csvTableColumns: TableColumn[] = [
    { key: 'catalog_no', label: 'Catalog No', searchable: true, sortable: true },
    { key: 'release_title', label: 'Release Title', searchable: true, sortable: true },
    { key: 'artist_name', label: 'Artist Name', searchable: true, sortable: true },
    { key: 'earning_amount', label: 'Amount', type: 'number', searchable: false, sortable: true, formatter: (item) => this.formatCurrency(item.earning_amount) }
  ];

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

  // View toggle methods
  switchToManualView(): void {
    this.currentView = 'manual';
  }

  switchToCsvView(): void {
    this.currentView = 'csv';
  }

  // CSV handling methods (placeholders for now)
  openFileDialog(): void {
    const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.csvFile = file;
      this.processCsvFile(file);
    } else {
      this.notificationService.showError('Please select a valid CSV file');
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'text/csv') {
        this.csvFile = file;
        this.processCsvFile(file);
      } else {
        this.notificationService.showError('Please drop a valid CSV file');
      }
    }
  }

  processCsvFile(file: File): void {
    // Placeholder for CSV processing
    // TODO: Implement CSV parsing and mapping logic
    this.loading = true;
    
    // Simulate processing delay
    setTimeout(() => {
      // Mock data for now (more entries to test pagination)
      this.csvData = [
        { catalog_no: 'MR001', release_title: 'Sample Album 1', artist_name: 'Artist One', earning_amount: 1500.00 },
        { catalog_no: 'MR002', release_title: 'Sample Album 2', artist_name: 'Artist Two', earning_amount: 2300.50 },
        { catalog_no: 'MR003', release_title: 'Sample Album 3', artist_name: 'Artist Three', earning_amount: 890.25 },
        { catalog_no: 'MR004', release_title: 'Sample Album 4', artist_name: 'Artist Four', earning_amount: 1750.00 },
        { catalog_no: 'MR005', release_title: 'Sample Album 5', artist_name: 'Artist Five', earning_amount: 3200.75 },
        { catalog_no: 'MR006', release_title: 'Dance Revolution', artist_name: 'DJ Electric', earning_amount: 1250.30 },
        { catalog_no: 'MR007', release_title: 'Midnight Dreams', artist_name: 'Luna Eclipse', earning_amount: 1850.90 },
        { catalog_no: 'MR008', release_title: 'Rock Anthems', artist_name: 'Thunder Strike', earning_amount: 2150.45 },
        { catalog_no: 'MR009', release_title: 'Jazz Fusion', artist_name: 'Smooth Operator', earning_amount: 1650.80 },
        { catalog_no: 'MR010', release_title: 'Pop Hits Collection', artist_name: 'Star Bright', earning_amount: 2750.60 },
        { catalog_no: 'MR011', release_title: 'Acoustic Sessions', artist_name: 'Folk Hero', earning_amount: 950.25 },
        { catalog_no: 'MR012', release_title: 'Electronic Waves', artist_name: 'Synth Master', earning_amount: 1450.15 },
        { catalog_no: 'MR013', release_title: 'Classical Remixed', artist_name: 'Orchestra Digital', earning_amount: 1750.85 },
        { catalog_no: 'MR014', release_title: 'Hip Hop Chronicles', artist_name: 'Rap Legend', earning_amount: 2850.40 },
        { catalog_no: 'MR015', release_title: 'Country Roads', artist_name: 'Nashville Dreams', earning_amount: 1550.70 }
      ];
      
      this.updateCsvSummary();
      this.loading = false;
      this.notificationService.showSuccess(`CSV file processed: ${this.csvTotalCount} entries found`);
    }, 1500);
  }

  updateCsvSummary(): void {
    this.csvTotalCount = this.csvData.length;
    this.csvTotalAmount = this.csvData.reduce((sum, row) => sum + row.earning_amount, 0);
    
    // Update pagination
    const totalPages = Math.ceil(this.csvTotalCount / this.csvPagination.per_page);
    this.csvPagination = {
      current_page: 1,
      total_pages: totalPages,
      total_count: this.csvTotalCount,
      per_page: this.csvPagination.per_page,
      has_next: totalPages > 1,
      has_prev: false
    };
  }

  onCsvPageChange(page: number): void {
    this.csvPagination.current_page = page;
    // TODO: Implement pagination logic for CSV data
  }

  removeCsvFile(): void {
    this.csvFile = null;
    this.csvData = [];
    this.csvTotalAmount = 0;
    this.csvTotalCount = 0;
    this.csvPagination.current_page = 1;
    this.csvPagination.total_pages = 1;
    this.csvPagination.total_count = 0;
  }

  saveCsvEarnings(): void {
    if (this.csvData.length === 0) {
      this.notificationService.showError('No CSV data to save');
      return;
    }

    // TODO: Implement CSV earnings save logic
    this.loading = true;
    
    setTimeout(() => {
      this.loading = false;
      this.notificationService.showSuccess(`${this.csvTotalCount} earnings imported successfully`);
      this.removeCsvFile();
    }, 2000);
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}