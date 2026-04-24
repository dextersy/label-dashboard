import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PayoutsService, PayoutMethod, Payout, BalanceSummary } from '../../services/payouts.service';

@Component({
  selector: 'app-payouts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— finances —</p>
        <h1 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Payouts</h1>
      </div>

      <!-- Balance Card -->
      <div class="bg-black text-white p-6 mb-6">
        @if (balanceLoading()) {
          <p class="text-xs font-mono text-white/40 uppercase tracking-widest animate-pulse">loading...</p>
        } @else if (balance()) {
          <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-2">Available Balance</p>
              <p class="text-4xl font-black text-yellow-400">{{ balance()!.receivable_balance | currency:'PHP':'symbol':'1.2-2' }}</p>
            </div>
            <div class="text-right space-y-1">
              <div class="text-xs font-mono text-white/40">
                Gross Revenue: <span class="text-white">{{ balance()!.net_event_earnings | currency:'PHP':'symbol':'1.2-2' }}</span>
              </div>
              <div class="text-xs font-mono text-white/40">
                Total Paid Out: <span class="text-white">{{ balance()!.total_payments | currency:'PHP':'symbol':'1.2-2' }}</span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Payout Accounts -->
      <div class="bg-white border border-gray-200 mb-6">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Payout Accounts</h2>
          <button (click)="showAddForm.set(!showAddForm())"
            class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors">
            {{ showAddForm() ? 'Cancel' : '+ Add Account' }}
          </button>
        </div>

        <!-- Add Account Form -->
        @if (showAddForm()) {
          <div class="px-6 py-5 border-b border-gray-100 bg-gray-50">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
                  Bank / Wallet <span class="text-red-400">*</span>
                </label>
                <select [(ngModel)]="newMethod.bank_selection"
                  class="w-full px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400 bg-white">
                  <option value="">Select bank or wallet...</option>
                  @for (bank of supportedBanks(); track bank.bank_code) {
                    <option [value]="bank.bank_code + ',' + bank.bank_name">{{ bank.bank_name }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
                  Account Name <span class="text-red-400">*</span>
                </label>
                <input [(ngModel)]="newMethod.account_name" type="text"
                  class="w-full px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400"
                  placeholder="Full name on account">
              </div>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
                  Account Number / Mobile Number <span class="text-red-400">*</span>
                </label>
                <input [(ngModel)]="newMethod.account_number_or_email" type="text"
                  class="w-full px-3 py-2 border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. 09XXXXXXXXX or account number">
              </div>

              <div class="flex items-start gap-2 px-3 py-3 bg-yellow-50 border border-yellow-300">
                <svg class="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <p class="text-xs font-mono text-yellow-800">Double-check your account details before saving. Incorrect information may result in failed or misdirected payouts.</p>
              </div>

              @if (addMethodError()) {
                <p class="text-xs font-mono text-red-500">{{ addMethodError() }}</p>
              }

              <button (click)="addPayoutMethod()" [disabled]="addingMethod()"
                class="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider transition-colors">
                {{ addingMethod() ? 'Saving...' : 'Save Account' }}
              </button>
            </div>
          </div>
        }

        <!-- Existing Accounts -->
        <div class="divide-y divide-gray-100">
          @if (methodsLoading()) {
            <div class="px-6 py-8 text-center">
              <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
            </div>
          } @else if (payoutMethods().length === 0) {
            <div class="px-6 py-8 text-center">
              <p class="text-xs font-mono text-gray-400">No payout accounts yet. Add one to receive payouts.</p>
            </div>
          } @else {
            @for (method of payoutMethods(); track method.id) {
              <div class="flex items-center justify-between px-6 py-4">
                <div class="flex items-center gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-mono text-gray-900">{{ method.type }}</p>
                      @if (method.is_default_for_brand) {
                        <span class="px-1.5 py-0.5 bg-yellow-400 text-black text-xs font-black uppercase">Default</span>
                      }
                    </div>
                    <p class="text-xs font-mono text-gray-500">{{ method.account_name }}</p>
                    <p class="text-xs font-mono text-gray-400">{{ method.account_number_or_email }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  @if (!method.is_default_for_brand) {
                    <button (click)="setDefault(method.id)"
                      class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                      Set default
                    </button>
                  }
                  <button (click)="deleteMethod(method.id)"
                    class="text-xs font-mono text-red-400 hover:text-red-600 transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>

      <!-- Payout History -->
      <div class="bg-white border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Payout History</h2>
        </div>

        @if (historyLoading()) {
          <div class="px-6 py-8 text-center">
            <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
          </div>
        } @else if (payouts().length === 0) {
          <div class="px-6 py-8 text-center border border-dashed border-gray-200 m-6">
            <p class="text-xs font-mono text-gray-400">No payouts received yet.</p>
          </div>
        } @else {
          <div class="divide-y divide-gray-100">
            @for (payout of payouts(); track payout.id) {
              <div class="flex items-center justify-between px-6 py-4">
                <div>
                  <p class="text-sm font-mono text-gray-900">
                    {{ payout.description || 'Payout' }}
                  </p>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">
                    {{ formatDate(payout.date_paid) }}
                    @if (payout.paymentMethod) {
                      · {{ payout.paymentMethod.type }} ···{{ payout.paymentMethod.account_number_or_email.slice(-4) }}
                    } @else if (payout.paid_thru_type) {
                      · {{ payout.paid_thru_type }}
                    }
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-black"
                    [class.text-gray-900]="payout.status === 'succeeded'"
                    [class.text-yellow-500]="payout.status === 'pending'"
                    [class.text-red-500]="payout.status === 'failed'">
                    {{ payout.amount | currency:'PHP':'symbol':'1.2-2' }}
                  </p>
                  <p class="text-xs font-mono capitalize"
                    [class.text-gray-400]="payout.status === 'succeeded'"
                    [class.text-yellow-500]="payout.status === 'pending'"
                    [class.text-red-500]="payout.status === 'failed'">
                    {{ payout.status }}
                  </p>
                </div>
              </div>
            }
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <p class="text-xs font-mono text-gray-400">Page {{ currentPage() }} of {{ totalPages() }}</p>
              <div class="flex gap-2">
                <button (click)="loadHistory(currentPage() - 1)" [disabled]="currentPage() === 1"
                  class="px-3 py-1 text-xs font-mono border border-gray-300 disabled:opacity-40 hover:border-gray-500 transition-colors">
                  Prev
                </button>
                <button (click)="loadHistory(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
                  class="px-3 py-1 text-xs font-mono border border-gray-300 disabled:opacity-40 hover:border-gray-500 transition-colors">
                  Next
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class PayoutsComponent implements OnInit {
  balance = signal<BalanceSummary | null>(null);
  balanceLoading = signal(true);

  payoutMethods = signal<PayoutMethod[]>([]);
  methodsLoading = signal(true);

  payouts = signal<Payout[]>([]);
  historyLoading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);

  supportedBanks = signal<{ bank_code: string; bank_name: string }[]>([]);

  showAddForm = signal(false);
  addingMethod = signal(false);
  addMethodError = signal<string | null>(null);

  newMethod = { bank_selection: '', account_name: '', account_number_or_email: '' };

  private brandId!: number;

  constructor(
    private auth: AuthService,
    private payoutsService: PayoutsService
  ) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (!user?.brand_id) return;
    this.brandId = user.brand_id;

    this.loadBalance();
    this.loadMethods();
    this.loadHistory(1);
    this.loadSupportedBanks();
  }

  loadBalance(): void {
    this.balanceLoading.set(true);
    this.payoutsService.getBalance(this.brandId).subscribe({
      next: (data) => {
        this.balance.set(data);
        this.balanceLoading.set(false);
      },
      error: () => this.balanceLoading.set(false)
    });
  }

  loadMethods(): void {
    this.methodsLoading.set(true);
    this.payoutsService.getPayoutMethods(this.brandId).subscribe({
      next: ({ paymentMethods }) => {
        this.payoutMethods.set(paymentMethods);
        this.methodsLoading.set(false);
      },
      error: () => this.methodsLoading.set(false)
    });
  }

  loadHistory(page: number): void {
    this.historyLoading.set(true);
    this.payoutsService.getPayoutHistory(this.brandId, page).subscribe({
      next: ({ payments, pagination }) => {
        this.payouts.set(payments);
        this.currentPage.set(pagination.current_page);
        this.totalPages.set(pagination.total_pages);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false)
    });
  }

  loadSupportedBanks(): void {
    this.payoutsService.getSupportedBanks().subscribe({
      next: (banks) => this.supportedBanks.set(banks),
      error: () => {}
    });
  }

  addPayoutMethod(): void {
    if (!this.newMethod.bank_selection || !this.newMethod.account_name || !this.newMethod.account_number_or_email) {
      this.addMethodError.set('Please fill in all required fields.');
      return;
    }
    this.addMethodError.set(null);
    this.addingMethod.set(true);

    const [bank_code, bank_name] = this.newMethod.bank_selection.split(',');
    const isFirst = this.payoutMethods().length === 0;

    this.payoutsService.addPayoutMethod(this.brandId, {
      type: bank_name,
      bank_code,
      account_name: this.newMethod.account_name,
      account_number_or_email: this.newMethod.account_number_or_email,
      is_default_for_brand: isFirst
    }).subscribe({
      next: () => {
        this.addingMethod.set(false);
        this.showAddForm.set(false);
        this.newMethod = { bank_selection: '', account_name: '', account_number_or_email: '' };
        this.loadMethods();
      },
      error: (err) => {
        this.addingMethod.set(false);
        this.addMethodError.set(err?.error?.error || 'Failed to save account.');
      }
    });
  }

  setDefault(id: number): void {
    this.payoutsService.setDefaultPayoutMethod(this.brandId, id).subscribe({
      next: () => this.loadMethods(),
      error: () => {}
    });
  }

  deleteMethod(id: number): void {
    this.payoutsService.deletePayoutMethod(this.brandId, id).subscribe({
      next: () => this.loadMethods(),
      error: () => {}
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
