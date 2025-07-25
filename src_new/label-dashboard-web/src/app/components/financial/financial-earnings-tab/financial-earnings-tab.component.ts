import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EarningsTableComponent } from '../earnings-table/earnings-table.component';
import { PaginatedTableComponent, PaginationInfo } from '../../shared/paginated-table/paginated-table.component';
import { Earning } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-earnings-tab',
  standalone: true,
  imports: [CommonModule, EarningsTableComponent, PaginatedTableComponent],
  templateUrl: './financial-earnings-tab.component.html',
  styleUrl: './financial-earnings-tab.component.scss'
})
export class FinancialEarningsTabComponent {
  @Input() earnings: Earning[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Output() pageChange = new EventEmitter<number>();

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }
}