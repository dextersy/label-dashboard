import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EventService, Event } from '../../../../services/event.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo } from '../../../../components/shared/paginated-table/paginated-table.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-event-walk-ins-tab',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent, IconComponent],
  templateUrl: './event-walk-ins-tab.component.html',
  styleUrl: './event-walk-ins-tab.component.scss',
})
export class EventWalkInsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{ type: string; text: string }>();

  transactions: any[] = [];
  transactionsLoading = false;
  pagination: PaginationInfo | null = null;
  walkInTypes: any[] = [];
  walkInTypesLoading = false;
  paymentMethodSummary: { method: string; total: number }[] = [];
  revenueExpanded = false;

  private subscriptions = new Subscription();

  columns: TableColumn[] = [
    { key: 'id', label: '#', sortable: true, cardHeader: true },
    { key: 'createdAt', label: 'Date', sortable: true, type: 'date', formatter: (item) => this.formatDate(item.createdAt) },
    { key: 'items', label: 'Items', formatter: (item) => (item.items || []).map((i: any) => `${i.quantity}x ${i.walkInType?.name || 'Unknown'}`).join(', ') },
    { key: 'payment_method', label: 'Payment', formatter: (item) => {
      let str = item.payment_method || '';
      if (item.payment_reference) str += ` (${item.payment_reference})`;
      return str;
    }},
    { key: 'total_amount', label: 'Amount', sortable: true, type: 'number', align: 'right', formatter: (item) => '₱' + (Number(item.total_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  ];

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent'] && this.selectedEvent) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    this.loadTransactions();
    this.loadWalkInTypes();
  }

  loadTransactions(page: number = 1): void {
    if (!this.selectedEvent) return;
    this.transactionsLoading = true;
    this.subscriptions.add(
      this.eventService.getWalkInTransactions(this.selectedEvent.id, page, 15).subscribe({
        next: (response) => {
          this.transactions = response.transactions;
          this.pagination = response.pagination;
          this.transactionsLoading = false;
        },
        error: () => {
          this.alertMessage.emit({ type: 'error', text: 'Failed to load walk-in transactions' });
          this.transactionsLoading = false;
        },
      })
    );
  }

  loadWalkInTypes(): void {
    if (!this.selectedEvent) return;
    this.walkInTypesLoading = true;
    this.subscriptions.add(
      this.eventService.getWalkInTypes(this.selectedEvent.id).subscribe({
        next: (response) => {
          this.walkInTypes = response.walkInTypes;
          this.paymentMethodSummary = response.by_payment_method || [];
          this.walkInTypesLoading = false;
        },
        error: () => { this.walkInTypesLoading = false; },
      })
    );
  }

  onPageChange(page: number): void {
    this.loadTransactions(page);
  }

  getTotalSold(): number {
    return this.walkInTypes.reduce((sum: number, t: any) => sum + (t.sold_count || 0), 0);
  }

  getTotalRevenue(): number {
    return this.walkInTypes.reduce((sum: number, t: any) => sum + ((Number(t.price) || 0) * (t.sold_count || 0)), 0);
  }

  formatPrice(price: number): string {
    return '₱' + (price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }
}
