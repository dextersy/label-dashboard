import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PaymentArtist {
  id: number;
  name: string;
  total_balance: number;
}

@Component({
  selector: 'app-payment-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payment-modal-overlay modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h4 class="modal-title">Confirm Payment</h4>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancel.emit()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <i class="fas fa-info-circle"></i>
              Are you sure you want to pay the following balances totaling <strong>{{ formatCurrency(totalAmount) }}</strong>?
            </div>
            
            <div class="table-responsive">
              <table class="table table-striped">
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th class="text-end">Balance to Pay (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let artist of artists">
                    <td>{{ artist.name }}</td>
                    <td class="text-end fw-bold">{{ formatCurrency(artist.total_balance) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="table-primary">
                    <th>Total</th>
                    <th class="text-end">{{ formatCurrency(totalAmount) }}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="alert alert-warning mt-3" *ngIf="availableBalance < totalAmount">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>Warning:</strong> Insufficient wallet balance. 
              Available: {{ formatCurrency(availableBalance) }}, Required: {{ formatCurrency(totalAmount) }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="cancel.emit()">Cancel</button>
            <button type="button" 
                    class="btn btn-primary" 
                    [disabled]="availableBalance < totalAmount || processing"
                    (click)="confirm.emit()">
              <span *ngIf="processing" class="spinner-border spinner-border-sm me-2"></span>
              <i class="fas fa-credit-card" *ngIf="!processing"></i>
              {{ processing ? 'Processing...' : 'Pay Now' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PaymentConfirmationDialogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() artists: PaymentArtist[] = [];
  @Input() availableBalance: number = 0;
  @Input() processing: boolean = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  totalAmount: number = 0;

  ngOnInit(): void {
    // Add modal-open class to body to prevent scrolling
    document.body.classList.add('modal-open');
  }

  ngOnDestroy(): void {
    // Remove modal-open class from body to restore scrolling
    document.body.classList.remove('modal-open');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['artists'] && this.artists) {
      this.totalAmount = this.artists.reduce((sum, artist) => sum + artist.total_balance, 0);
    }
  }

  formatCurrency(amount: number): string {
    return '₱' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  setData(artists: PaymentArtist[], availableBalance: number) {
    this.artists = artists;
    this.availableBalance = availableBalance;
    this.totalAmount = artists.reduce((sum, artist) => sum + artist.total_balance, 0);
  }

  setProcessing(processing: boolean) {
    this.processing = processing;
  }
}