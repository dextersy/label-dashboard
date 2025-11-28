import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from '../../../services/confirmation.service';

export interface TicketType {
  id?: number;
  event_id?: number;
  name: string;
  price: number;
  max_tickets: number;
  start_date?: string | null;
  end_date?: string | null;
  disabled?: boolean;
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
    disabled: false,
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
  originalTicketTypes: TicketType[] = [];
  showNewForm = false;
  private hasAutoStartedEditing = false; // Track if auto-editing has been done
  // Show new ticket form
  startAddNew(): void {
    this.showNewForm = true;
    this.editingIndex = null;
    this.newTicketType = createNewTicketTypeForm();
  }

  // Save new ticket type
  saveNewTicketType(): void {
    this.addTicketType();
    this.showNewForm = false;
  }

  // Cancel new ticket type
  cancelNewTicketType(): void {
    this.showNewForm = false;
    this.newTicketType = createNewTicketTypeForm();
  }

  // Track which ticket is being edited (by index), or null if none
  editingIndex: number | null = null;

  constructor(public confirmationService: ConfirmationService, private cdr: ChangeDetectorRef) {}
  // Wrapper for delete confirmation to be used in template
  confirmDelete(ticketType: TicketType, index: number): void {
    this.confirmationService.confirm({
      title: 'Delete Ticket Type',
      message: 'Are you sure you want to delete this ticket type?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.deleteTicketType(ticketType, index);
      }
    });
  }

  ngOnInit(): void {
    this.initializeTicketTypes();
    this.saveOriginalTicketTypes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketTypes']) {
      this.initializeTicketTypes();
      this.saveOriginalTicketTypes();
    }
  }
  saveOriginalTicketTypes(): void {
    this.originalTicketTypes = JSON.parse(JSON.stringify(this.ticketTypes));
  }

  isDirty(): boolean {
    // Compare ticketTypes to originalTicketTypes, ignoring UI-only fields
    const stripUiFields = (arr: TicketType[]) => arr.map(tt => {
      const { showDateRange, isFree, isUnlimited, ...rest } = tt;
      return rest;
    });
    return JSON.stringify(stripUiFields(this.ticketTypes)) !== JSON.stringify(stripUiFields(this.originalTicketTypes));
  }

  resetTicketTypes(): void {
    this.ticketTypes = JSON.parse(JSON.stringify(this.originalTicketTypes));
    this.ticketTypesChange.emit([...this.ticketTypes]);
    this.editingIndex = null;
    this.showNewForm = false;
  }

  private initializeTicketTypes(): void {
    this.ticketTypes = this.ticketTypes.map(tt => ({
      ...tt,
      showDateRange: tt.showDateRange ?? (tt.start_date != null || tt.end_date != null),
      isFree: tt.isFree ?? (tt.price === 0),
      isUnlimited: tt.isUnlimited ?? (tt.max_tickets === 0)
    }));

    // For new events with default "Regular" ticket, start in edit mode (only once per component instance)
    if (!this.hasAutoStartedEditing && this.ticketTypes.length === 1 && !this.ticketTypes[0].id ) {
      this.startEdit(0);
      this.hasAutoStartedEditing = true;
    }
  }

  startEdit(index: number): void {
    this.editingIndex = Number(index); // ensure number
    // Deep clone the ticket for editing, so cancel can revert
    this._editBackup = JSON.parse(JSON.stringify(this.ticketTypes[index]));
    
    // Format dates for datetime-local input when editing
    const ticketType = this.ticketTypes[index];
    if (ticketType.start_date) {
      ticketType.start_date = this.formatDateForInput(ticketType.start_date);
    }
    if (ticketType.end_date) {
      ticketType.end_date = this.formatDateForInput(ticketType.end_date);
    }
    
    this.cdr.markForCheck();
  }

  saveEdit(index: number): void {
    const ticketType = this.ticketTypes[index];
    
    // Validate that ticket has a name
    if (!ticketType.name || !ticketType.name.trim()) {
      // Don't save if no name - stay in edit mode
      return;
    }
    
    // Clear dates if not scheduled
    if (!ticketType.showDateRange) {
      ticketType.start_date = null;
      ticketType.end_date = null;
    } else {
      // Format dates back to API format before saving
      if (ticketType.start_date) {
        ticketType.start_date = this.formatDateForAPI(ticketType.start_date);
      }
      if (ticketType.end_date) {
        ticketType.end_date = this.formatDateForAPI(ticketType.end_date);
      }
    }
    
    // Exit edit mode and save changes
    this.editingIndex = null;
    this._editBackup = null;
    this.ticketTypesChange.emit([...this.ticketTypes]);
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    if (this.editingIndex !== null && this._editBackup) {
      this.ticketTypes[this.editingIndex] = { ...this._editBackup };
    }
    this.editingIndex = null;
    this._editBackup = null;
  }

  // Clear start date for edit form
  clearEditTicketStartDate(ticketType: TicketType): void {
    ticketType.start_date = null;
  }

  // Clear end date for edit form
  clearEditTicketEndDate(ticketType: TicketType): void {
    ticketType.end_date = null;
  }

  // Getter for scheduled state - returns true if either date is set
  getScheduledState(ticketType: TicketType): boolean {
    return !!(ticketType.start_date || ticketType.end_date);
  }

  // Setter for scheduled state - only controls visibility, dates are preserved
  setScheduledState(ticketType: TicketType, scheduled: boolean): void {
    ticketType.showDateRange = scheduled;
  }

  // Private backup for editing
  private _editBackup: TicketType | null = null;

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
      start_date: this.newTicketType.showDateRange && this.newTicketType.start_date ? this.formatDateForAPI(this.newTicketType.start_date) : null,
      end_date: this.newTicketType.showDateRange && this.newTicketType.end_date ? this.formatDateForAPI(this.newTicketType.end_date) : null,
      disabled: this.newTicketType.disabled,
      showDateRange: this.newTicketType.showDateRange,
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
        end_date: ticketType.end_date || null,
        disabled: ticketType.disabled
      };
      this.ticketTypesChange.emit([...this.ticketTypes]);
    }
  }

  deleteTicketType(ticketType: TicketType, index: number): void {
    // Remove from local array
    this.ticketTypes = this.ticketTypes.filter((_, i) => i !== index);
    this.ticketTypesChange.emit([...this.ticketTypes]);
  }

  // Toggle disabled state for a ticket type
  toggleTicketTypeDisabled(ticketType: TicketType, index: number): void {
    // Show confirmation when disabling (not when enabling)
    if (!ticketType.disabled) {
      this.confirmationService.confirm({
        title: 'Disable Ticket Type',
        message: 'Are you sure you want to disable this ticket type? It will not be selectable on the Buy page, but existing tickets will be retained.',
        confirmText: 'Disable',
        cancelText: 'Cancel',
        type: 'warning'
      }).then(confirmed => {
        if (confirmed) {
          ticketType.disabled = true;
          this.ticketTypesChange.emit([...this.ticketTypes]);
        }
      });
    } else {
      // Enable without confirmation
      ticketType.disabled = false;
      this.ticketTypesChange.emit([...this.ticketTypes]);
    }
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