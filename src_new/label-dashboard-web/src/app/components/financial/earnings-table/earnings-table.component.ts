import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-earnings-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './earnings-table.component.html',
  styleUrl: './earnings-table.component.scss'
})
export class EarningsTableComponent implements OnInit {
  earnings: any[] = [];

  ngOnInit(): void {
    this.loadEarnings();
  }

  loadEarnings(): void {
    // TODO: Load from API service
    this.earnings = [
      { date: '2024-01-15', source: 'Streaming', amount: 250.50, platform: 'Spotify' },
      { date: '2024-01-10', source: 'Digital Sales', amount: 180.75, platform: 'iTunes' },
      { date: '2024-01-05', source: 'Merchandise', amount: 450.00, platform: 'Store' }
    ];
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}
