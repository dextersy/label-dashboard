import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, ArtistBalance } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-balance-summary-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './balance-summary-tab.component.html'
})
export class BalanceSummaryTabComponent implements OnInit {
  loading: boolean = false;
  artistBalances: ArtistBalance[] = [];
  recuperableExpenses: any[] = [];
  walletBalance: number = 0;
  totalBalance: number = 0;
  totalDueForPayment: number = 0;
  readyForPayment: number = 0;
  pausedPayouts: number = 0;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadBalanceData();
  }

  private loadBalanceData(): void {
    this.loading = true;
    
    this.adminService.getArtistBalances().subscribe({
      next: (balances) => {
        this.artistBalances = balances;
        this.calculateBalanceTotals();
        this.loadRecuperableExpenses();
      },
      error: (error) => {
        this.notificationService.showError('Error loading artist balances');
        this.loading = false;
      }
    });
  }

  private loadRecuperableExpenses(): void {
    this.adminService.getRecuperableExpenses().subscribe({
      next: (expenses) => {
        this.recuperableExpenses = expenses;
        this.loadWalletBalance();
      },
      error: (error) => {
        this.notificationService.showError('Error loading recuperable expenses');
        this.loading = false;
      }
    });
  }

  private loadWalletBalance(): void {
    this.adminService.getWalletBalance().subscribe({
      next: (balance) => {
        this.walletBalance = balance;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading wallet balance');
        this.loading = false;
      }
    });
  }

  private calculateBalanceTotals(): void {
    this.totalBalance = this.artistBalances.reduce((sum, artist) => sum + artist.total_balance, 0);
    this.totalDueForPayment = this.artistBalances
      .filter(artist => artist.due_for_payment)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
    this.readyForPayment = this.artistBalances
      .filter(artist => artist.due_for_payment && !artist.hold_payouts)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
    this.pausedPayouts = this.artistBalances
      .filter(artist => artist.due_for_payment && artist.hold_payouts)
      .reduce((sum, artist) => sum + artist.total_balance, 0);
  }

  payAllBalances(): void {
    if (confirm(`Are you sure you want to pay all balances totaling ₱${this.readyForPayment.toLocaleString()}?`)) {
      this.adminService.payAllBalances().subscribe({
        next: () => {
          this.loadBalanceData();
          this.notificationService.showSuccess('All balances paid successfully');
        },
        error: (error) => {
          this.notificationService.showError('Error paying balances');
        }
      });
    }
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}