import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChildBrand } from '../../../services/admin.service';

@Component({
  selector: 'app-earnings-breakdown-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DecimalPipe],
  templateUrl: './earnings-breakdown-modal.component.html',
  styleUrls: ['./earnings-breakdown-modal.component.scss']
})
export class EarningsBreakdownModalComponent {
  @Input() show: boolean = false;
  @Input() childBrand: ChildBrand | null = null;
  @Input() breakdownType: 'music' | 'event' | 'platform_fees' = 'music';
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getMusicBreakdownTitle(): string {
    return `Music Earnings Breakdown - ${this.childBrand?.brand_name}`;
  }

  getEventBreakdownTitle(): string {
    return `Event Earnings Breakdown - ${this.childBrand?.brand_name}`;
  }

  getPlatformFeesBreakdownTitle(): string {
    return `Platform Fees Breakdown - ${this.childBrand?.brand_name}`;
  }
}