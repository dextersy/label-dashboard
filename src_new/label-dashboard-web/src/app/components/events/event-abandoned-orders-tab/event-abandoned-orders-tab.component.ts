import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket } from '../../../services/event.service';
import { CsvService } from '../../../services/csv.service';

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
}

export interface CustomTicketForm {
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  price_per_ticket: number;
  referral_code?: string;
  ticket_paid: boolean;
  payment_processing_fee: number;
  send_email: boolean;
}

@Component({
  selector: 'app-event-abandoned-orders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-abandoned-orders-tab.component.html',
  styleUrl: './event-abandoned-orders-tab.component.scss'
})
export class EventAbandonedOrdersTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  orders: AbandonedOrder[] = [];
  loading = false;
  
  customTicketForm: CustomTicketForm = {
    name: '',
    email_address: '',
    contact_number: '',
    number_of_entries: 1,
    price_per_ticket: 0,
    referral_code: '',
    ticket_paid: false,
    payment_processing_fee: 0,
    send_email: true
  };

  priceOverrideEnabled = false;
  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private csvService: CsvService
  ) {}

  ngOnInit(): void {
    this.loadAbandonedOrders();
    this.initializeCustomTicketForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadAbandonedOrders();
      this.initializeCustomTicketForm();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadAbandonedOrders(): void {
    if (!this.selectedEvent) {
      this.orders = [];
      return;
    }

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id).subscribe({
        next: (tickets) => {
          // Filter for abandoned orders (new/unpaid tickets)
          this.orders = tickets
            .filter(ticket => ticket.status === 'New')
            .map(ticket => this.convertServiceTicketToAbandonedOrder(ticket));
          
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
      status: this.normalizeAbandonedOrderStatus(ticket.status)
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

  private initializeCustomTicketForm(): void {
    this.customTicketForm.price_per_ticket = this.selectedEvent?.ticket_price || 0;
  }

  onMarkAsPaid(orderId: number): void {
    this.subscriptions.add(
      this.eventService.markTicketPaid(orderId).subscribe({
        next: () => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Order marked as paid!'
          });
          // Remove from abandoned orders since it's now confirmed
          this.orders = this.orders.filter(o => o.id !== orderId);
        },
        error: (error) => {
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
      this.subscriptions.add(
        this.eventService.cancelTicket(orderId).subscribe({
          next: () => {
            this.alertMessage.emit({
              type: 'success',
              text: 'Order cancelled successfully!'
            });
            // Remove order from list
            this.orders = this.orders.filter(o => o.id !== orderId);
          },
          error: (error) => {
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
    // TODO: Implement API call to verify payments
    this.alertMessage.emit({
      type: 'info',
      text: 'Payment verification started.'
    });
  }

  onSendPaymentReminders(): void {
    // TODO: Implement API call to send payment reminders
    this.alertMessage.emit({
      type: 'success',
      text: 'Payment reminders sent!'
    });
  }

  onCancelAllUnpaid(): void {
    const confirmed = confirm('Are you sure you want to cancel ALL unpaid orders? This action cannot be undone.');
    if (confirmed) {
      // TODO: Implement API call to cancel all unpaid orders
      this.alertMessage.emit({
        type: 'success',
        text: 'All unpaid orders cancelled!'
      });
      this.orders = [];
    }
  }

  onDownloadCSV(): void {
    if (!this.selectedEvent || !this.orders.length) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No abandoned orders to export.'
      });
      return;
    }

    // Format data according to PHP format (pending tickets include status)
    const csvData = this.orders.map(order => [
      order.name,
      order.email_address,
      order.contact_number,
      order.number_of_entries.toString(),
      '', // Ticket code (empty for pending orders)
      '', // Notes column (empty in PHP version)
      order.status
    ]);

    const filename = `${this.selectedEvent.title.replace(/\s+/g, '_')}_tickets_pending.csv`;
    
    this.csvService.downloadCsv({
      title: `Abandoned orders for ${this.selectedEvent.title}`,
      headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Notes', 'Status'],
      data: csvData,
      filename: filename
    });

    this.alertMessage.emit({
      type: 'success',
      text: 'Abandoned orders CSV downloaded successfully!'
    });
  }

  enablePriceOverride(): void {
    this.priceOverrideEnabled = true;
  }

  onToggleMarkAsPaid(): void {
    if (this.customTicketForm.ticket_paid) {
      this.customTicketForm.send_email = false;
    } else {
      this.customTicketForm.payment_processing_fee = 0;
    }
  }

  onSubmitCustomTicket(): void {
    if (!this.selectedEvent) return;
    
    // Basic validation
    if (!this.customTicketForm.name || !this.customTicketForm.email_address || !this.customTicketForm.contact_number) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Please fill in all required fields.'
      });
      return;
    }

    if (this.customTicketForm.number_of_entries <= 0) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Number of entries must be greater than 0.'
      });
      return;
    }

    const ticketData = {
      event_id: this.selectedEvent.id,
      name: this.customTicketForm.name,
      email_address: this.customTicketForm.email_address,
      contact_number: this.customTicketForm.contact_number,
      number_of_entries: this.customTicketForm.number_of_entries,
      send_email: this.customTicketForm.send_email
    };
    
    this.subscriptions.add(
      this.eventService.addTicket(ticketData).subscribe({
        next: (response) => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Custom ticket created successfully!'
          });
          
          // If ticket is marked as paid, mark it as paid immediately
          if (this.customTicketForm.ticket_paid && response.ticket?.id) {
            this.subscriptions.add(
              this.eventService.markTicketPaid(response.ticket.id).subscribe({
                next: () => {
                  this.loadAbandonedOrders(); // Refresh data
                },
                error: (error) => {
                  console.error('Failed to mark custom ticket as paid:', error);
                }
              })
            );
          } else {
            // Refresh data to show new ticket
            this.loadAbandonedOrders();
          }
          
          this.resetCustomTicketForm();
        },
        error: (error) => {
          console.error('Failed to create custom ticket:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to create custom ticket'
          });
        }
      })
    );
  }

  resetCustomTicketForm(): void {
    this.customTicketForm = {
      name: '',
      email_address: '',
      contact_number: '',
      number_of_entries: 1,
      price_per_ticket: this.selectedEvent?.ticket_price || 0,
      referral_code: '',
      ticket_paid: false,
      payment_processing_fee: 0,
      send_email: true
    };
    this.priceOverrideEnabled = false;
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

  isEventClosed(): boolean {
    if (!this.selectedEvent || !this.selectedEvent.close_time) {
      return false;
    }
    
    const closeTime = new Date(this.selectedEvent.close_time);
    const now = new Date();
    
    return now > closeTime;
  }

  canCreateCustomTickets(): boolean {
    return this.isAdmin && !this.isEventClosed();
  }
}