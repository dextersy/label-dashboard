import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EventService, Event, EventTicket as ServiceEventTicket, EventReferrer } from '../../../../services/event.service';
import { CsvService } from '../../../../services/csv.service';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { PaginatedTableComponent, TableColumn, TableAction, HeaderAction, PaginationInfo, SearchFilters, SortInfo } from '../../../../components/shared/paginated-table/paginated-table.component';
import { AuthService } from '../../../../services/auth.service';
import { environment } from '../../../../../environments/environment';
import { TransferTicketModalComponent, TransferData } from '../transfer-ticket-modal/transfer-ticket-modal.component';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

export interface EventTicket {
  id: number;
  name: string;
  email_address: string;
  contact_number: string;
  number_of_entries: number;
  ticket_code: string;
  price_per_ticket: number;
  payment_processing_fee: number;
  platform_fee?: number;
  payment_id?: string;
  ticket_type_id?: number;
  referrer_name?: string;
  order_timestamp: string;
  date_paid?: string;
  number_of_claimed_entries: number;
  status: 'Ticket sent.' | 'Payment Confirmed' | 'New' | 'Canceled' | 'Refunded';
  ticket_type_name?: string;
  ticket_type_day_ids?: number[];
  scanLogs?: { id: number; ticket_id: number; event_day_id: number; entries_claimed: number; scanned_at: string; eventDay?: { id: number; date_and_time: string; label?: string | null } }[];
}

export interface TicketSummary {
  total_tickets_sold: number;
  total_checked_in: number;
  total_revenue: number;
  total_processing_fee: number;
  net_revenue: number;
  platform_fee: number;
  grand_total: number;
  tax: number;
  admin_grand_total: number;
  by_ticket_type?: { name: string; revenue: number }[];
  checked_in_by_day?: { day_id: number; label: string | null; date: string; count: number; valid_tickets: number }[];
}

