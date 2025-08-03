import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket } from '../../../services/event.service';
import { CsvService } from '../../../services/csv.service';

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
export class EventTicketsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  tickets: EventTicket[] = [];
  summary: TicketSummary | null = null;
  loading = false;
  selectedTicketId: number | null = null;

  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private csvService: CsvService
  ) {}

  ngOnInit(): void {
    this.loadEventTickets();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadEventTickets();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEventTickets(): void {
    if (!this.selectedEvent) {
      this.tickets = [];
      this.summary = null;
      return;
    }

    this.loading = true;
    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id).subscribe({
        next: (tickets) => {
          // Convert API tickets to component format and filter confirmed tickets
          this.tickets = tickets
            .filter(ticket => (ticket.status != 'New' && ticket.status != 'Canceled'))
            .map(ticket => this.convertServiceTicketToComponentTicket(ticket));
          
          this.calculateTicketSummary();
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load event tickets:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to load event tickets'
          });
          this.loading = false;
        }
      })
    );
  }

  private convertServiceTicketToComponentTicket(ticket: ServiceEventTicket): EventTicket {
    return {
      id: ticket.id,
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
      number_of_entries: ticket.number_of_entries,
      ticket_code: ticket.ticket_code,
      price_per_ticket: ticket.price_per_ticket,
      payment_processing_fee: ticket.payment_processing_fee,
      order_timestamp: ticket.order_timestamp,
      number_of_claimed_entries: ticket.number_of_claimed_entries,
      status: this.normalizeTicketStatus(ticket.status)
    };
  }

  private normalizeTicketStatus(status: string): 'Ticket sent.' | 'Payment Confirmed' | 'New' | 'Canceled' {
    switch (status.toLowerCase()) {
      case 'ticket sent.':
      case 'ticket sent':
        return 'Ticket sent.';
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

  private calculateTicketSummary(): void {
    const confirmedTickets = this.tickets.filter(t => 
      t.status === 'Ticket sent.' || t.status === 'Payment Confirmed'
    );
    
    const totalTicketsSold = confirmedTickets.reduce((sum, ticket) => 
      sum + ticket.number_of_entries, 0
    );
    
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      const ticketRevenue = ticket.price_per_ticket * ticket.number_of_entries;
      return sum + ticketRevenue;
    }, 0);
    
    const totalProcessingFee = confirmedTickets.reduce((sum, ticket) => 
      sum + ticket.payment_processing_fee, 0
    );
    
    const netRevenue = totalRevenue - totalProcessingFee;
    const platformFee = netRevenue * 0.05; // 5% platform fee
    const grandTotal = netRevenue - platformFee;
    
    this.summary = {
      total_tickets_sold: totalTicketsSold,
      total_revenue: totalRevenue,
      total_processing_fee: totalProcessingFee,
      net_revenue: netRevenue,
      platform_fee: platformFee,
      grand_total: grandTotal
    };
  }

  onResendTicket(ticketId: number): void {
    this.subscriptions.add(
      this.eventService.resendTicket(ticketId).subscribe({
        next: () => {
          this.alertMessage.emit({
            type: 'success',
            text: 'Ticket resent successfully!'
          });
        },
        error: (error) => {
          console.error('Failed to resend ticket:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to resend ticket'
          });
        }
      })
    );
  }

  onCancelTicket(ticketId: number): void {
    this.selectedTicketId = ticketId;
    const confirmed = confirm('WARNING: This ticket is already paid and sent to the customer. Are you sure you want to cancel this ticket?');
    if (confirmed) {
      this.subscriptions.add(
        this.eventService.cancelTicket(ticketId).subscribe({
          next: () => {
            this.alertMessage.emit({
              type: 'success',
              text: 'Ticket cancelled successfully!'
            });
            // Remove ticket from list and recalculate summary
            this.tickets = this.tickets.filter(t => t.id !== ticketId);
            this.calculateTicketSummary();
          },
          error: (error) => {
            console.error('Failed to cancel ticket:', error);
            this.alertMessage.emit({
              type: 'error',
              text: 'Failed to cancel ticket'
            });
          }
        })
      );
    }
  }

  onDownloadCSV(): void {
    if (!this.selectedEvent || !this.tickets.length) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No tickets to export.'
      });
      return;
    }

    // Format data according to PHP format
    const csvData = this.tickets.map(ticket => [
      ticket.name,
      ticket.email_address,
      ticket.contact_number,
      ticket.number_of_entries.toString(),
      ticket.ticket_code,
      '' // Notes column (empty in PHP version)
    ]);

    const filename = `${this.selectedEvent.title.replace(/\s+/g, '_')}_tickets.csv`;
    
    this.csvService.downloadCsv({
      title: `Ticket list for ${this.selectedEvent.title}`,
      headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Notes'],
      data: csvData,
      filename: filename
    });

    this.alertMessage.emit({
      type: 'success',
      text: 'Tickets CSV downloaded successfully!'
    });
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