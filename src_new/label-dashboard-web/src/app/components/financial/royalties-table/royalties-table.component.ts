import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Royalty } from '../../../pages/financial/financial.component';

@Component({
    selector: 'app-royalties-table',
    imports: [CommonModule],
    templateUrl: './royalties-table.component.html',
    styleUrl: './royalties-table.component.scss'
})
export class RoyaltiesTableComponent {
  @Input() royalties: Royalty[] = [];
  @Input() showHeader: boolean = true;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }
}
