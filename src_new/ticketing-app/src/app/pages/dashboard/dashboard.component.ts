import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EventsService } from '../../services/events.service';
import { Event } from '../../models/event.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <p class="text-xs font-mono text-yellow-500 uppercase tracking-[0.25em] mb-1">— dashboard —</p>
        <h1 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Hey {{ firstName() }}</h1>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white border border-gray-200 p-5">
          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Total Events</p>
          <p class="text-3xl font-black text-gray-900">{{ events().length }}</p>
        </div>
        <div class="bg-white border border-gray-200 p-5">
          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Tickets Sold</p>
          <p class="text-3xl font-black text-gray-900">{{ totalTicketsSold() }}</p>
        </div>
        <div class="bg-white border border-gray-200 p-5">
          <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Total Revenue</p>
          <p class="text-3xl font-black text-yellow-500">{{ totalRevenue() | currency:'PHP':'symbol':'1.0-0' }}</p>
        </div>
      </div>

      <!-- Upcoming Events -->
      <div class="border border-gray-200 bg-white">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Upcoming Events</h2>
          <a routerLink="/app/events/new" class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider transition-colors">
            + New Event
          </a>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
          </div>
        } @else if (upcomingEvents().length === 0) {
          <div class="text-center py-12 border border-dashed border-gray-200 m-6">
            <p class="text-gray-400 text-xs font-mono mb-4">no upcoming events.</p>
            <a routerLink="/app/events/new"
               class="inline-flex items-center px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
              Create your first event
            </a>
          </div>
        } @else {
          <div class="divide-y divide-gray-100">
            @for (event of upcomingEvents(); track event.id) {
              <a [routerLink]="['/app/events', event.id]" class="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors group">
                <!-- Date badge -->
                <div class="flex-shrink-0 w-10 text-center border border-gray-200 py-1.5">
                  <p class="text-xs font-mono text-yellow-500 uppercase leading-none">{{ event.date_and_time | date:'MMM' }}</p>
                  <p class="text-lg font-black text-gray-900 leading-tight">{{ event.date_and_time | date:'d' }}</p>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900 group-hover:text-yellow-500 transition-colors uppercase">{{ event.title }}</p>
                  <p class="text-xs font-mono text-gray-400 mt-0.5 truncate">{{ event.venue ? event.venue + ' · ' : '' }}{{ event.date_and_time | date:'h:mm a' }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-black text-gray-900">{{ event.tickets_sold || 0 }}</p>
                  <p class="text-xs font-mono text-gray-400">sold</p>
                </div>
                <span class="text-xs font-mono uppercase px-2 py-0.5 border flex-shrink-0"
                  [class]="event.status === 'published' ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'">
                  {{ event.status }}
                </span>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  events = signal<Event[]>([]);
  loading = signal(true);

  constructor(private auth: AuthService, private eventsService: EventsService) {}

  ngOnInit(): void {
    this.eventsService.getEvents().subscribe({
      next: (events) => { this.events.set(events); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  firstName = () => {
    const u = this.auth.getCurrentUser();
    return u?.first_name || 'there';
  };

  upcomingEvents = () => {
    const now = new Date();
    return this.events()
      .filter(e => new Date(e.date_and_time) >= now)
      .sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime())
      .slice(0, 3);
  };

  totalTicketsSold = () => this.events().reduce((sum, e) => sum + (e.tickets_sold || 0), 0);
  totalRevenue = () => this.events().reduce((sum, e) => sum + (e.total_revenue || 0), 0);
}
