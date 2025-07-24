import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial.component.html',
  styleUrl: './financial.component.scss'
})
export class FinancialComponent implements OnInit {
  totalRoyalties: number = 0;
  totalPayments: number = 0;
  totalEarnings: number = 0;
  currentBalance: number = 0;
  isAdmin: boolean = false;
  latestEarnings: any[] = [];
  latestRoyalties: any[] = [];

  ngOnInit(): void {
    this.loadFinancialData();
  }

  loadFinancialData(): void {
    // TODO: Load from API service
    this.totalRoyalties = 15000;
    this.totalPayments = 8000;
    this.totalEarnings = 12000;
    this.currentBalance = this.totalRoyalties - this.totalPayments;
    this.isAdmin = true;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}
