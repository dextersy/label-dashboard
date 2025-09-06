import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket, EventReferrer } from '../../../services/event.service';
import { CsvService } from '../../../services/csv.service';
import { PaginatedTableComponent, TableColumn, PaginationInfo, SearchFilters, SortInfo } from '../../shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { TransferTicketModalComponent, TransferData } from '../transfer-ticket-modal/transfer-ticket-modal.component';

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
  date_paid?: string;
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
  imports: [CommonModule, PaginatedTableComponent, TransferTicketModalComponent],
  templateUrl: './event-tickets-tab.component.html',
  styleUrl: './event-tickets-tab.component.scss'
})
export class EventTicketsTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  @ViewChild('transferModal') transferModal!: TransferTicketModalComponent;

  tickets: EventTicket[] = [];
  summary: TicketSummary | null = null;
  referrers: EventReferrer[] = [];
  loading = false;
  bulkOperationsLoading = false;
  selectedTicketId: number | null = null;
  selectedTicketForTransfer: EventTicket | null = null;
  showTransferModal = false;

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
    { key: 'date_paid', label: 'Date Paid', sortable: true, type: 'date', formatter: (item) => item.date_paid ? new Date(item.date_paid).toLocaleString() : '-' },
    { key: 'claimed_status', label: 'Claimed', sortable: false, formatter: (item) => `${item.number_of_claimed_entries} / ${item.number_of_entries}` },
  ];

  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private csvService: CsvService,
    private authService: AuthService,
    private router: Router
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

    // Load referrers and summary first, then tickets
    this.loadEventReferrers();
    this.loadTicketSummary();
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

  private loadTicketSummary(): void {
    if (!this.selectedEvent) return;

    this.subscriptions.add(
      this.eventService.getEventTicketSummary(this.selectedEvent.id).subscribe({
        next: (summary) => {
          this.summary = summary;
        },
        error: (error) => {
          console.error('Failed to load ticket summary:', error);
          // Don't show error for summary - it's not critical for the page to work
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
      status_filter: 'sent',  // Only get "Ticket sent." tickets from backend
      filters: this.currentFilters
    };

    this.subscriptions.add(
      this.eventService.getEventTickets(this.selectedEvent.id, params).subscribe({
        next: (response) => {
          // Convert API tickets to component format
          this.tickets = response.tickets.map(ticket => this.convertServiceTicketToComponentTicket(ticket));
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
      date_paid: ticket.date_paid,
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


  onResendTicket(ticketId: number): void {
    this.bulkOperationsLoading = true;
    this.subscriptions.add(
      this.eventService.resendTicket(ticketId).subscribe({
        next: () => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: 'Ticket resent successfully!'
          });
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
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
      this.bulkOperationsLoading = true;
      this.subscriptions.add(
        this.eventService.cancelTicket(ticketId).subscribe({
          next: () => {
            this.bulkOperationsLoading = false;
            this.alertMessage.emit({
              type: 'success',
              text: 'Ticket cancelled successfully!'
            });
            // Remove ticket from list and reload summary from backend
            this.tickets = this.tickets.filter(t => t.id !== ticketId);
            this.loadTicketSummary();
          },
          error: (error) => {
            this.bulkOperationsLoading = false;
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
    if (!this.selectedEvent) {
      this.alertMessage.emit({
        type: 'error',
        text: 'No event selected.'
      });
      return;
    }

    // Use the new export endpoint to get ALL tickets
    this.subscriptions.add(
      this.eventService.exportEventTicketsCsv(this.selectedEvent.id).subscribe({
        next: (response) => {
          if (!response.tickets.length) {
            this.alertMessage.emit({
              type: 'error',
              text: 'No tickets to export.'
            });
            return;
          }

          // Format data according to PHP format using ALL tickets from export
          const csvData = response.tickets.map(ticket => [
            ticket.name,
            ticket.email_address,
            ticket.contact_number || '',
            ticket.number_of_entries.toString(),
            ticket.ticket_code,
            ticket.referrer_name || '', // Include referrer info
            '' // Notes column (empty in PHP version)
          ]);

          const filename = `${response.event_title.replace(/\s+/g, '_')}_tickets.csv`;
          
          this.csvService.downloadCsv({
            title: `Ticket list for ${response.event_title}`,
            headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Referred By', 'Notes'],
            data: csvData,
            filename: filename
          });

          this.alertMessage.emit({
            type: 'success',
            text: `${response.total_count} tickets exported successfully!`
          });
        },
        error: (error) => {
          console.error('Failed to export tickets:', error);
          this.alertMessage.emit({
            type: 'error',
            text: 'Failed to export tickets CSV'
          });
        }
      })
    );
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

  isTicketTransferable(ticket: EventTicket): boolean {
    return (ticket.status === 'Ticket sent.') && Number(ticket.number_of_claimed_entries) === 0 && !!this.isAdmin;
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
      queryParams: { eventId: this.selectedEvent.id, from: 'tickets' }
    });
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

  onTransferTicket(ticket: EventTicket): void {
    this.selectedTicketForTransfer = ticket;
    this.showTransferModal = true;
    this.transferModal.showModal(ticket);
  }

  onTransferConfirmed(transferData: TransferData): void {
    if (!this.selectedTicketForTransfer) {
      this.transferModal.setLoading(false);
      this.alertMessage.emit({
        type: 'error',
        text: 'No ticket selected for transfer'
      });
      return;
    }

    // We need to add the event_id to the ticket object for the service
    const ticketWithEventId = {
      ...this.selectedTicketForTransfer,
      event_id: this.selectedEvent?.id
    };

    this.subscriptions.add(
      this.eventService.transferTicket(ticketWithEventId, transferData).subscribe({
        next: (response) => {
          this.transferModal.setLoading(false);
          this.showTransferModal = false;
          this.transferModal.hide();
          
          this.alertMessage.emit({
            type: 'success',
            text: `Ticket transferred successfully! New ticket code: ${response.new_ticket_code}`
          });

          // Refresh the entire tickets table to show the new ticket and remove the canceled one
          this.loadEventTickets(this.pagination?.current_page || 1);
          this.loadTicketSummary();
          this.selectedTicketForTransfer = null;
        },
        error: (error) => {
          this.transferModal.setLoading(false);
          console.error('Failed to transfer ticket:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error.error?.error || 'Failed to transfer ticket'
          });
        }
      })
    );
  }

  // Helper methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}