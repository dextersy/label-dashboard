import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, Event, EventTag } from '../../../../services/event.service';
import { IconComponent } from '../../../../components/shared/icon/icon.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-event-listing-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './event-listing-tab.component.html',
  styleUrl: './event-listing-tab.component.scss'
})
export class EventListingTabComponent implements OnInit, OnChanges {
  @Input() selectedEvent: Event | null = null;
  @Input() isAdmin = false;
  @Output() alertMessage = new EventEmitter<{ type: string; text: string }>();
  @Output() eventUpdated = new EventEmitter<Event>();

  availableTags: EventTag[] = [];
  selectedTagIds: number[] = [];
  newTagInput = '';

  listedOnTicketing = true;
  eventType: string = '';
  saving = false;

  readonly ticketingAppUrl = environment.ticketingAppUrl;

  readonly eventTypeOptions = [
    { value: '', label: '— None —' },
    { value: 'concert', label: 'Concert' },
    { value: 'festival', label: 'Festival' },
    { value: 'club_night', label: 'Club Night' },
    { value: 'open_mic', label: 'Open Mic' },
    { value: 'dj_set', label: 'DJ Set' },
    { value: 'listening_party', label: 'Listening Party' },
    { value: 'album_launch', label: 'Album Launch' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'meetup', label: 'Meetup' },
    { value: 'other', label: 'Other' },
  ];

  constructor(private eventService: EventService) {}

  ngOnInit(): void {
    this.loadTags();
    this.populateFromEvent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent'] && !this.saving) {
      this.populateFromEvent();
    }
  }

  private loadTags(): void {
    this.eventService.getTags().subscribe({
      next: (tags) => {
        this.availableTags = tags;
      },
      error: () => {}
    });
  }

  private populateFromEvent(): void {
    if (!this.selectedEvent) return;
    this.listedOnTicketing = this.selectedEvent.listed_on_ticketing !== false;
    this.eventType = this.selectedEvent.event_type || '';
    this.selectedTagIds = this.selectedEvent.tags?.map(t => t.id) || [];
  }

  isTagSelected(tagId: number): boolean {
    return this.selectedTagIds.includes(tagId);
  }

  toggleTag(tagId: number): void {
    if (this.selectedTagIds.includes(tagId)) {
      this.selectedTagIds = this.selectedTagIds.filter(id => id !== tagId);
    } else {
      this.selectedTagIds = [...this.selectedTagIds, tagId];
    }
  }

  addCustomTag(): void {
    const name = this.newTagInput.trim();
    if (!name) return;
    this.eventService.createTag(name).subscribe({
      next: (tag) => {
        this.availableTags = [...this.availableTags, tag];
        this.selectedTagIds = [...this.selectedTagIds, tag.id];
        this.newTagInput = '';
      },
      error: (err) => {
        this.alertMessage.emit({ type: 'error', text: err.message || 'Failed to create tag' });
      }
    });
  }

  save(silent = false): void {
    if (!this.selectedEvent) return;
    this.saving = true;

    this.eventService.updateEventListing(this.selectedEvent.id, {
      listed_on_ticketing: this.listedOnTicketing,
      event_type: this.eventType || null,
      tags: this.selectedTagIds
    }).subscribe({
      next: (updatedEvent) => {
        this.saving = false;
        if (!silent) {
          this.alertMessage.emit({ type: 'success', text: 'Listing settings saved.' });
        }
        this.eventUpdated.emit(updatedEvent);
      },
      error: (err) => {
        this.saving = false;
        this.alertMessage.emit({ type: 'error', text: err.message || 'Failed to save listing settings.' });
      }
    });
  }
}
