import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EventTicket {
  id: number;
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  ticket_code: string;
  price_per_ticket: number;
  payment_processing_fee: number;
  referrer_name?: string;
  order_timestamp: string;
  number_of_claimed_entries: number;
  status: 'Ticket sent.' | 'Payment Confirmed' | 'New' | 'Canceled';
}

export interface TicketSummary {
  total_tickets_sold: number;
  total_revenue: number;
  total_processing_fee: number;
  net_revenue: number;
  platform_fee: number;
  grand_total: number;
}

@Component({
  selector: 'app-event-tickets-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-tickets-tab.component.html',
  styleUrl: './event-tickets-tab.component.scss'
})
export class EventTicketsTabComponent {
  @Input() tickets: EventTicket[] = [];
  @Input() summary: TicketSummary | null = null;
  @Input() isAdmin: boolean = false;
  @Input() loading: boolean = false;
  @Output() resendTicket = new EventEmitter<number>();
  @Output() cancelTicket = new EventEmitter<number>();
  @Output() downloadCSV = new EventEmitter<void>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  selectedTicketId: number | null = null;

  onResendTicket(ticketId: number): void {
    this.resendTicket.emit(ticketId);
  }

  onCancelTicket(ticketId: number): void {
    this.selectedTicketId = ticketId;
    // In a real implementation, this would open a confirmation modal
    const confirmed = confirm('WARNING: This ticket is already paid and sent to the customer. Are you sure you want to cancel this ticket?');
    if (confirmed) {
      this.cancelTicket.emit(ticketId);
    }
  }

  onDownloadCSV(): void {
    this.downloadCSV.emit();
  }

  getRowClass(ticket: EventTicket): string {
    return ticket.number_of_claimed_entries === ticket.number_of_entries ? 'text-muted' : '';
  }

  getTotalPaid(ticket: EventTicket): number {
    return ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed' 
      ? ticket.price_per_ticket * ticket.number_of_entries 
      : 0;
  }

  getProcessingFee(ticket: EventTicket): number {
    return ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed' 
      ? ticket.payment_processing_fee 
      : 0;
  }

  isTicketCancellable(ticket: EventTicket): boolean {
    return ticket.number_of_claimed_entries === 0 && this.isAdmin;
  }

  isTicketResendable(ticket: EventTicket): boolean {
    return ticket.number_of_claimed_entries < ticket.number_of_entries && this.isAdmin;
  }
}