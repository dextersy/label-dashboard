import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, Event } from '../../../services/event.service';
import { ConfirmationService } from '../../../services/confirmation.service';

export interface TicketType {
  id?: number;
  event_id?: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: string | null;
  end_date?: string | null;
  showDateRange?: boolean; // UI state
  isFree?: boolean; // UI state - whether ticket is free
  isUnlimited?: boolean; // UI state - whether ticket has unlimited capacity
}

// Factory function for creating new ticket type form state
function createNewTicketTypeForm() {
  return {
    name: '',
    price: 0,
    max_tickets: 0,
    start_date: null,
    end_date: null,
    showDateRange: false,
    isFree: false,
    isUnlimited: true
  };
}

@Component({
    selector: 'app-ticket-types',
    imports: [CommonModule, FormsModule],
    templateUrl: './ticket-types.component.html',
    styleUrls: ['./ticket-types.component.scss']
})
export class TicketTypesComponent implements OnInit, OnChanges {
  @Input() ticketTypes: TicketType[] = [];
  @Input() isAdmin: boolean = false;
  @Output() ticketTypesChange = new EventEmitter<TicketType[]>();
  @Output() alertMessage = new EventEmitter<{type: string, text: string}>();

  newTicketType = createNewTicketTypeForm();

  constructor() {}

  ngOnInit(): void {
    // Initialize UI states for existing ticket types
    this.initializeTicketTypes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketTypes']) {
      this.initializeTicketTypes();
    }
  }

  private initializeTicketTypes(): void {
    // Add UI state properties if they don't exist
    this.ticketTypes = this.ticketTypes.map(tt => ({
      ...tt,
      showDateRange: tt.showDateRange ?? false,
      isFree: tt.isFree ?? (tt.price === 0),
      isUnlimited: tt.isUnlimited ?? (tt.max_tickets === 0)
    }));
  }

  addTicketType(): void {
    if (!this.newTicketType.name.trim() || (!this.newTicketType.isFree && this.newTicketType.price < 0)) {
      return;
    }

    const newType: TicketType = {
      id: 0, // Will be assigned by backend when event is saved
      event_id: 0, // Will be assigned by backend when event is saved
      name: this.newTicketType.name.trim(),
      price: this.newTicketType.isFree ? 0 : Number(this.newTicketType.price),
      max_tickets: this.newTicketType.isUnlimited ? 0 : Number(this.newTicketType.max_tickets),
      start_date: this.newTicketType.start_date ? this.formatDateForAPI(this.newTicketType.start_date) : null,
      end_date: this.newTicketType.end_date ? this.formatDateForAPI(this.newTicketType.end_date) : null,
      showDateRange: false,
      isFree: this.newTicketType.isFree,
      isUnlimited: this.newTicketType.isUnlimited
    };

    this.ticketTypes = [...this.ticketTypes, newType];
    this.ticketTypesChange.emit([...this.ticketTypes]);

    // Reset form
    this.newTicketType = createNewTicketTypeForm();
  }

  updateTicketType(ticketType: TicketType): void {
    if (!ticketType.name || (!ticketType.isFree && (ticketType.price ?? -1) < 0)) {
      return;
    }

    // Update in local array
    const index = this.ticketTypes.findIndex(tt => tt === ticketType);
    if (index !== -1) {
      this.ticketTypes[index] = {
        ...ticketType,
        name: ticketType.name.trim(),
        price: ticketType.isFree ? 0 : Number(ticketType.price),
        max_tickets: ticketType.isUnlimited ? 0 : Number(ticketType.max_tickets),
        start_date: ticketType.start_date || null,
        end_date: ticketType.end_date || null
      };
      this.ticketTypesChange.emit([...this.ticketTypes]);
    }
  }

  deleteTicketType(ticketType: TicketType, index: number): void {
    // Remove from local array
    this.ticketTypes = this.ticketTypes.filter((_, i) => i !== index);
    this.ticketTypesChange.emit([...this.ticketTypes]);
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
    
    // Emit changes to parent
    this.ticketTypesChange.emit([...this.ticketTypes]);
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

  // Handle date change and emit to parent
  onDateChange(): void {
    this.ticketTypesChange.emit([...this.ticketTypes]);
  }

  // Clear start date for a ticket type
  clearStartDate(ticketType: TicketType): void {
    ticketType.start_date = null;
    this.ticketTypesChange.emit([...this.ticketTypes]);
  }

  // Clear end date for a ticket type
  clearEndDate(ticketType: TicketType): void {
    ticketType.end_date = null;
    this.ticketTypesChange.emit([...this.ticketTypes]);
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