import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, Event } from '../../../services/event.service';

export interface TicketType {
  id?: number;
  event_id: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: string | null;
  end_date?: string | null;
  showDateRange?: boolean; // UI state
  isFree?: boolean; // UI state - whether ticket is free
}

@Component({
    selector: 'app-ticket-types',
    imports: [CommonModule, FormsModule],
    templateUrl: './ticket-types.component.html',
    styleUrls: ['./ticket-types.component.scss']
})
export class TicketTypesComponent implements OnInit, OnChanges {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin: boolean = false;
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();
  @Output() ticketTypesChanged = new EventEmitter<boolean>();

  ticketTypes: TicketType[] = [];
  newTicketType: { name: string; price: number; max_tickets: number; start_date?: string | null; end_date?: string | null; showDateRange?: boolean; isFree?: boolean } = {
    name: '',
    price: 0,
    max_tickets: 0,
    start_date: null,
    end_date: null,
    showDateRange: false,
    isFree: false
  };
  loading = false;
  creating = false;
  updating = false;
  deleting = false;

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadTicketTypes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent'] && this.selectedEvent) {
      this.loadTicketTypes();
    }
  }

  private loadTicketTypes(): void {
    if (!this.selectedEvent) {
      this.ticketTypes = [];
      return;
    }

    this.loading = true;
    this.eventService.getTicketTypes(this.selectedEvent.id).subscribe({
      next: (response) => {
        this.ticketTypes = (response.ticketTypes || []).map(tt => ({
          ...tt,
          showDateRange: false, // Always start collapsed
          isFree: tt.price === 0 // Set isFree based on price
        }));
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load ticket types:', error);
        this.alertMessage.emit({
          type: 'error',
          text: 'Failed to load ticket types'
        });
        this.loading = false;
      }
    });
  }

  createTicketType(): void {

    if (!this.selectedEvent || !this.newTicketType.name.trim() || (!this.newTicketType.isFree && this.newTicketType.price < 0)) {
      return;
    }

    this.creating = true;

    const ticketTypeData: any = {
      event_id: this.selectedEvent.id,
      name: this.newTicketType.name.trim(),
      price: this.newTicketType.isFree ? 0 : Number(this.newTicketType.price),
      max_tickets: Number(this.newTicketType.max_tickets)
    };

    // Only include dates if they're set, format them for API
    if (this.newTicketType.start_date) {
      ticketTypeData.start_date = this.formatDateForAPI(this.newTicketType.start_date);
    }
    if (this.newTicketType.end_date) {
      ticketTypeData.end_date = this.formatDateForAPI(this.newTicketType.end_date);
    }

    this.eventService.createTicketType(ticketTypeData).subscribe({
      next: (response) => {
        this.ticketTypes.push({
          ...response.ticketType,
          isFree: response.ticketType.price === 0, // Set isFree based on price
          showDateRange: false
        });
        this.newTicketType = {
          name: '',
          price: 0,
          max_tickets: 0,
          start_date: null,
          end_date: null,
          showDateRange: false,
          isFree: false
        };
        this.alertMessage.emit({
          type: 'success',
          text: 'Ticket type created successfully!'
        });
        this.ticketTypesChanged.emit(true);
        this.creating = false;
      },
      error: (error) => {
        console.error('Failed to create ticket type:', error);
        this.alertMessage.emit({
          type: 'error',
          text: error.message || 'Failed to create ticket type'
        });
        this.creating = false;
      }
    });
  }

  updateTicketType(ticketType: TicketType): void {
    if (!ticketType.id || !ticketType.name || (!ticketType.isFree && (ticketType.price ?? -1) < 0)) {
      return;
    }

    this.updating = true;

    const updateData: any = {
      name: ticketType.name.trim(),
      price: ticketType.isFree ? 0 : Number(ticketType.price),
      max_tickets: Number(ticketType.max_tickets)
    };

    // Include dates in update, format them for API
    updateData.start_date = ticketType.start_date ? this.formatDateForAPI(ticketType.start_date) : null;
    updateData.end_date = ticketType.end_date ? this.formatDateForAPI(ticketType.end_date) : null;

    this.eventService.updateTicketType(ticketType.id, updateData).subscribe({
      next: (response) => {
        // Update the ticket type in the list
        const index = this.ticketTypes.findIndex(t => t.id === ticketType.id);
        if (index !== -1) {
          this.ticketTypes[index] = {
            ...response.ticketType,
            isFree: response.ticketType.price === 0, // Preserve isFree state based on price
            showDateRange: this.ticketTypes[index].showDateRange // Preserve UI state
          };
        }
        this.alertMessage.emit({
          type: 'success',
          text: 'Ticket type updated successfully!'
        });
        this.ticketTypesChanged.emit(true);
        this.updating = false;
      },
      error: (error) => {
        console.error('Failed to update ticket type:', error);
        this.alertMessage.emit({
          type: 'error',
          text: error.message || 'Failed to update ticket type'
        });
        this.updating = false;
      }
    });
  }

  deleteTicketType(ticketType: TicketType, index: number): void {
    if (!ticketType.id) {
      return;
    }

    const confirmation = confirm(
      `Are you sure you want to delete the "${ticketType.name}" ticket type?\n\n` +
      'This action cannot be undone and will fail if there are existing tickets of this type.'
    );

    if (!confirmation) return;

    this.deleting = true;

    this.eventService.deleteTicketType(ticketType.id).subscribe({
      next: () => {
        this.ticketTypes.splice(index, 1);
        this.alertMessage.emit({
          type: 'success',
          text: 'Ticket type deleted successfully!'
        });
        this.ticketTypesChanged.emit(true);
        this.deleting = false;
      },
      error: (error) => {
        console.error('Failed to delete ticket type:', error);
        this.alertMessage.emit({
          type: 'error',
          text: error.message || 'Failed to delete ticket type'
        });
        this.deleting = false;
      }
    });
  }

  // Public method to get current ticket types (for parent components if needed)
  getTicketTypes(): TicketType[] {
    return [...this.ticketTypes];
  }

  // Toggle date range visibility for a ticket type
  toggleDateRange(ticketType: TicketType): void {
    ticketType.showDateRange = !ticketType.showDateRange;

    // Format dates for datetime-local input when expanding
    if (ticketType.showDateRange) {
      // Convert ISO dates to datetime-local format (YYYY-MM-DDTHH:mm)
      if (ticketType.start_date) {
        ticketType.start_date = this.formatDateForInput(ticketType.start_date);
      }
      if (ticketType.end_date) {
        ticketType.end_date = this.formatDateForInput(ticketType.end_date);
      }
    }
  }

  // Toggle date range visibility for new ticket type
  toggleNewTicketDateRange(): void {
    this.newTicketType.showDateRange = !this.newTicketType.showDateRange;

    // Clear dates when hiding
    if (!this.newTicketType.showDateRange) {
      this.newTicketType.start_date = null;
      this.newTicketType.end_date = null;
    }
  }

  // Get the display text for schedule availability link
  getScheduleAvailabilityText(ticketType: TicketType): string {
    return 'Schedule';
  }

  // Get the display text for new ticket schedule availability link
  getNewTicketScheduleText(): string {
    return 'Schedule';
  }

  // Format date range caption
  getDateRangeCaption(ticketType: TicketType): string {
    if (!ticketType.start_date && !ticketType.end_date) {
      return '';
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    };

    if (ticketType.start_date && ticketType.end_date) {
      return `Available ${formatDate(ticketType.start_date)} - ${formatDate(ticketType.end_date)}`;
    } else if (ticketType.start_date) {
      return `Available from ${formatDate(ticketType.start_date)}`;
    } else if (ticketType.end_date) {
      return `Available until ${formatDate(ticketType.end_date)}`;
    }

    return '';
  }

  // Clear start date for a ticket type
  clearStartDate(ticketType: TicketType): void {
    ticketType.start_date = null;
  }

  // Clear end date for a ticket type
  clearEndDate(ticketType: TicketType): void {
    ticketType.end_date = null;
  }

  // Clear start date for new ticket type
  clearNewTicketStartDate(): void {
    this.newTicketType.start_date = null;
  }

  // Clear end date for new ticket type
  clearNewTicketEndDate(): void {
    this.newTicketType.end_date = null;
  }

  // Format date for datetime-local input (expects YYYY-MM-DDTHH:mm format)
  private formatDateForInput(dateValue: string | null): string | null {
    if (!dateValue) return null;

    try {
      // If it's already in the correct format for datetime-local, return as-is
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        return dateValue;
      }

      // Parse the date - handle both ISO strings and MySQL datetime format
      let date: Date;
      if (dateValue.includes('T')) {
        // ISO format: 2024-12-31T19:00:00.000Z
        date = new Date(dateValue);
      } else {
        // MySQL datetime format: 2024-12-31 19:00:00
        date = new Date(dateValue.replace(' ', 'T'));
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', dateValue);
        return null;
      }

      // Convert to local timezone and format for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.warn('Error formatting date for input:', dateValue, error);
      return null;
    }
  }

  // Format date for API (convert datetime-local format back to ISO string)
  private formatDateForAPI(dateString: string): string {
    if (!dateString) return '';

    try {
      // Convert datetime-local format back to ISO string for API
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString();
    } catch (error) {
      console.error('Error formatting date for API:', dateString, error);
      return '';
    }
  }
}