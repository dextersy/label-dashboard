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
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Welcome back, {{ firstName() }}</h1>
        <p class="text-gray-500 mt-1">Here's what's happening with your events.</p>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm font-medium text-gray-500">Total Events</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ events().length }}</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm font-medium text-gray-500">Tickets Sold</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ totalTicketsSold() }}</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm font-medium text-gray-500">Total Revenue</p>
          <p class="text-2xl font-bold text-gray-900 mt-1">{{ totalRevenue() | currency:'PHP':'symbol':'1.2-2' }}</p>
        </div>
      </div>

      <!-- Upcoming Events -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-base font-semibold text-gray-900">Upcoming Events</h2>
          <a routerLink="/events/new" class="text-sm text-primary-600 font-medium hover:underline">+ New Event</a>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else if (upcomingEvents().length === 0) {
          <div class="text-center py-12">
            <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <p class="text-gray-500 text-sm">No upcoming events</p>
            <a routerLink="/events/new"
               class="mt-3 inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              Create your first event
            </a>
          </div>
        } @else {
          <div class="divide-y divide-gray-100">
            @for (event of upcomingEvents(); track event.id) {
              <a [routerLink]="['/events', event.id]" class="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ event.title }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">{{ event.venue }} · {{ event.date_and_time | date:'mediumDate' }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-900">{{ event.tickets_sold || 0 }} sold</p>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    [class]="event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'">
                    {{ event.status | titlecase }}
                  </span>
                </div>
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
