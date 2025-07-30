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
  @Input() initialPreset: string = 'last30days';
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
  selectedPreset: string = 'last30days';
  lastUpdated: Date = new Date();
  showComparisonToggle: boolean = false;

  constructor() {
    // Set max date to today
    this.maxDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.selectedPreset = this.initialPreset;
    this.showComparisonToggle = this.showComparison;
    this.applyDatePreset(this.initialPreset);
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
    this.emitDateRangeChange();
  }

  onCustomDateChange(): void {
    if (this.startDate && this.endDate) {
      this.selectedPreset = 'custom';
      this.emitDateRangeChange();
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
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
}