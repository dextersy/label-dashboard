import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Earning } from '../../../pages/financial/financial.component';

@Component({
  selector: 'app-earnings-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './earnings-table.component.html',
  styleUrl: './earnings-table.component.scss'
})
export class EarningsTableComponent {
  @Input() earnings: Earning[] = [];
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
