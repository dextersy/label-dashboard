import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket } from '../../../services/event.service';
import { CsvService } from '../../../services/csv.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';

export interface AbandonedOrder {
  id: number;
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  payment_link?: string;
  referrer_name?: string;
  order_timestamp: string;
  status: 'New' | 'Payment Confirmed' | 'Canceled';
  ticket_type_name?: string;
}


@Component({
    selector: 'app-event-abandoned-orders-tab',
    imports: [CommonModule, FormsModule, PaginatedTableComponent],
    templateUrl: './event-abandoned-orders-tab.component.html',
    styleUrl: './event-abandoned-orders-tab.component.scss'
})
export class EventAbandonedOrdersTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  orders: AbandonedOrder[] = [];
  loading = false;
  bulkOperationsLoading = false;
  
  // Pagination properties
  pagination: PaginationInfo | null = null;
  currentSort: SortInfo | null = null;
  currentFilters: SearchFilters = {};

  // Table configuration
  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Name', searchable: true, sortable: true },
    { key: 'email_address', label: 'Email Address', searchable: true, sortable: true },
    { key: 'contact_number', label: 'Contact Number', searchable: true, sortable: true },
    { key: 'number_of_entries', label: 'No. of Tickets', searchable: true, sortable: true, type: 'number' },
    { key: 'ticket_type_name', label: 'Ticket Type', searchable: true, sortable: true, formatter: (item) => item.ticket_type_name || 'Regular' },
    { key: 'payment_link', label: 'Payment Link', sortable: false },
    { key: 'referrer_name', label: 'Referred By', searchable: true, sortable: true },
    { key: 'order_timestamp', label: 'Time Ordered', sortable: true, type: 'date' },
    { key: 'status', label: 'Status', searchable: true, sortable: true, type: 'select', options: [
      { value: 'New', label: 'Awaiting Payment' },
      { value: 'Payment Confirmed', label: 'Payment Confirmed' },
      { value: 'Canceled', label: 'Canceled' }
    ]},
  ];

  private subscriptions = new Subscription();
  selectedOrders: AbandonedOrder[] = [];

  constructor(
    private eventService: EventService,
    private csvService: CsvService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAbandonedOrders();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadAbandonedOrders();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadAbandonedOrders(page: number = 1): void {
    if (!this.selectedEvent) {
      this.orders = [];
      this.pagination = null;
      return;
    }

    this.loading = true;
    
    const params = {
      page,
      per_page: 20,
      sort_column: this.currentSort?.column,
      sort_direction: this.currentSort?.direction,
      status_filter: 'pending',  // Only get "New" and "Payment Confirmed" tickets from backend
      filters: this.currentFilters
    };

    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id, params).subscribe({
        next: (response) => {
          // Convert API tickets to abandoned orders format
          this.orders = response.tickets.map(ticket => this.convertServiceTicketToAbandonedOrder(ticket));
          this.pagination = response.pagination;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load abandoned orders:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to load abandoned orders'
          });
          this.loading = false;
        }
      })
    );
  }

  private convertServiceTicketToAbandonedOrder(ticket: ServiceEventTicket): AbandonedOrder {
    return {
      id: ticket.id,
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
      number_of_entries: ticket.number_of_entries,
      payment_link: ticket.payment_link || '',
      order_timestamp: ticket.order_timestamp,
      status: this.normalizeAbandonedOrderStatus(ticket.status),
      ticket_type_name: ticket.ticketType?.name
    };
  }

  private normalizeAbandonedOrderStatus(status: string): 'Payment Confirmed' | 'New' | 'Canceled' {
    switch (status.toLowerCase()) {
      case 'payment confirmed':
      case 'payment confirmed.':
        return 'Payment Confirmed';
      case 'new':
        return 'New';
      case 'canceled':
      case 'cancelled':
        return 'Canceled';
      default:
        return 'New';
    }
  }


  onSendTicket(orderId: number): void {
    this.bulkOperationsLoading = true;
    this.subscriptions.add(
      this.eventService.resendTicket(orderId).subscribe({
        next: () => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: 'Ticket sent successfully!'
          });
          // Remove from pending tickets since it's now sent
          this.orders = this.orders.filter(o => o.id !== orderId);
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to send ticket:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to send ticket'
          });
        }
      })
    );
  }

  onMarkAsPaid(orderId: number): void {
    this.bulkOperationsLoading = true;
    this.subscriptions.add(
      this.eventService.markTicketPaid(orderId).subscribe({
        next: () => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: 'Order marked as paid!'
          });
          // Refresh the list to show the updated status
          this.loadAbandonedOrders();
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to mark order as paid:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to mark order as paid'
          });
        }
      })
    );
  }

  onCancelOrder(orderId: number): void {
    const confirmed = confirm('Are you sure you want to cancel this order?');
    if (confirmed) {
      this.bulkOperationsLoading = true;
      this.subscriptions.add(
        this.eventService.cancelTicket(orderId).subscribe({
          next: () => {
            this.bulkOperationsLoading = false;
            this.alertMessage.emit({
              type: 'success',
              text: 'Order cancelled successfully!'
            });
            // Remove order from list
            this.orders = this.orders.filter(o => o.id !== orderId);
          },
          error: (error) => {
            this.bulkOperationsLoading = false;
            console.error('Failed to cancel order:', error);
            this.alertMessage.emit({
              type: 'error',
              text: 'Failed to cancel order'
            });
          }
        })
      );
    }
  }

  onVerifyPayments(): void {
    if (!this.selectedEvent) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No event selected'
      });
      return;
    }

    // Show loading state
    this.loading = true;
    
    this.alertMessage.emit({
      type: 'info',
      text: 'Verifying payments with PayMongo...'
    });

    this.subscriptions.add(
      this.eventService.verifyAllPayments(this.selectedEvent.id).subscribe({
        next: (response) => {
          this.alertMessage.emit({
            type: 'success',
            text: response.message || `Payment verification completed. ${response.verified_count} payments verified.`
          });
          
          // Refresh the abandoned orders list to show updated statuses
          this.loadAbandonedOrders();
        },
        error: (error) => {
          console.error('Failed to verify payments:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error?.error?.error || 'Failed to verify payments'
          });
          this.loading = false;
        }
      })
    );
  }

  onSendPaymentReminders(): void {
    // TODO: Implement API call to send payment reminders
    this.alertMessage.emit({
      type: 'success',
      text: 'Payment reminders sent!'
    });
  }

  onCancelAllUnpaid(): void {
    if (!this.selectedEvent) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No event selected'
      });
      return;
    }

    const confirmed = confirm('Are you sure you want to cancel ALL unpaid orders? This action cannot be undone.');
    if (confirmed) {
      this.subscriptions.add(
        this.eventService.cancelAllUnpaidTickets(this.selectedEvent.id).subscribe({
          next: (response) => {
            this.alertMessage.emit({
              type: 'success',
              text: response.message || 'All unpaid orders cancelled successfully!'
            });
            // Refresh the abandoned orders list
            this.loadAbandonedOrders();
          },
          error: (error) => {
            console.error('Failed to cancel all unpaid orders:', error);
            this.alertMessage.emit({
              type: 'error',
              text: 'Failed to cancel all unpaid orders'
            });
          }
        })
      );
    }
  }

  onDownloadCSV(): void {
    if (!this.selectedEvent) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No event selected.'
      });
      return;
    }

    // Use the new export endpoint to get ALL pending tickets
    this.subscriptions.add(
      this.eventService.exportEventPendingTicketsCsv(this.selectedEvent.id).subscribe({
        next: (response) => {
          if (!response.tickets.length) {
            this.alertMessage.emit({
              type: 'error',
              text: 'No pending tickets to export.'
            });
            return;
          }

          // Format data according to PHP format using ALL pending tickets from export
          const csvData = response.tickets.map(ticket => [
            ticket.name,
            ticket.email_address,
            ticket.contact_number || '',
            ticket.number_of_entries.toString(),
            '', // Ticket code (empty for pending orders)
            ticket.referrer_name || '', // Include referrer info
            '', // Notes column (empty in PHP version)
            ticket.status
          ]);

          const filename = `${response.event_title.replace(/\s+/g, '_')}_tickets_pending.csv`;
          
          this.csvService.downloadCsv({
            title: `Pending tickets for ${response.event_title}`,
            headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Referred By', 'Notes', 'Status'],
            data: csvData,
            filename: filename
          });

          this.alertMessage.emit({
            type: 'success',
            text: `${response.total_count} pending tickets exported successfully!`
          });
        },
        error: (error) => {
          console.error('Failed to export pending tickets:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to export pending tickets CSV'
          });
        }
      })
    );
  }

  onCreateCustomTicket(): void {
    if (!this.canCreateCustomTickets()) {
      return; // Do nothing if tickets can't be created
    }

    if (!this.selectedEvent) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No event selected'
      });
      return;
    }

    this.router.navigate(['/events/custom-ticket'], {
      queryParams: { eventId: this.selectedEvent.id, from: 'abandoned' }
    });
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'New':
        return 'Awaiting Payment';
      case 'Payment Confirmed':
        return 'Payment Confirmed';
      case 'Canceled':
        return 'Canceled';
      default:
        return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New':
        return 'text-warning';
      case 'Payment Confirmed':
        return 'text-info';
      case 'Canceled':
        return 'text-muted';
      default:
        return '';
    }
  }

  getTotalPendingOrders(): number {
    return this.orders.reduce((total, order) => total + order.number_of_entries, 0);
  }

  isEventPast(): boolean {
    if (!this.selectedEvent || !this.selectedEvent.date_and_time) {
      return false;
    }
    
    const eventDate = new Date(this.selectedEvent.date_and_time);
    const now = new Date();
    
    return now > eventDate;
  }

  canCreateCustomTickets(): boolean {
    return !this.isEventPast(); // Allow even when sales closed, but not for past events
  }

  getCustomTicketButtonTooltip(): string {
    if (this.isEventPast()) {
      return 'Cannot create custom tickets for past events';
    }
    return 'Create a custom ticket for special invites';
  }


  // Pagination event handlers
  onPageChange(page: number): void {
    this.loadAbandonedOrders(page);
  }

  onFiltersChange(filters: SearchFilters): void {
    this.currentFilters = filters;
    this.loadAbandonedOrders(1); // Reset to page 1 when filtering
  }

  onSortChange(sortInfo: SortInfo | null): void {
    this.currentSort = sortInfo;
    this.loadAbandonedOrders(1); // Reset to page 1 when sorting
  }

  // Bulk operations event handlers
  onSelectedItemsChange(selectedItems: AbandonedOrder[]): void {
    this.selectedOrders = selectedItems;
  }

  // Bulk operations constraint logic
  canBulkSendTickets(selectedOrders: AbandonedOrder[]): boolean {
    return this.getBulkSendCount(selectedOrders) > 0;
  }

  canBulkMarkAsPaid(selectedOrders: AbandonedOrder[]): boolean {
    return this.getBulkMarkPaidCount(selectedOrders) > 0;
  }

  canBulkCancel(selectedOrders: AbandonedOrder[]): boolean {
    return this.getBulkCancelCount(selectedOrders) > 0;
  }

  getBulkSendCount(selectedOrders: AbandonedOrder[]): number {
    return selectedOrders.filter(order => order.status === 'Payment Confirmed').length;
  }

  getBulkMarkPaidCount(selectedOrders: AbandonedOrder[]): number {
    return selectedOrders.filter(order => order.status === 'New').length;
  }

  getBulkCancelCount(selectedOrders: AbandonedOrder[]): number {
    return selectedOrders.filter(order => order.status === 'New').length;
  }

  // Bulk operations methods
  onBulkSendTickets(selectedOrders: AbandonedOrder[]): void {
    const eligibleOrders = selectedOrders.filter(order => order.status === 'Payment Confirmed');
    
    if (eligibleOrders.length === 0) {
      this.alertMessage.emit({
        type: 'warning',
        text: 'No orders eligible for sending tickets (only Payment Confirmed orders can send tickets)'
      });
      return;
    }

    const ticketIds = eligibleOrders.map(order => order.id);
    this.bulkOperationsLoading = true;
    
    this.subscriptions.add(
      this.eventService.resendTicket(ticketIds).subscribe({
        next: (response) => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: response.message || `${response.success_count} tickets sent successfully`
          });
          // Refresh the list to show updated statuses
          this.loadAbandonedOrders();
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to send tickets:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error?.error?.error || 'Failed to send tickets'
          });
        }
      })
    );
  }

  onBulkMarkAsPaid(selectedOrders: AbandonedOrder[]): void {
    const eligibleOrders = selectedOrders.filter(order => order.status === 'New');
    
    if (eligibleOrders.length === 0) {
      this.alertMessage.emit({
        type: 'warning',
        text: 'No orders eligible for marking as paid (only New orders can be marked as paid)'
      });
      return;
    }

    const ticketIds = eligibleOrders.map(order => order.id);
    this.bulkOperationsLoading = true;
    
    this.subscriptions.add(
      this.eventService.markTicketPaid(ticketIds).subscribe({
        next: (response) => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: response.message || `${response.updated_count} orders marked as paid successfully`
          });
          // Refresh the list to show updated statuses
          this.loadAbandonedOrders();
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to mark orders as paid:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error?.error?.error || 'Failed to mark orders as paid'
          });
        }
      })
    );
  }

  onBulkCancel(selectedOrders: AbandonedOrder[]): void {
    const eligibleOrders = selectedOrders.filter(order => order.status === 'New');
    
    if (eligibleOrders.length === 0) {
      this.alertMessage.emit({
        type: 'warning',
        text: 'No orders eligible for cancellation (only New orders can be cancelled)'
      });
      return;
    }

    const confirmed = confirm(`Are you sure you want to cancel ${eligibleOrders.length} order(s)? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const ticketIds = eligibleOrders.map(order => order.id);
    this.bulkOperationsLoading = true;
    
    this.subscriptions.add(
      this.eventService.cancelTicket(ticketIds).subscribe({
        next: (response) => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: response.message || `${response.cancelled_count} orders cancelled successfully`
          });
          // Refresh the list to show updated statuses
          this.loadAbandonedOrders();
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to cancel orders:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error?.error?.error || 'Failed to cancel orders'
          });
        }
      })
    );
  }
}