import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventsService } from '../../../services/events.service';
import { Event } from '../../../models/event.model';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Events</h1>
        <a routerLink="/events/new"
           class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Event
        </a>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200">
        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else if (events().length === 0) {
          <div class="text-center py-16">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-base font-medium text-gray-900 mb-1">No events yet</h3>
            <p class="text-sm text-gray-500 mb-4">Get started by creating your first event.</p>
            <a routerLink="/events/new"
               class="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              Create Event
            </a>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Venue</th>
                  <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tickets Sold</th>
                  <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (event of events(); track event.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <a [routerLink]="['/events', event.id]" class="font-medium text-gray-900 hover:text-primary-600">
                        {{ event.title }}
                      </a>
                    </td>
                    <td class="px-6 py-4 text-gray-500">{{ event.date_and_time | date:'mediumDate' }}</td>
                    <td class="px-6 py-4 text-gray-500">{{ event.venue || '—' }}</td>
                    <td class="px-6 py-4">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        [class]="statusClass(event.status)">
                        {{ event.status | titlecase }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-700">{{ event.tickets_sold || 0 }}</td>
                    <td class="px-6 py-4">
                      <div class="flex items-center justify-end gap-2">
                        <a [routerLink]="['/events', event.id]"
                           class="text-xs text-gray-500 hover:text-gray-700 font-medium">View</a>
                        <a [routerLink]="['/events', event.id, 'edit']"
                           class="text-xs text-primary-600 hover:text-primary-700 font-medium">Edit</a>
                        <button (click)="togglePublish(event)"
                           class="text-xs font-medium"
                           [class]="event.status === 'published' ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'">
                          {{ event.status === 'published' ? 'Unpublish' : 'Publish' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class EventsListComponent implements OnInit {
  events = signal<Event[]>([]);
  loading = signal(true);

  constructor(private eventsService: EventsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.eventsService.getEvents().subscribe({
      next: (events) => { this.events.set(events); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'past': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  togglePublish(event: Event): void {
    const action = event.status === 'published'
      ? this.eventsService.unpublishEvent(event.id)
      : this.eventsService.publishEvent(event.id);

    action.subscribe({ next: () => this.load() });
  }
}
