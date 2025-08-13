import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Event } from '../../../services/event.service';

@Component({
  selector: 'app-event-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-selection.component.html',
  styleUrl: './event-selection.component.scss'
})
export class EventSelectionComponent implements OnInit, OnDestroy {
  @Input() events: Event[] = [];
  @Input() selectedEvent: Event | null = null;
  @Input() loading = false;
  @Input() isAdmin = false;
  
  @Output() eventSelected = new EventEmitter<Event>();
  @Output() createEventRequested = new EventEmitter<void>();

  isDropdownOpen = false;
  searchTerm = '';

  ngOnInit(): void {
    // Auto-focus search input when dropdown opens if there are many events
    document.addEventListener('click', this.handleOutsideClick.bind(this));
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleOutsideClick.bind(this));
  }

  toggleDropdown(): void {
    if (!this.loading) {
      this.isDropdownOpen = !this.isDropdownOpen;
      
      // Focus search input after dropdown opens
      if (this.isDropdownOpen && this.events.length > 5) {
        setTimeout(() => {
          const searchInput = document.querySelector('.search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }
    }
  }

  selectEvent(event: Event): void {
    this.eventSelected.emit(event);
    this.isDropdownOpen = false;
    this.clearSearch();
  }

  createEvent(): void {
    this.createEventRequested.emit();
    this.isDropdownOpen = false;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  get filteredEvents(): Event[] {
    if (!this.searchTerm.trim()) {
      return this.events;
    }
    
    const term = this.searchTerm.toLowerCase();
    return this.events.filter(event => 
      event.title.toLowerCase().includes(term) ||
      event.venue.toLowerCase().includes(term) ||
      event.description?.toLowerCase().includes(term)
    );
  }

  getEventStatusText(event: Event): string {
    const now = new Date();
    const eventDate = new Date(event.date_and_time);
    const closeTime = event.close_time ? new Date(event.close_time) : eventDate;
    
    if (now > eventDate) {
      return 'Past';
    } else if (now > closeTime) {
      return 'Closed';
    } else {
      return 'Open';
    }
  }

  getEventStatusClass(event: Event): string {
    const status = this.getEventStatusText(event);
    switch (status) {
      case 'Open':
        return 'badge-success';
      case 'Closed':
        return 'badge-warning';
      case 'Past':
        return 'badge-secondary';
      default:
        return 'badge-primary';
    }
  }

  onImageError(event: any): void {
    // Hide broken image, show default icon
    event.target.style.display = 'none';
  }

  onDropdownImageError(event: any): void {
    // Hide broken image, show default icon
    event.target.style.display = 'none';
  }

  private handleOutsideClick(domEvent: MouseEvent): void {
    const target = domEvent.target as HTMLElement;
    const dropdown = target.closest('.event-selection-container');
    
    if (!dropdown && this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }
}