@Component({
    selector: 'app-event-tickets-tab',
    imports: [CommonModule, FormsModule, PaginatedTableComponent, TransferTicketModalComponent, IconComponent],
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

  // Revenue breakdown expand state
  grossSalesByTypeExpanded = false;

  // Pagination properties
  pagination: PaginationInfo | null = null;
  currentSort: SortInfo | null = null;
  currentFilters: SearchFilters = {};

  // Table configuration
  tableColumns: TableColumn[] = [
    { key: 'ticket_code', label: 'Ticket Code', searchable: true, sortable: true, cardHeader: true, renderHtml: true,
      formatter: (item) => {
        if (!item.ticket_code) return '—';
        const { bg, color } = this.getTicketTypeColor(item.ticket_type_name);
        return `<span style="font-size:0.95rem;font-weight:600;letter-spacing:0.05em;background:${bg};border-radius:4px;padding:2px 8px;color:${color};white-space:nowrap;user-select:text">${item.ticket_code}</span>`;
      }
    },
    { key: 'email_address', label: 'Email Address', searchable: true, hidden: true },
    { key: 'contact_number', label: 'Contact Number', searchable: true, hidden: true },
    { key: 'name', label: 'Attendee', searchable: true, sortable: true, renderHtml: true,
      formatter: (item) => {
        const initials = this.getInitials(item.name);
        const idx = this.getAvatarColorIndex(item.name);
        const iconStyle = `display:inline-block;vertical-align:-0.125em;margin-right:4px;color:#d1d5db`;
        const envelopeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${iconStyle}"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>`;
        const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${iconStyle}"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.12 6.12l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
        const sub = [
          item.email_address ? `<span style="display:flex;align-items:center;font-size:0.85rem;color:#6b7280;margin-top:1px">${envelopeSvg}${this.esc(item.email_address)}</span>` : '',
          item.contact_number ? `<span style="display:flex;align-items:center;font-size:0.85rem;color:#6b7280;margin-top:1px">${phoneSvg}${this.esc(item.contact_number)}</span>` : ''
        ].filter(Boolean).join('');
        return `<span class="avatar-chip"><span class="avatar-chip__circle ac-${idx}">${this.esc(initials)}</span><span>${this.esc(item.name)}${sub}</span></span>`;
      }
    },
    { key: 'claimed_status', label: 'Claimed / Seats', sortable: false, renderHtml: true, minWidth: '200px', formatter: (item) => {
      const days = this.selectedEvent?.days;
      if (!days || days.length <= 1) {
        return this.claimCircleSvg(item.number_of_claimed_entries, item.number_of_entries);
      }
      const circles = days.map((day: any, i: number) => {
        const label = day.label || `Day ${i + 1}`;
        const validForDay = !item.ticket_type_day_ids || item.ticket_type_day_ids.length === 0 || item.ticket_type_day_ids.includes(day.id);
        if (!validForDay) return this.claimCircleNa(label);
        const log = (item.scanLogs || []).find((l: any) => l.event_day_id === day.id);
        const claimed = log?.entries_claimed ?? 0;
        return this.claimCircleSvg(claimed, item.number_of_entries, label);
      }).join('');
      return `<div style="display:flex;flex-wrap:wrap;gap:4px">${circles}</div>`;
    }},
    { key: 'ticket_type_name', label: 'Ticket Type', searchable: true, sortable: true, renderHtml: true, formatter: (item) => {
      const name = item.ticket_type_name || 'Regular';
      const { bg, color } = this.getTicketTypeColor(name);
      return `<span style="font-size:0.95rem;font-weight:600;background:${bg};border-radius:4px;padding:2px 8px;color:${color};white-space:nowrap">${this.esc(name)}</span>`;
    }},
    { key: 'total_paid', label: 'Total Paid', sortable: false, type: 'number', align: 'right', formatter: (item) => item.status === 'Refunded' ? 'Refunded' : (this.getTotalPaid(item) > 0 ? this.formatCurrency(this.getTotalPaid(item)) : '-') },
    { key: 'platform_fee', label: 'Platform Fee', sortable: false, type: 'number', align: 'right', formatter: (item) => this.getPlatformFee(item) > 0 ? this.formatCurrency(this.getPlatformFee(item)) : '-' },
    { key: 'referrer_name', label: 'Referred By', searchable: true, sortable: true },
    { key: 'order_timestamp', label: 'Time Ordered', sortable: true, renderHtml: true, formatter: (item) => {
      if (!item.order_timestamp) return '-';
      const full = new Date(item.order_timestamp).toLocaleString();
      return `<span title="${full}" style="cursor:default">${this.timeAgo(item.order_timestamp)}</span>`;
    }},
    { key: 'date_paid', label: 'Date Paid', sortable: true, renderHtml: true, formatter: (item) => {
      if (!item.date_paid) return '-';
      const full = new Date(item.date_paid).toLocaleString();
      return `<span title="${full}" style="cursor:default">${this.timeAgo(item.date_paid)}</span>`;
    }},
  ];

  get headerActions(): HeaderAction[] {
    const actions: HeaderAction[] = [];
    if (this.isAdmin) {
      actions.push({
        icon: 'plus',
        label: 'Custom Ticket',
        handler: () => this.onCreateCustomTicket(),
        disabled: () => this.loading || !this.canCreateCustomTickets(),
        title: () => this.getCustomTicketButtonTooltip(),
      });
    }
    actions.push({
      icon: 'download',
      label: 'Download CSV',
      handler: () => this.onDownloadCSV(),
      disabled: () => this.loading,
    });
    return actions;
  }

  ticketActions: TableAction[] = [
    {
      icon: 'envelope',
      label: 'Resend',
      hidden: (item) => !this.isTicketResendable(item),
      handler: (item) => this.onResendTicket(item.id)
    },
    {
      icon: 'transfer',
      label: 'Transfer',
      hidden: (item) => !this.isTicketTransferable(item),
      handler: (item) => this.onTransferTicket(item)
    },
    {
      icon: 'undo',
      label: 'Refund',
      hidden: (item) => !this.isTicketRefundable(item),
      handler: (item) => this.onRefundTicket(item.id)
    },
    {
      icon: 'ban',
      label: 'Cancel',
      type: 'danger',
      hidden: (item) => !this.isTicketCancellable(item),
      handler: (item) => this.onCancelTicket(item.id)
    }
  ];

  private subscriptions = new Subscription();

  constructor(
    private eventService: EventService,
    private csvService: CsvService,
    private authService: AuthService,
    private router: Router,
    private confirmationService: ConfirmationService,
    private sanitizer: DomSanitizer
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
          this.ticketTypeColorMap.clear();
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
      platform_fee: ticket.platform_fee ? Number(ticket.platform_fee) : undefined,
      payment_id: ticket.payment_id,
      ticket_type_id: ticket.ticket_type_id,
      referrer_name: referrerName,
      order_timestamp: ticket.order_timestamp,
      date_paid: ticket.date_paid,
      number_of_claimed_entries: Number(ticket.number_of_claimed_entries) || 0,
      status: this.normalizeTicketStatus(ticket.status),
      ticket_type_name: ticket.ticketType?.name,
      ticket_type_day_ids: ticket.ticketType?.days?.map((d: any) => d.id),
      scanLogs: ticket.scanLogs
    };
  }

  private normalizeTicketStatus(status: string): 'Ticket sent.' | 'Payment Confirmed' | 'New' | 'Canceled' | 'Refunded' {
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
      case 'refunded':
        return 'Refunded';
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

  async onCancelTicket(ticketId: number): Promise<void> {
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
    let confirmTitle = 'Cancel Ticket';
    let confirmType: 'danger' | 'warning' = 'warning';
    let confirmWarning: string | undefined;

    if (ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed') {
      confirmWarning = 'This ticket is already paid and sent to the customer. The customer will receive a cancellation email.';
      confirmType = 'danger';
    }

    const confirmed = await this.confirmationService.confirm({
      title: confirmTitle,
      message: 'Are you sure you want to cancel this ticket?',
      warning: confirmWarning,
      confirmText: 'Cancel Ticket',
      cancelText: 'Keep Ticket',
      type: confirmType
    });

    if (!confirmed) return;

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

  async onRefundTicket(ticketId: number): Promise<void> {
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

    const confirmed = await this.confirmationService.confirm({
      title: 'Refund Ticket',
      message: 'Are you sure you want to refund this ticket? This will process a refund through Paymongo and return the ticket price to the customer.',
      warning: 'Platform fees and processing fees will be RETAINED and NOT refunded. This action cannot be undone.',
      confirmText: 'Refund Ticket',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    this.bulkOperationsLoading = true;
    this.subscriptions.add(
      this.eventService.refundTicket(ticketId).subscribe({
        next: () => {
          this.bulkOperationsLoading = false;
          this.alertMessage.emit({
            type: 'success',
            text: 'Ticket refunded successfully!'
          });
          // Update ticket status in list and reload summary
          const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);
          if (ticketIndex !== -1) {
            this.tickets[ticketIndex].status = 'Refunded';
          }
          this.loadTicketSummary();
        },
        error: (error) => {
          this.bulkOperationsLoading = false;
          console.error('Failed to refund ticket:', error);
          this.alertMessage.emit({
            type: 'error',
            text: error.error?.error || 'Failed to refund ticket'
          });
        }
      })
    );
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
            ticket.ticket_type || '',
            ticket.scanner_instructions || '',
            ticket.referrer_name || '',
            '' // Notes column (empty in PHP version)
          ]);

          const filename = `${response.event_title.replace(/\s+/g, '_')}_tickets.csv`;

          this.csvService.downloadCsv({
            title: `Ticket list for ${response.event_title}`,
            headers: ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Ticket Type', 'Scanner Instructions', 'Referred By', 'Notes'],
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
    if (ticket.status === 'Refunded') {
      return 'text-muted';
    }
    return Number(ticket.number_of_claimed_entries) === Number(ticket.number_of_entries) ? 'text-muted' : '';
  }

  getTotalPaid(ticket: EventTicket): number {
    return ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed' 
      ? ticket.price_per_ticket * ticket.number_of_entries 
      : 0;
  }

  getProcessingFee(ticket: EventTicket): number {
    return ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed' || ticket.status === 'Refunded'
      ? ticket.payment_processing_fee
      : 0;
  }

  getPlatformFee(ticket: EventTicket): number {
    return ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed' || ticket.status === 'Refunded'
      ? (ticket.platform_fee || 0)
      : 0;
  }

  isTicketCancellable(ticket: EventTicket): boolean {
    return !this.isEventPast()
      && ticket.status !== 'Refunded'
      && Number(ticket.number_of_claimed_entries) === 0
      && !!this.isAdmin;
  }

  isTicketRefundable(ticket: EventTicket): boolean {
    return !this.isEventPast()
      && (ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.')
      && Number(ticket.number_of_claimed_entries) === 0
      && !!ticket.payment_id
      && !!this.isAdmin;
  }

  isTicketResendable(ticket: EventTicket): boolean {
    // Allow resend even if event is past, but only if not all entries claimed
    return ticket.status !== 'Refunded'
      && Number(ticket.number_of_claimed_entries) < Number(ticket.number_of_entries)
      && !!this.isAdmin;
  }

  isTicketTransferable(ticket: EventTicket): boolean {
    // Allow transfer even if event is past, but only if no entries claimed
    return ticket.status === 'Ticket sent.'
      && Number(ticket.number_of_claimed_entries) === 0
      && !!this.isAdmin;
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

    this.router.navigate(['/campaigns/events/custom-ticket'], {
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

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarColorIndex(name: string): number {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 8;
  }

  private readonly avatarColors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];

  private readonly ticketTypePalette = [
    { bg: '#ede9fe', color: '#5b21b6' }, // violet
    { bg: '#dbeafe', color: '#1e40af' }, // blue
    { bg: '#dcfce7', color: '#166534' }, // green
    { bg: '#fef3c7', color: '#92400e' }, // amber
    { bg: '#fce7f3', color: '#9d174d' }, // pink
    { bg: '#ccfbf1', color: '#0f766e' }, // teal
    { bg: '#fee2e2', color: '#991b1b' }, // red
    { bg: '#e0f2fe', color: '#075985' }, // sky
    { bg: '#fef9c3', color: '#854d0e' }, // yellow
    { bg: '#f3e8ff', color: '#7e22ce' }, // purple
    { bg: '#d1fae5', color: '#065f46' }, // emerald
    { bg: '#ffedd5', color: '#9a3412' }, // orange
    { bg: '#e0e7ff', color: '#3730a3' }, // indigo
    { bg: '#fdf2f8', color: '#86198f' }, // fuchsia
    { bg: '#f0fdf4', color: '#14532d' }, // lime
  ];

  private ticketTypeColorMap = new Map<string, { bg: string; color: string }>();

  getTicketTypeColor(ticketTypeName: string): { bg: string; color: string } {
    const name = ticketTypeName || 'Regular';
    if (!this.ticketTypeColorMap.has(name)) {
      const idx = this.ticketTypeColorMap.size % this.ticketTypePalette.length;
      this.ticketTypeColorMap.set(name, this.ticketTypePalette[idx]);
    }
    return this.ticketTypeColorMap.get(name)!;
  }

  getAvatarColor(name: string): string {
    return this.avatarColors[this.getAvatarColorIndex(name)];
  }

  getClaimCirclesHtml(ticket: EventTicket): SafeHtml {
    const days = this.selectedEvent?.days;
    let html: string;
    if (!days || days.length <= 1) {
      html = this.claimCircleSvg(ticket.number_of_claimed_entries, ticket.number_of_entries);
    } else {
      const circles = days.map((day: any, i: number) => {
        const label = day.label || `Day ${i + 1}`;
        const validForDay = !ticket.ticket_type_day_ids || ticket.ticket_type_day_ids.length === 0 || ticket.ticket_type_day_ids.includes(day.id);
        if (!validForDay) return this.claimCircleNa(label);
        const log = (ticket.scanLogs || []).find((l: any) => l.event_day_id === day.id);
        const claimed = log?.entries_claimed ?? 0;
        return this.claimCircleSvg(claimed, ticket.number_of_entries, label);
      }).join('');
      html = `<div style="display:flex;flex-wrap:wrap;gap:4px">${circles}</div>`;
    }
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private claimCircleSvg(claimed: number, total: number, label?: string): string {
    const r = 16, cx = 22, cy = 22, size = 44;
    const circumference = 2 * Math.PI * r;
    const progress = total > 0 ? Math.min(claimed / total, 1) : 0;
    const offset = circumference * (1 - progress);
    const stroke = claimed >= total && total > 0 ? '#10b981' : 'var(--brand-color, #3b82f6)';
    const labelHtml = label
      ? `<div style="font-size:0.6rem;color:#9ca3af;text-align:center;margin-bottom:1px;max-width:${size}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>`
      : '';
    return `<div style="display:inline-flex;flex-direction:column;align-items:center">
      ${labelHtml}
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="3.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="3.5"
          stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          style="font-size:9px;font-weight:700;fill:#111827">${claimed}/${total}</text>
      </svg>
    </div>`;
  }

  private claimCircleNa(label?: string): string {
    const cx = 22, cy = 22, size = 44, r = 16;
    const labelHtml = label
      ? `<div style="font-size:0.6rem;color:#d1d5db;text-align:center;margin-bottom:1px;max-width:${size}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>`
      : '';
    return `<div style="display:inline-flex;flex-direction:column;align-items:center">
      ${labelHtml}
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="3.5" stroke-dasharray="4 4"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          style="font-size:8px;font-weight:600;fill:#d1d5db">N/A</text>
      </svg>
    </div>`;
  }

  timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  private esc(s: string | null | undefined): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Helper methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
}