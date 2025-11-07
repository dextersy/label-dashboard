import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DateRangeSelection {
  startDate: string;
  endDate: string;
  preset: string;
}

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-filter.component.html',
  styleUrls: ['./date-range-filter.component.scss']
})
export class DateRangeFilterComponent implements OnInit {
  @Input() initialPreset: string = 'alltime';
  @Input() showComparison: boolean = false;
  @Input() showExport: boolean = false;
  @Input() loading: boolean = false;
  @Input() compact: boolean = false; // For smaller layouts like tables
  
  @Output() dateRangeChange = new EventEmitter<DateRangeSelection>();
  @Output() refresh = new EventEmitter<void>();
  @Output() export = new EventEmitter<string>();
  @Output() comparisonToggle = new EventEmitter<boolean>();

  startDate: string = '';
  endDate: string = '';
  maxDate: string = '';
  selectedPreset: string = 'alltime';
  lastUpdated: Date = new Date();
  showComparisonToggle: boolean = false;
  isExpanded: boolean = false; // Track if the date fields are expanded
  private initialized: boolean = false; // Track if component is initialized

  constructor() {
    // Set max date to today
    this.maxDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.selectedPreset = this.initialPreset;
    this.showComparisonToggle = this.showComparison;
    this.applyDatePreset(this.initialPreset);
    this.initialized = true;
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
        endDate = new Date(today);
        break;
      case 'lastmonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'alltime':
        // Set a very early date for "all time" (e.g., January 1, 2000)
        startDate = new Date(2000, 0, 1);
        endDate = new Date(today);
        break;
      default:
        // Default to all time if preset is not recognized
        startDate = new Date(2000, 0, 1);
        endDate = new Date(today);
        break;
    }

    this.startDate = this.formatDateToString(startDate);
    this.endDate = this.formatDateToString(endDate);
    this.emitDateRangeChange();
    
    // Auto-collapse after preset selection (only if not during initialization)
    if (this.initialized) {
      this.isExpanded = false;
    }
  }

  onCustomDateChange(): void {
    if (this.startDate && this.endDate) {
      this.selectedPreset = 'custom';
      this.emitDateRangeChange();
      
      // Auto-collapse after custom date selection (only if initialized and both dates selected)
      if (this.initialized) {
        // Add a small delay to allow the user to see the change
        setTimeout(() => {
          this.isExpanded = false;
        }, 500);
      }
    }
  }

  private emitDateRangeChange(): void {
    this.lastUpdated = new Date();
    this.dateRangeChange.emit({
      startDate: this.startDate,
      endDate: this.endDate,
      preset: this.selectedPreset
    });
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  onExport(format: string): void {
    this.export.emit(format);
  }

  onComparisonToggle(): void {
    this.comparisonToggle.emit(this.showComparisonToggle);
  }

  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  getDaysDifference(): number {
    // For "All Time" preset, don't calculate days as it would be too large
    if (this.selectedPreset === 'alltime') {
      return 0; // This will be handled specially in the template
    }
    
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  private formatDateToString(date: Date): string {
    // Format date as YYYY-MM-DD using local timezone to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  getPresetDisplayName(): string {
    switch (this.selectedPreset) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'last7days':
        return 'Last 7 days';
      case 'last30days':
        return 'Last 30 days';
      case 'thismonth':
        return 'This month';
      case 'lastmonth':
        return 'Last month';
      case 'alltime':
        return 'All Time';
      case 'custom':
        return 'Custom range';
      default:
        return 'All Time';
    }
  }
}