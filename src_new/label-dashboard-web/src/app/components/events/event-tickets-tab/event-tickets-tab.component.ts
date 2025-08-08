import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket, EventReferrer } from '../../../services/event.service';
import { CsvService } from '../../../services/csv.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

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
  tax: number;
  admin_grand_total: number;
}

@Component({
  selector: 'app-event-tickets-tab',
  standalone: true,
  imports: [CommonModule, PaginatedTableComponent],
  templateUrl: './event-tickets-tab.component.html',
  styleUrl: './event-tickets-tab.component.scss'
})
export class EventTicketsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  tickets: EventTicket[] = [];
  summary: TicketSummary | null = null;
  referrers: EventReferrer[] = [];
  loading = false;
  selectedTicketId: number | null = null;

  // Pagination properties
  pagination: PaginationInfo | null = null;
  currentSort: SortInfo | null = null;
  currentFilters: SearchFilters = {};

  // Table configuration
  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Name', searchable: true, sortable: true },
    { key: 'email_address', label: 'Email Address', searchable: true, sortable: true },
    { key: 'contact_number', label: 'Contact Number', searchable: true, sortable: true },
    { key: 'number_of_entries', label: 'No. of Tickets', searchable: true, sortable: true, type: 'number', align: 'center' },
    { key: 'ticket_code', label: 'Ticket Code', searchable: true, sortable: true },
    { key: 'total_paid', label: 'Total Paid', sortable: false, type: 'number', align: 'right', formatter: (item) => this.getTotalPaid(item) > 0 ? this.formatCurrency(this.getTotalPaid(item)) : '-' },
    { key: 'processing_fee', label: 'Processing Fee', sortable: false, type: 'number', align: 'right', formatter: (item) => this.getProcessingFee(item) > 0 ? this.formatCurrency(this.getProcessingFee(item)) : '-' },
    { key: 'referrer_name', label: 'Referred By', searchable: true, sortable: true },
    { key: 'order_timestamp', label: 'Time Ordered', sortable: true, type: 'date' },
    { key: 'claimed_status', label: 'Claimed', sortable: false, formatter: (item) => `${item.number_of_claimed_entries} / ${item.number_of_entries}` },
  ];

  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private csvService: CsvService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadEventData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent']) {
      this.loadEventData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadEventData(): void {
    if (!this.selectedEvent) {
      this.tickets = [];
      this.summary = null;
      this.pagination = null;
      this.referrers = [];
      return;
    }

    // Load referrers first, then tickets
    this.loadEventReferrers();
  }

  private loadEventReferrers(): void {
    if (!this.selectedEvent) return;

    this.subscriptions.add(
      this.eventService.getEventReferrers(this.selectedEvent.id).subscribe({
        next: (referrers) => {
          this.referrers = referrers;
          this.loadEventTickets(); // Load tickets after referrers are loaded
        },
        error: (error) => {
          console.error('Failed to load event referrers:', error);
          this.referrers = [];
          this.loadEventTickets(); // Continue loading tickets even if referrers fail
        }
      })
    );
  }

  private loadEventTickets(page: number = 1): void {
    if (!this.selectedEvent) {
      this.tickets = [];
      this.summary = null;
      this.pagination = null;
      return;
    }

    this.loading = true;
    
    const params = {
      page,
      per_page: 20,
      sort_column: this.currentSort?.column,
      sort_direction: this.currentSort?.direction,
      filters: this.currentFilters
    };

    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id, params).subscribe({
        next: (response) => {
          // Convert API tickets to component format - include all confirmed tickets for summary calculation
          const allTickets = response.tickets.map(ticket => this.convertServiceTicketToComponentTicket(ticket));
          
          // Filter for display (only "Ticket sent." status)
          this.tickets = allTickets.filter(ticket => ticket.status === 'Ticket sent.');
          
          // Calculate summary using all confirmed tickets (not just the filtered display tickets)
          this.calculateTicketSummary(allTickets);
          this.pagination = response.pagination;
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
    // Find referrer name by referrer_id
    let referrerName = '';
    if (ticket.referrer_id) {
      const referrer = this.referrers.find(r => r.id === ticket.referrer_id);
      referrerName = referrer ? referrer.name : `ID: ${ticket.referrer_id}`;
    }

    return {
      id: ticket.id,
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
      number_of_entries: Number(ticket.number_of_entries) || 0,
      ticket_code: ticket.ticket_code,
      price_per_ticket: Number(ticket.price_per_ticket) || 0,
      payment_processing_fee: Number(ticket.payment_processing_fee) || 0,
      referrer_name: referrerName,
      order_timestamp: ticket.order_timestamp,
      number_of_claimed_entries: Number(ticket.number_of_claimed_entries) || 0,
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

  private calculateTicketSummary(tickets: EventTicket[] = this.tickets): void {
    const confirmedTickets = tickets.filter(t => 
      t.status === 'Ticket sent.' || t.status === 'Payment Confirmed'
    );
    
    // Count only "Ticket sent." tickets (matching PHP: if($ticket->status == 'Ticket sent.'))
    const totalTicketsSold = tickets
      .filter(t => t.status === 'Ticket sent.')
      .reduce((sum, ticket) => sum + ticket.number_of_entries, 0);
    
    // Calculate total revenue from confirmed/sent tickets
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      const price = Number(ticket.price_per_ticket) || 0;
      const entries = Number(ticket.number_of_entries) || 0;
      const ticketRevenue = price * entries;
      return sum + ticketRevenue;
    }, 0);
    
    // Calculate total processing fees from confirmed/sent tickets
    const totalProcessingFee = confirmedTickets.reduce((sum, ticket) => {
      const fee = Number(ticket.payment_processing_fee) || 0;
      return sum + fee;
    }, 0);
    
    // Platform fee is 5% of total revenue (matching PHP: $total_sold * .05)
    const platformFee = Number((totalRevenue * 0.05).toFixed(2)) || 0;
    
    // Grand total after platform fee (matching PHP: $total_sold * .95)
    const grandTotal = Number((totalRevenue * 0.95).toFixed(2)) || 0;
    
    // Net revenue after processing fees (for admin view)
    const netRevenue = Number((totalRevenue - totalProcessingFee).toFixed(2)) || 0;
    
    // Tax calculation (0.5% of net revenue, matching PHP: ($total_sold - $total_processing_fee)*.005)
    const tax = Number((netRevenue * 0.005).toFixed(2)) || 0;
    
    // Admin grand total after processing fees and tax (matching PHP: ($total_sold - $total_processing_fee)*.995)
    const adminGrandTotal = Number((netRevenue * 0.995).toFixed(2)) || 0;
    
    // Log debug info only in development
    if (!environment.production) {
      console.log('Ticket Summary Calculated:', {
        confirmedTicketsCount: confirmedTickets.length,
        totalTicketsSold,
        totalRevenue,
        totalProcessingFee,
        netRevenue,
        tax,
        platformFee,
        grandTotal,
        adminGrandTotal
      });
    }
    
    this.summary = {
      total_tickets_sold: totalTicketsSold,
      total_revenue: totalRevenue,
      total_processing_fee: totalProcessingFee,
      net_revenue: netRevenue,
      platform_fee: platformFee,
      grand_total: grandTotal,
      tax: tax,
      admin_grand_total: adminGrandTotal
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
    
    // Find the ticket to get its status
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      this.alertMessage.emit({
        type: 'error',
        text: 'Ticket not found'
      });
      return;
    }

    // Show different confirmation messages based on ticket status
    let confirmMessage = '';
    if (ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed') {
      confirmMessage = 'WARNING: This ticket is already paid and sent to the customer. The customer will receive a cancellation email. Are you sure you want to cancel this ticket?';
    } else {
      confirmMessage = 'Are you sure you want to cancel this ticket?';
    }

    const confirmed = confirm(confirmMessage);
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
      ticket.referrer_name || '', // Include referrer info
      '' // Notes column (empty in PHP version)
    ]);

    const filename = `${this.selectedEvent.title.replace(/\s+/g, '_')}_tickets.csv`;
    
    this.csvService.downloadCsv({
      title: `Ticket list for ${this.selectedEvent.title}`,
      headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Referred By', 'Notes'],
      data: csvData,
      filename: filename
    });

    this.alertMessage.emit({
      type: 'success',
      text: 'Tickets CSV downloaded successfully!'
    });
  }

  getRowClass(ticket: EventTicket): string {
    return Number(ticket.number_of_claimed_entries) === Number(ticket.number_of_entries) ? 'text-muted' : '';
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
    return Number(ticket.number_of_claimed_entries) === 0 && !!this.isAdmin;
  }

  isTicketResendable(ticket: EventTicket): boolean {
    return Number(ticket.number_of_claimed_entries) < Number(ticket.number_of_entries) && !!this.isAdmin;
  }

  isSuperadmin(): boolean {
    return this.authService.isSuperadmin();
  }

  // Pagination event handlers
  onPageChange(page: number): void {
    this.loadEventTickets(page);
  }

  onFiltersChange(filters: SearchFilters): void {
    this.currentFilters = filters;
    this.loadEventTickets(1); // Reset to page 1 when filtering
  }

  onSortChange(sortInfo: SortInfo | null): void {
    this.currentSort = sortInfo;
    this.loadEventTickets(1); // Reset to page 1 when sorting
  }

  // Helper methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}