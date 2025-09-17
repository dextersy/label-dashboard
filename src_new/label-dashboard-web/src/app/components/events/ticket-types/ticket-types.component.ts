import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, Event } from '../../../services/event.service';

export interface TicketType {
  id?: number;
  event_id: number;
  name: string;
  price: number;
}

@Component({
  selector: 'app-ticket-types',
  standalone: true,
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
  newTicketType: { name: string; price: number } = { name: '', price: 0 };
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
        this.ticketTypes = response.ticketTypes || [];
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

    if (!this.selectedEvent || !this.newTicketType.name.trim() || this.newTicketType.price < 0) {
      return;
    }

    this.creating = true;
    
    const ticketTypeData = {
      event_id: this.selectedEvent.id,
      name: this.newTicketType.name.trim(),
      price: Number(this.newTicketType.price)
    };

    this.eventService.createTicketType(ticketTypeData).subscribe({
      next: (response) => {
        this.ticketTypes.push(response.ticketType);
        this.newTicketType = { name: '', price: 0 };
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
    if (!ticketType.id || !ticketType.name || (ticketType.price ?? -1) < 0) {
      return;
    }

    this.updating = true;

    const updateData = {
      name: ticketType.name.trim(),
      price: Number(ticketType.price)
    };

    this.eventService.updateTicketType(ticketType.id, updateData).subscribe({
      next: (response) => {
        // Update the ticket type in the list
        const index = this.ticketTypes.findIndex(t => t.id === ticketType.id);
        if (index !== -1) {
          this.ticketTypes[index] = response.ticketType;
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
}