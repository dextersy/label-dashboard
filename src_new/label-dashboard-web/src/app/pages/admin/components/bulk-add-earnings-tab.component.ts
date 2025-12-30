import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, BulkEarning, ProcessedEarningRow, CsvProcessingResult } from '../../../services/admin.service';
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
    imports: [CommonModule, FormsModule, PaginatedTableComponent],
    templateUrl: './bulk-add-earnings-tab.component.html',
    styleUrl: './bulk-add-earnings-tab.component.scss'
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
  csvData: ProcessedEarningRow[] = [];
  csvDataAll: ProcessedEarningRow[] = []; // Store all data
  csvTotalAmount: number = 0;
  csvTotalCount: number = 0;
  csvTotalUnmatched: number = 0;
  csvCalculateRoyalties: boolean = true;
  csvEarningType: string = 'Streaming';
  csvDescription: string = 'Import from CSV';
  mobileFormCollapsed: boolean = true;
  manualFormCollapsed: boolean = true;
  csvProcessingResult: CsvProcessingResult | null = null;
  showAddRowsDropdown: boolean = false;
  csvPagination: PaginationInfo = {
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    per_page: 10,
    has_next: false,
    has_prev: false
  };

  csvTableColumns: TableColumn[] = [
    { 
      key: 'matched_release', 
      label: 'Catalog No', 
      searchable: true, 
      sortable: true,
      formatter: (item) => item.matched_release?.catalog_no || ''
    },
    { 
      key: 'matched_release', 
      label: 'Release Title', 
      searchable: true, 
      sortable: true,
      formatter: (item) => item.matched_release?.title || ''
    },
    { 
      key: 'earning_amount', 
      label: 'Earning Amount', 
      type: 'number', 
      searchable: false, 
      sortable: true, 
      formatter: (item) => this.formatCurrency(item.earning_amount) 
    }
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
      this.previewCsvFile(file);
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
        this.previewCsvFile(file);
      } else {
        this.notificationService.showError('Please drop a valid CSV file');
      }
    }
  }

  previewCsvFile(file: File): void {
    this.loading = true;
    
    this.adminService.previewCsvForEarnings(file).subscribe({
      next: (result: CsvProcessingResult) => {
        this.csvProcessingResult = result;
        // Only show rows that have matched releases
        this.csvDataAll = result.data.filter(row => row.matched_release !== null);
        this.updateCsvSummary();
        this.updatePaginatedData();
        this.loading = false;
        
        const matchedCount = result.summary.total_rows - result.summary.total_unmatched;
        this.notificationService.showSuccess(
          `CSV processed: ${result.summary.total_rows} rows, ${matchedCount} matched, ${result.summary.total_unmatched} unmatched`
        );
      },
      error: (error) => {
        console.error('CSV processing error:', error);
        this.loading = false;
        this.notificationService.showError(
          error.error?.error || 'Error processing CSV file. Please check the format and try again.'
        );
      }
    });
  }

  updateCsvSummary(): void {
    if (this.csvProcessingResult) {
      this.csvTotalCount = this.csvProcessingResult.summary.total_rows;
      this.csvTotalAmount = this.csvProcessingResult.summary.total_earning_amount;
      this.csvTotalUnmatched = this.csvProcessingResult.summary.total_unmatched;
    } else {
      this.csvTotalCount = this.csvDataAll.length;
      this.csvTotalAmount = this.csvDataAll.reduce((sum, row) => sum + row.earning_amount, 0);
      this.csvTotalUnmatched = this.csvDataAll.filter(row => !row.matched_release).length;
    }
    
    // Update pagination based on matched data count
    const matchedCount = this.csvDataAll.length;
    const totalPages = Math.ceil(matchedCount / this.csvPagination.per_page);
    this.csvPagination = {
      current_page: 1,
      total_pages: totalPages,
      total_count: matchedCount,
      per_page: this.csvPagination.per_page,
      has_next: totalPages > 1,
      has_prev: false
    };
  }

  updatePaginatedData(): void {
    const startIndex = (this.csvPagination.current_page - 1) * this.csvPagination.per_page;
    const endIndex = startIndex + this.csvPagination.per_page;
    this.csvData = this.csvDataAll.slice(startIndex, endIndex);
  }

  onCsvPageChange(page: number): void {
    this.csvPagination.current_page = page;
    this.csvPagination.has_prev = page > 1;
    this.csvPagination.has_next = page < this.csvPagination.total_pages;
    this.updatePaginatedData();
  }

  removeCsvFile(): void {
    this.csvFile = null;
    this.csvData = [];
    this.csvDataAll = [];
    this.csvProcessingResult = null;
    this.csvTotalAmount = 0;
    this.csvTotalCount = 0;
    this.csvTotalUnmatched = 0;
    this.csvPagination.current_page = 1;
    this.csvPagination.total_pages = 1;
    this.csvPagination.total_count = 0;
  }

  saveCsvEarnings(): void {
    if (this.csvData.length === 0) {
      this.notificationService.showError('No CSV data to save');
      return;
    }

    // Filter out rows that don't have matched releases
    const matchedRows = this.csvDataAll.filter(row => row.matched_release);
    
    if (matchedRows.length === 0) {
      this.notificationService.showError('No matched releases to save. Please ensure your CSV contains valid catalog numbers or release titles.');
      return;
    }

    // Convert processed CSV data to BulkEarning format
    const bulkEarnings: BulkEarning[] = matchedRows.map(row => ({
      release_id: row.matched_release!.id,
      date_recorded: new Date().toISOString().split('T')[0], // Use current date
      type: this.csvEarningType, // Use selected earning type
      description: this.csvDescription,
      amount: row.earning_amount,
      calculate_royalties: this.csvCalculateRoyalties
    }));

    this.loading = true;
    
    this.adminService.bulkAddEarnings(bulkEarnings).subscribe({
      next: (response) => {
        this.loading = false;
        const skippedCount = this.csvDataAll.length - matchedRows.length;
        let message = `${matchedRows.length} earnings imported successfully`;
        if (skippedCount > 0) {
          message += `, ${skippedCount} rows skipped (no matching releases)`;
        }
        this.notificationService.showSuccess(message);
        this.removeCsvFile();
      },
      error: (error) => {
        console.error('Error saving CSV earnings:', error);
        this.loading = false;
        this.notificationService.showError('Error importing earnings from CSV');
      }
    });
  }

  downloadUnmatchedCsv(): void {
    if (!this.csvProcessingResult) {
      return;
    }

    // Get all unmatched rows from the original processing result
    const unmatchedRows = this.csvProcessingResult.data.filter(row => row.matched_release === null);
    
    if (unmatchedRows.length === 0) {
      this.notificationService.showInfo('No unmatched rows to download');
      return;
    }

    // Get headers from the first row's original_data
    const headers = Object.keys(unmatchedRows[0].original_data);
    
    // Generate CSV content
    const csvContent = this.generateCsvContent(headers, unmatchedRows.map(row => row.original_data));
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const originalFilename = this.csvFile?.name?.replace('.csv', '') || 'earnings';
      link.setAttribute('download', `${originalFilename}_unmatched_${timestamp}.csv`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.notificationService.showSuccess(`Downloaded ${unmatchedRows.length} unmatched rows as CSV`);
    }
  }

  private generateCsvContent(headers: string[], rows: { [key: string]: string }[]): string {
    // Escape CSV values that contain commas, quotes, or newlines
    const escapeCsvValue = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Create header row
    const csvHeaders = headers.map(header => escapeCsvValue(header)).join(',');
    
    // Create data rows
    const csvRows = rows.map(row => 
      headers.map(header => escapeCsvValue(row[header] || '')).join(',')
    );
    
    // Combine headers and data
    return [csvHeaders, ...csvRows].join('\n');
  }

  toggleMobileForm(): void {
    this.mobileFormCollapsed = !this.mobileFormCollapsed;
  }

  toggleManualForm(): void {
    this.manualFormCollapsed = !this.manualFormCollapsed;
  }

  toggleAddRowsDropdown(): void {
    console.log('Toggle dropdown clicked, current state:', this.showAddRowsDropdown);
    this.showAddRowsDropdown = !this.showAddRowsDropdown;
    console.log('New state:', this.showAddRowsDropdown);
  }

  hideAddRowsDropdown(): void {
    this.showAddRowsDropdown = false;
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}