import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventTicket } from '../event-tickets-tab/event-tickets-tab.component';

export interface TransferData {
  name: string;
  contact_number: string;
  email_address: string;
}

@Component({
  selector: 'app-transfer-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transfer-ticket-modal.component.html',
  styleUrl: './transfer-ticket-modal.component.scss'
})
export class TransferTicketModalComponent {
  @Input() ticket: EventTicket | null = null;
  @Input() show: boolean = false;
  @Output() transferConfirmed = new EventEmitter<TransferData>();

  loading = false;
  transferData: TransferData = {
    name: '',
    contact_number: '',
    email_address: ''
  };

  showModal(ticket: EventTicket): void {
    this.ticket = ticket;
    this.loading = false;
    this.show = true;
    
    // Pre-populate with existing ticket information
    this.transferData = {
      name: ticket.name,
      contact_number: ticket.contact_number,
      email_address: ticket.email_address
    };
  }

  hide(): void {
    this.show = false;
    this.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.hide();
    }
  }

  onTransfer(): void {
    if (!this.ticket) return;

    // Validate form data
    if (!this.transferData.name.trim() || 
        !this.transferData.contact_number.trim() || 
        !this.transferData.email_address.trim()) {
      return;
    }

    this.loading = true;
    this.transferConfirmed.emit({ ...this.transferData });
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
  }

  resetForm(): void {
    this.transferData = {
      name: '',
      contact_number: '',
      email_address: ''
    };
    this.loading = false;
    this.ticket = null;
  }
}