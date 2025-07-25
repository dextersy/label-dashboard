import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoyaltiesTableComponent } from '../royalties-table/royalties-table.component';
import { PaginatedTableComponent, PaginationInfo } from '../../shared/paginated-table/paginated-table.component';
import { Royalty } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-financial-royalties-tab',
  standalone: true,
  imports: [CommonModule, RoyaltiesTableComponent, PaginatedTableComponent],
  templateUrl: './financial-royalties-tab.component.html',
  styleUrl: './financial-royalties-tab.component.scss'
})
export class FinancialRoyaltiesTabComponent {
  @Input() royalties: Royalty[] = [];
  @Input() pagination: PaginationInfo | null = null;
  @Input() loading: boolean = false;
  @Output() pageChange = new EventEmitter<number>();

  onPageChange(page: number): void {
    this.pageChange.emit(page);
  }
}