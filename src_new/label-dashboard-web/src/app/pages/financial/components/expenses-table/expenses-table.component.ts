import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseExpense } from '../release-expenses-dialog/release-expenses-dialog.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-expenses-table',
    imports: [CommonModule, IconComponent],
    templateUrl: './expenses-table.component.html',
    styleUrl: './expenses-table.component.scss'
})
export class ExpensesTableComponent {
  @Input() expenses: ReleaseExpense[] = [];
  @Input() showHeader: boolean = true;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }
}