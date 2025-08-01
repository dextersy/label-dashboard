import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class EventAbandonedOrdersTabComponent {
  @Input() orders: AbandonedOrder[] = [];
  @Input() defaultTicketPrice: number = 0;
  @Input() isAdmin: boolean = false;
  @Input() loading: boolean = false;
  @Output() markAsPaid = new EventEmitter<number>();
  @Output() cancelOrder = new EventEmitter<number>();
  @Output() verifyPayments = new EventEmitter<void>();
  @Output() sendPaymentReminders = new EventEmitter<void>();
  @Output() cancelAllUnpaid = new EventEmitter<void>();
  @Output() createCustomTicket = new EventEmitter<CustomTicketForm>();
  @Output() downloadCSV = new EventEmitter<void>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

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

  ngOnInit(): void {
    this.customTicketForm.price_per_ticket = this.defaultTicketPrice;
  }

  onMarkAsPaid(orderId: number): void {
    this.markAsPaid.emit(orderId);
  }

  onCancelOrder(orderId: number): void {
    const confirmed = confirm('Are you sure you want to cancel this order?');
    if (confirmed) {
      this.cancelOrder.emit(orderId);
    }
  }

  onVerifyPayments(): void {
    this.verifyPayments.emit();
  }

  onSendPaymentReminders(): void {
    this.sendPaymentReminders.emit();
  }

  onCancelAllUnpaid(): void {
    const confirmed = confirm('Are you sure you want to cancel ALL unpaid orders? This action cannot be undone.');
    if (confirmed) {
      this.cancelAllUnpaid.emit();
    }
  }

  onDownloadCSV(): void {
    this.downloadCSV.emit();
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

    this.createCustomTicket.emit({ ...this.customTicketForm });
    this.resetCustomTicketForm();
  }

  resetCustomTicketForm(): void {
    this.customTicketForm = {
      name: '',
      email_address: '',
      contact_number: '',
      number_of_entries: 1,
      price_per_ticket: this.defaultTicketPrice,
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
}