import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseExpense } from '../release-expenses-dialog/release-expenses-dialog.component';

@Component({
  selector: 'app-expenses-table',
  standalone: true,
  imports: [CommonModule],
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

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }
}