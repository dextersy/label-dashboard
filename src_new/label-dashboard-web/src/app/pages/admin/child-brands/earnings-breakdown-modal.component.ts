import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChildBrand } from '../../../services/admin.service';

@Component({
    selector: 'app-earnings-breakdown-modal',
    imports: [CommonModule],
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

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }
}