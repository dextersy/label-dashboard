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
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— your shows —</p>
          <h1 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Events</h1>
        </div>
        <a routerLink="/app/events/new"
           class="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
          + New Event
        </a>
      </div>

      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-24 gap-3">
          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading events...</p>
        </div>
      } @else if (events().length === 0) {
        <div class="text-center py-24 border-2 border-dashed border-gray-200">
          <p class="text-gray-400 text-xs font-mono mb-4">no events yet.</p>
          <a routerLink="/app/events/new"
             class="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
            Create Event
          </a>
        </div>
      } @else {
        <div class="divide-y divide-gray-100 border border-gray-200 bg-white">
          @for (event of events(); track event.id) {
            <div class="flex items-center gap-4 p-4 sm:p-5 hover:bg-zinc-50 transition-colors group">

              <!-- Date badge -->
              <div class="flex-shrink-0 text-center w-12 border border-gray-200 py-1.5">
                <p class="text-xs font-mono text-yellow-500 uppercase leading-none mb-0.5">
                  {{ event.date_and_time | date:'MMM' }}
                </p>
                <p class="text-xl font-black text-gray-900 leading-none">
                  {{ event.date_and_time | date:'d' }}
                </p>
              </div>

              <!-- Event info -->
              <div class="flex-1 min-w-0">
                <a [routerLink]="['/app/events', event.id]"
                   class="font-black text-gray-900 hover:text-yellow-500 transition-colors line-clamp-1 uppercase text-sm">
                  {{ event.title }}
                </a>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  @if (event.venue) {
                    <span class="text-xs font-mono text-gray-400">{{ event.venue }}</span>
                  }
                  <span class="text-xs font-mono text-gray-400">{{ event.date_and_time | date:'EEE · h:mm a' }}</span>
                </div>
              </div>

              <!-- Ticket stats -->
              <div class="hidden sm:block text-right flex-shrink-0">
                <p class="text-base font-black text-gray-900">{{ event.tickets_sold || 0 }}</p>
                <p class="text-xs font-mono text-gray-400">sold</p>
              </div>

              <!-- Status badge -->
              <div class="flex-shrink-0">
                <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                  [class]="statusClass(event.status)">
                  {{ event.status }}
                </span>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-3 flex-shrink-0">
                <a [routerLink]="['/app/events', event.id]"
                   class="text-xs font-mono text-gray-400 hover:text-gray-900 uppercase tracking-wider transition-colors">View</a>
                <a [routerLink]="['/app/events', event.id, 'edit']"
                   class="text-xs font-mono text-gray-400 hover:text-gray-900 uppercase tracking-wider transition-colors">Edit</a>
                <button (click)="togglePublish(event)"
                   class="text-xs font-mono uppercase tracking-wider transition-colors"
                   [class]="event.status === 'published' ? 'text-yellow-500/70 hover:text-yellow-500' : 'text-green-600/70 hover:text-green-600'">
                  {{ event.status === 'published' ? 'Unpublish' : 'Publish' }}
                </button>
              </div>
            </div>
          }
        </div>
      }
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
      case 'published': return 'border-green-300 text-green-700 bg-green-50';
      case 'past': return 'border-blue-300 text-blue-700 bg-blue-50';
      default: return 'border-gray-300 text-gray-500 bg-gray-50';
    }
  }

  togglePublish(event: Event): void {
    const action = event.status === 'published'
      ? this.eventsService.unpublishEvent(event.id)
      : this.eventsService.publishEvent(event.id);

    action.subscribe({ next: () => this.load() });
  }
}
