import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EventsService } from '../../../services/events.service';
import { TicketsService } from '../../../services/tickets.service';
import { TicketTypeService } from '../../../services/ticket-type.service';
import { WalkInService } from '../../../services/walk-in.service';
import { ReferrerService } from '../../../services/referrer.service';
import { Event } from '../../../models/event.model';
import { Ticket } from '../../../models/ticket.model';
import { TicketType } from '../../../models/ticket-type.model';
import { WalkInType } from '../../../models/walk-in-type.model';
import { WalkInTransaction } from '../../../models/walk-in-transaction.model';
import { EventReferrer } from '../../../models/event-referrer.model';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Hero Header -->
      <div class="border border-gray-200 mb-6 relative overflow-hidden bg-white">
        <div class="absolute inset-0 opacity-[0.04]"
          style="background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0, rgba(0,0,0,0.15) 1px, transparent 0, transparent 50%); background-size: 10px 10px;"></div>
        <div class="relative z-10 flex gap-6 p-6 md:p-8">
          <div class="flex-1 min-w-0">
            <!-- Back + status row -->
            <div class="flex items-center gap-3 mb-4">
              <a routerLink="/app/events" class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
                ← All Events
              </a>
              <span class="w-px h-3 bg-gray-300"></span>
              <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                [class]="event()?.status === 'published'
                  ? 'border-green-300 text-green-700 bg-green-50'
                  : event()?.status === 'past'
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-500 bg-gray-50'">
                {{ event()?.status }}
              </span>
            </div>

            <!-- Title -->
            <h1 class="text-2xl md:text-3xl font-black text-gray-900 mb-3 leading-tight uppercase">{{ event()?.title }}</h1>

            <!-- Meta -->
            <div class="flex flex-wrap items-center gap-4 mb-6 font-mono">
              <span class="text-xs text-yellow-500 uppercase tracking-wide">
                {{ event()?.date_and_time | date:'EEE MMM d · h:mm a' }}
              </span>
              @if (event()?.venue) {
                <span class="text-xs text-gray-400">{{ event()?.venue }}</span>
              }
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap items-center gap-2">
              <a [routerLink]="['/app/events', routeEventId(), 'edit']"
                 class="px-3 py-1.5 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 hover:border-gray-500 uppercase tracking-wider transition-colors">
                Edit Event
              </a>
              <button (click)="togglePublish()"
                 class="px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-colors"
                 [class]="event()?.status === 'published'
                   ? 'border-yellow-400/30 text-yellow-400/70 hover:text-yellow-400 hover:border-yellow-400/60'
                   : 'border-green-400/30 text-green-400/70 hover:text-green-400 hover:border-green-400/60'">
                {{ event()?.status === 'published' ? 'Unpublish' : 'Publish' }}
              </button>
              @if (event()?.external_ticket_link) {
                <a [href]="event()?.external_ticket_link" target="_blank" rel="noopener noreferrer"
                   class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors"
                   title="External ticketing link">
                  Ticket Page ↗
                </a>
              } @else if (event()?.buy_shortlink) {
                <a [href]="event()?.buy_shortlink" target="_blank"
                   class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                  Ticket Page →
                </a>
              }
              @if (event()?.ticketing_enabled === false) {
                <span class="px-3 py-1.5 border border-gray-300 text-gray-400 text-xs font-mono uppercase tracking-wider">
                  Listing Only
                </span>
              }
            </div>
          </div>

          <!-- Poster thumbnail -->
          @if (event()?.poster_url) {
            <div class="hidden md:block flex-shrink-0 self-start">
              <img [src]="event()?.poster_url" alt="Event poster"
                   class="h-36 w-24 object-cover border border-gray-200">
            </div>
          }
        </div>
      </div>

      <!-- Tab Nav -->
      <div class="flex gap-0 border-b border-gray-200 overflow-x-auto mb-6">
        @for (tab of tabs; track tab.id) {
          <button (click)="onTabChange(tab.id)"
            class="px-4 py-2.5 text-xs font-mono uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors"
            [class]="activeTab() === tab.id
              ? 'border-yellow-400 text-yellow-500'
              : 'border-transparent text-gray-400 hover:text-gray-900'">
            {{ tab.label }}
            @if (tab.ticketingOnly && isTicketingDisabled()) {
              <span class="ml-1 text-gray-300" title="Ticketing disabled">⊘</span>
            }
          </button>
        }
      </div>

      <!-- ====== OVERVIEW TAB ====== -->
      @if (activeTab() === 'overview') {
        <div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="relative p-5"
              [class]="isTicketingDisabled() && !hasExistingTickets()
                ? 'bg-gray-50 border border-dashed border-gray-200'
                : 'bg-white border border-gray-200'">
              <p class="text-xs font-mono uppercase tracking-widest mb-2"
                [class]="isTicketingDisabled() && !hasExistingTickets() ? 'text-gray-300' : 'text-gray-400'">Tickets Sold</p>
              @if (isTicketingDisabled() && !hasExistingTickets()) {
                <p class="text-2xl font-black text-gray-200">—</p>
              } @else {
                <p class="text-2xl font-black text-gray-900">{{ event()?.tickets_sold || 0 }}</p>
              }
              @if (isTicketingDisabled() && hasExistingTickets()) {
                <span class="absolute top-2 right-2 text-xs font-mono text-gray-300 uppercase tracking-wider">historical</span>
              }
            </div>
            <div class="relative p-5"
              [class]="isTicketingDisabled() && !hasExistingTickets()
                ? 'bg-gray-50 border border-dashed border-gray-200'
                : 'bg-white border border-gray-200'">
              <p class="text-xs font-mono uppercase tracking-widest mb-2"
                [class]="isTicketingDisabled() && !hasExistingTickets() ? 'text-gray-300' : 'text-gray-400'">Revenue</p>
              @if (isTicketingDisabled() && !hasExistingTickets()) {
                <p class="text-2xl font-black text-gray-200">—</p>
              } @else {
                <p class="text-2xl font-black text-yellow-500">{{ (event()?.total_revenue || 0) | currency:'PHP':'symbol':'1.0-0' }}</p>
              }
              @if (isTicketingDisabled() && hasExistingTickets()) {
                <span class="absolute top-2 right-2 text-xs font-mono text-gray-300 uppercase tracking-wider">historical</span>
              }
            </div>
            <div class="bg-white border border-gray-200 p-5">
              <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Status</p>
              <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                [class]="statusClass(event()?.status || '')">
                {{ event()?.status }}
              </span>
            </div>
            <div class="bg-white border border-gray-200 p-5">
              <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Walk-In</p>
              <p class="text-xl font-black text-gray-900">{{ event()?.walk_in_enabled ? 'On' : 'Off' }}</p>
            </div>
          </div>

          <div class="border border-gray-200 bg-white p-6">
            <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Event Details</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Date</dt>
                <dd class="text-sm font-mono text-gray-600">{{ event()?.date_and_time | date:'long' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Venue</dt>
                <dd class="text-sm font-mono text-gray-600">{{ event()?.venue || '—' }}</dd>
              </div>
              @if (event()?.external_ticket_link) {
                <div>
                  <dt class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Ticket Link <span class="text-gray-300">(External)</span></dt>
                  <dd class="text-sm font-mono text-yellow-500 truncate">
                    <a [href]="event()?.external_ticket_link" target="_blank" rel="noopener noreferrer">{{ event()?.external_ticket_link }}</a>
                  </dd>
                </div>
              } @else if (event()?.buy_shortlink) {
                <div>
                  <dt class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Buy Link</dt>
                  <dd class="text-sm font-mono text-yellow-500 truncate">
                    <a [href]="event()?.buy_shortlink" target="_blank">{{ event()?.buy_shortlink }}</a>
                  </dd>
                </div>
              }
              @if (event()?.description) {
                <div class="sm:col-span-2">
                  <dt class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Description</dt>
                  <dd class="text-sm text-gray-600">{{ event()?.description }}</dd>
                </div>
              }
            </dl>
          </div>

          <!-- Ticket Types -->
          @if (!isTicketingDisabled() || hasExistingTickets()) {
            <div class="border border-gray-200 bg-white p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest">Ticket Types</h3>
                <button (click)="openTicketTypeModal()"
                  class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                  + Add Type
                </button>
              </div>
              @if (ticketTypes().length === 0) {
                <p class="text-xs font-mono text-gray-400 py-4 text-center">No ticket types yet.</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200 bg-zinc-50">
                      <tr>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Name</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Price</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Max</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Sold</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Pending</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Left</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Status</th>
                        <th class="text-right px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (tt of ticketTypes(); track tt.id) {
                        <tr class="hover:bg-zinc-50">
                          <td class="px-4 py-2.5 font-bold text-gray-900 uppercase text-sm">{{ tt.name }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ tt.price | currency:'PHP':'symbol':'1.2-2' }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ tt.max_tickets === 0 ? '∞' : tt.max_tickets }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ tt.sold_tickets || 0 }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ tt.pending_tickets || 0 }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ tt.remaining_tickets == null ? '∞' : tt.remaining_tickets }}</td>
                          <td class="px-4 py-2.5">
                            <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                              [class]="tt.disabled ? 'border-red-300 text-red-600 bg-red-50' : 'border-green-300 text-green-700 bg-green-50'">
                              {{ tt.disabled ? 'Off' : 'On' }}
                            </span>
                          </td>
                          <td class="px-4 py-2.5">
                            <div class="flex items-center justify-end gap-3">
                              <button (click)="openTicketTypeModal(tt)" class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider">Edit</button>
                              <button (click)="deleteTicketType(tt)" class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Delete</button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          <!-- Walk-In Types -->
          @if (event()?.walk_in_enabled) {
            <div class="border border-gray-200 bg-white p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest">Walk-In Types</h3>
                <button (click)="openWalkInTypeModal()"
                  class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                  + Add Type
                </button>
              </div>
              @if (walkInTypes().length === 0) {
                <p class="text-xs font-mono text-gray-400 py-4 text-center">No walk-in types yet.</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200 bg-zinc-50">
                      <tr>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Name</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Price</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Max</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Sold</th>
                        <th class="text-left px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Left</th>
                        <th class="text-right px-4 py-2.5 text-xs font-mono text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (wt of walkInTypes(); track wt.id) {
                        <tr class="hover:bg-zinc-50">
                          <td class="px-4 py-2.5 font-bold text-gray-900 uppercase text-sm">{{ wt.name }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ wt.price | currency:'PHP':'symbol':'1.2-2' }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ wt.max_slots === 0 ? '∞' : wt.max_slots }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ wt.sold_count || 0 }}</td>
                          <td class="px-4 py-2.5 text-sm font-mono text-gray-500">{{ wt.remaining_slots == null ? '∞' : wt.remaining_slots }}</td>
                          <td class="px-4 py-2.5">
                            <div class="flex items-center justify-end gap-3">
                              <button (click)="openWalkInTypeModal(wt)" class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider">Edit</button>
                              <button (click)="deleteWalkInType(wt)" class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Delete</button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ====== SALES TAB ====== -->
      @if (activeTab() === 'sales') {
        <div class="space-y-8">

          <!-- ---- Tickets Section ---- -->
          <div>
            <div class="flex items-center gap-3 mb-4">
              <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Tickets</h2>
              <div class="flex-1 border-t border-gray-200"></div>
              @if (isTicketingDisabled()) {
                <span class="text-xs font-mono px-2 py-0.5 border"
                  [class]="event()?.external_ticket_link ? 'border-blue-200 text-blue-500 bg-blue-50' : 'border-amber-200 text-amber-500 bg-amber-50'">
                  {{ event()?.external_ticket_link ? 'External' : 'Disabled' }}
                </span>
              }
            </div>

            @if (isTicketingDisabled()) {
              <div class="mb-4 px-4 py-3 border flex items-start gap-3"
                [class]="event()?.external_ticket_link ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'">
                <span class="text-lg leading-none mt-0.5">{{ event()?.external_ticket_link ? '↗' : '⊘' }}</span>
                <p class="text-xs font-mono"
                  [class]="event()?.external_ticket_link ? 'text-blue-600' : 'text-amber-600'">
                  @if (hasExistingTickets()) {
                    Ticketing is currently {{ event()?.external_ticket_link ? 'handled externally' : 'disabled' }}. Records below reflect tickets sold while platform ticketing was active.
                  } @else {
                    {{ event()?.external_ticket_link ? 'Tickets are sold through an external provider — no platform records.' : 'Ticketing is disabled for this event.' }}
                  }
                </p>
              </div>
            }

            @if (ticketSummary()) {
              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Sold</p>
                  <p class="text-xl font-black text-gray-900">{{ ticketSummary().total_tickets_sold }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Checked In</p>
                  <p class="text-xl font-black text-gray-900">{{ ticketSummary().total_checked_in }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Revenue</p>
                  <p class="text-xl font-black text-yellow-500">{{ ticketSummary().total_revenue | currency:'PHP':'symbol':'1.0-0' }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Processing</p>
                  <p class="text-xl font-black text-gray-500">{{ ticketSummary().total_processing_fee | currency:'PHP':'symbol':'1.0-0' }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Platform</p>
                  <p class="text-xl font-black text-gray-500">{{ ticketSummary().platform_fee | currency:'PHP':'symbol':'1.0-0' }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Net</p>
                  <p class="text-xl font-black text-gray-900">{{ ticketSummary().net_revenue | currency:'PHP':'symbol':'1.0-0' }}</p>
                </div>
                <div class="bg-white border border-gray-200 p-4">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Tax (0.5%)</p>
                  <p class="text-xl font-black text-gray-500">{{ ticketSummary().tax | currency:'PHP':'symbol':'1.0-0' }}</p>
                </div>
              </div>
            }

            <div class="flex items-center justify-between mb-3 gap-3">
              <input type="text" [(ngModel)]="ticketSearch" (input)="loadTickets()"
                class="px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm w-64 placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="Search by name...">
              <div class="flex items-center gap-2">
                <button (click)="openCreateTicketModal()"
                  class="px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                  + Create Ticket
                </button>
                <a [href]="ticketsService.exportCsvUrl({ event_id: routeEventId() })"
                   class="px-3 py-2 border border-gray-300 text-gray-400 text-xs font-mono hover:text-gray-900 hover:border-gray-500 uppercase tracking-wider transition-colors">
                  Export CSV
                </a>
              </div>
            </div>

            <div class="border border-gray-200 overflow-hidden bg-white">
              @if (ticketsLoading()) {
                <div class="flex items-center justify-center py-12">
                  <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
                </div>
              } @else if (tickets().length === 0) {
                <div class="text-center py-12 text-gray-400 text-xs font-mono">No tickets found.</div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200 bg-zinc-50">
                      <tr>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Attendee</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Code</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Type</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Entries</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Amount</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Referrer</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Date Paid</th>
                        <th class="text-left px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Status</th>
                        <th class="text-right px-4 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (ticket of tickets(); track ticket.id) {
                        <tr class="hover:bg-zinc-50 transition-colors">
                          <td class="px-4 py-3.5">
                            <p class="font-bold text-gray-900 text-sm">{{ ticket.name }}</p>
                            <p class="text-xs font-mono text-gray-400 mt-0.5">{{ ticket.email_address }}</p>
                            @if (ticket.contact_number) {
                              <p class="text-xs font-mono text-gray-400">{{ ticket.contact_number }}</p>
                            }
                          </td>
                          <td class="px-4 py-3.5 text-sm font-mono text-yellow-600 font-bold">{{ ticket.ticket_code || '—' }}</td>
                          <td class="px-4 py-3.5 text-sm text-gray-500 font-mono">{{ ticket.ticket_type_name }}</td>
                          <td class="px-4 py-3.5 text-sm text-gray-500 font-mono">
                            {{ ticket.number_of_entries }}
                            @if (ticket.number_of_claimed_entries != null) {
                              <span class="text-gray-400"> / {{ ticket.number_of_claimed_entries }} in</span>
                            }
                          </td>
                          <td class="px-4 py-3.5 text-sm font-black text-gray-900">{{ ticket.amount | currency:'PHP':'symbol':'1.2-2' }}</td>
                          <td class="px-4 py-3.5 text-xs font-mono text-gray-400">{{ ticket.referrer_name || '—' }}</td>
                          <td class="px-4 py-3.5 text-xs font-mono text-gray-400">{{ ticket.date_paid ? (ticket.date_paid | date:'MMM d, y') : '—' }}</td>
                          <td class="px-4 py-3.5">
                            <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                              [class]="ticketStatusClass(ticket.status)">
                              {{ ticketStatusLabel(ticket.status) }}
                            </span>
                          </td>
                          <td class="px-4 py-3.5">
                            <div class="flex items-center justify-end gap-3">
                              <button (click)="resendTicket(ticket)" class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider">Resend</button>
                              @if (ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed') {
                                <button (click)="openTransferModal(ticket)" class="text-xs font-mono text-blue-500 hover:text-blue-600 uppercase tracking-wider">Transfer</button>
                                <button (click)="confirmAction('cancel', ticket)" class="text-xs font-mono text-gray-400 hover:text-gray-900 uppercase tracking-wider">Cancel</button>
                                <button (click)="confirmAction('refund', ticket)" class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Refund</button>
                              }
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

          <!-- ---- Pending Orders Section ---- -->
          <div>
            <div class="flex items-center gap-3 mb-4">
              <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Pending Orders</h2>
              <div class="flex-1 border-t border-gray-200"></div>
              @if (isTicketingDisabled()) {
                <span class="text-xs font-mono px-2 py-0.5 border"
                  [class]="event()?.external_ticket_link ? 'border-blue-200 text-blue-500 bg-blue-50' : 'border-amber-200 text-amber-500 bg-amber-50'">
                  {{ event()?.external_ticket_link ? 'External' : 'Disabled' }}
                </span>
              }
            </div>

            @if (isTicketingDisabled() && !hasExistingTickets()) {
              <p class="text-xs font-mono text-gray-400 py-4">
                {{ event()?.external_ticket_link ? 'Orders are managed by the external provider.' : 'Ticketing is disabled — no orders will be placed.' }}
              </p>
            } @else {
              <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <input type="text" [(ngModel)]="pendingSearch" (input)="loadPendingTickets()"
                  class="px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm w-64 placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="Search by name...">
                <div class="flex items-center gap-2">
                  <a [href]="eventsService.getPendingCsvUrl(routeEventId())"
                     class="px-3 py-2 border border-gray-300 text-gray-400 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                    CSV
                  </a>
                  <button (click)="verifyPayments()"
                    class="px-3 py-2 border border-yellow-400/30 text-yellow-400/70 hover:text-yellow-400 text-xs font-mono uppercase tracking-wider transition-colors">
                    Verify Payments
                  </button>
                  <button (click)="cancelAllUnpaid()"
                    class="px-3 py-2 border border-red-400/30 text-red-400/70 hover:text-red-400 text-xs font-mono uppercase tracking-wider transition-colors">
                    Cancel All Unpaid
                  </button>
                </div>
              </div>
              <div class="border border-gray-200 overflow-hidden bg-white">
                @if (pendingLoading()) {
                  <div class="flex items-center justify-center py-12">
                    <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
                  </div>
                } @else if (pendingTickets().length === 0) {
                  <div class="text-center py-12 text-gray-400 text-xs font-mono">No pending orders.</div>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="border-b border-gray-200 bg-zinc-50">
                        <tr>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Buyer</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Ticket</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Entries</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Status</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Ordered</th>
                          <th class="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        @for (ticket of pendingTickets(); track ticket.id) {
                          <tr class="hover:bg-zinc-50 transition-colors">
                            <td class="px-6 py-3.5">
                              <p class="font-bold text-gray-900 text-sm">{{ ticket.name }}</p>
                              <p class="text-xs font-mono text-gray-400 mt-0.5">{{ ticket.email_address }}{{ ticket.contact_number ? ' · ' + ticket.contact_number : '' }}</p>
                            </td>
                            <td class="px-6 py-3.5 text-sm font-mono text-gray-500">{{ ticket.ticket_type_name }}</td>
                            <td class="px-6 py-3.5 text-sm font-mono text-gray-500">{{ ticket.number_of_entries }}</td>
                            <td class="px-6 py-3.5">
                              <span class="text-xs font-mono uppercase px-2 py-0.5 border"
                                [class]="ticketStatusClass(ticket.status)">
                                {{ ticketStatusLabel(ticket.status) }}
                              </span>
                            </td>
                            <td class="px-6 py-3.5 text-xs font-mono text-gray-400">{{ ticket.order_timestamp | date:'short' }}</td>
                            <td class="px-6 py-3.5">
                              <div class="flex items-center justify-end gap-3">
                                <button (click)="markPaid(ticket)" class="text-xs font-mono text-green-400 hover:text-green-300 uppercase tracking-wider">Mark Paid</button>
                                <button (click)="confirmAction('cancel', ticket)" class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </div>

          <!-- ---- Walk-In Section ---- -->
          @if (event()?.walk_in_enabled) {
            <div>
              <div class="flex items-center gap-3 mb-4">
                <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest">Walk-In</h2>
                <div class="flex-1 border-t border-gray-200"></div>
              </div>
              <div class="border border-gray-200 overflow-hidden bg-white">
                @if (walkInTransactionsLoading()) {
                  <div class="flex items-center justify-center py-12">
                    <p class="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">loading...</p>
                  </div>
                } @else if (walkInTransactions().length === 0) {
                  <div class="text-center py-12 text-gray-400 text-xs font-mono">No walk-in transactions yet.</div>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="border-b border-gray-200 bg-zinc-50">
                        <tr>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Date</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Items</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Payment</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Amount</th>
                          <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">By</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        @for (tx of walkInTransactions(); track tx.id) {
                          <tr class="hover:bg-zinc-50">
                            <td class="px-6 py-3 text-xs font-mono text-gray-400">{{ tx.created_at | date:'short' }}</td>
                            <td class="px-6 py-3 text-sm font-mono text-gray-500">
                              @for (item of tx.items; track item.id) {
                                <div>{{ item.quantity }}× {{ item.walk_in_type_name }}</div>
                              }
                            </td>
                            <td class="px-6 py-3 text-sm font-mono text-gray-500 capitalize">{{ tx.payment_method }}</td>
                            <td class="px-6 py-3 text-sm font-black text-gray-900">{{ tx.total_amount | currency:'PHP':'symbol':'1.2-2' }}</td>
                            <td class="px-6 py-3 text-xs font-mono text-gray-400">{{ tx.registered_by_name || tx.registered_by }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>
          }

        </div>
      }

      <!-- ====== REFERRALS TAB ====== -->
      @if (activeTab() === 'referrals') {
        <div>
          @if (isTicketingDisabled()) {
            <div class="mb-4 px-4 py-3 border flex items-start gap-3"
              [class]="event()?.external_ticket_link ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'">
              <span class="text-lg leading-none mt-0.5">{{ event()?.external_ticket_link ? '↗' : '⊘' }}</span>
              <div>
                <p class="text-xs font-black uppercase tracking-widest mb-0.5"
                  [class]="event()?.external_ticket_link ? 'text-blue-700' : 'text-amber-700'">
                  {{ event()?.external_ticket_link ? 'External Ticketing' : 'Ticketing Disabled' }}
                </p>
                <p class="text-xs font-mono"
                  [class]="event()?.external_ticket_link ? 'text-blue-600' : 'text-amber-600'">
                  {{ hasExistingTickets() ? 'Referral stats below reflect activity while platform ticketing was active.' : (event()?.external_ticket_link ? 'Referrals are not tracked for external ticketing.' : 'Ticketing is disabled — referral tracking is not applicable.') }}
                </p>
              </div>
            </div>
          }
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Referrers</h2>
            <button (click)="openReferrerModal()"
              class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
              + Add Referrer
            </button>
          </div>

          <div class="border border-gray-200 overflow-hidden bg-white">
            @if (referrers().length === 0) {
              <div class="text-center py-12 text-gray-400 text-xs font-mono">No referrers yet.</div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200 bg-zinc-50">
                    <tr>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Name</th>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Code</th>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Sold</th>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Gross</th>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Net</th>
                      <th class="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Shortlink</th>
                      <th class="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (ref of referrers(); track ref.id) {
                      <tr class="hover:bg-zinc-50">
                        <td class="px-6 py-3 font-bold text-gray-900 uppercase text-sm">{{ ref.name }}</td>
                        <td class="px-6 py-3 font-mono text-yellow-500 text-sm">{{ ref.referral_code }}</td>
                        <td class="px-6 py-3 text-sm font-mono text-gray-500">{{ ref.tickets_sold || 0 }}</td>
                        <td class="px-6 py-3 text-sm font-mono text-gray-500">{{ (ref.gross || 0) | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3 text-sm font-mono text-gray-500">{{ (ref.net || 0) | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3 font-mono text-gray-400 truncate max-w-[160px] text-xs">
                          @if (ref.referral_shortlink) {
                            <a [href]="ref.referral_shortlink" target="_blank" class="text-yellow-500 hover:text-yellow-600">{{ ref.referral_shortlink }}</a>
                          } @else { — }
                        </td>
                        <td class="px-6 py-3">
                          <div class="flex items-center justify-end gap-3">
                            @if (ref.referral_shortlink) {
                              <button (click)="copyLink(ref.referral_shortlink)" class="text-xs font-mono text-gray-400 hover:text-gray-900 uppercase tracking-wider">Copy</button>
                              <button (click)="downloadQrCode(ref.referral_shortlink, ref.name)" class="text-xs font-mono text-gray-400 hover:text-gray-900 uppercase tracking-wider">QR</button>
                            }
                            <button (click)="deleteReferrer(ref)" class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Delete</button>
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
      }

      <!-- ====== EMAIL TAB ====== -->
      @if (activeTab() === 'email') {
        <div class="max-w-3xl">
          <div class="border border-gray-200 bg-white p-6 space-y-5">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Email Ticket Holders</h2>
              @if (ticketHoldersCount() !== null) {
                <span class="text-xs font-mono text-gray-400">{{ ticketHoldersCount() }} recipient{{ ticketHoldersCount() !== 1 ? 's' : '' }}</span>
              }
            </div>

            <div>
              <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Subject *</label>
              <input type="text" [(ngModel)]="emailSubject"
                class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="Email subject...">
            </div>

            <div>
              <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Body *</label>
              <textarea [(ngModel)]="emailBody" rows="10"
                class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors font-mono resize-y"
                placeholder="Email body (HTML supported)..."></textarea>
              <p class="mt-1 text-xs font-mono text-gray-400">HTML supported.</p>
            </div>

            @if (emailSuccess()) {
              <div class="p-3 border border-green-300 bg-green-50 text-green-700 text-xs font-mono">{{ emailSuccess() }}</div>
            }
            @if (emailError()) {
              <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ emailError() }}</div>
            }

            <div class="flex items-end gap-3 pt-4 border-t border-gray-200">
              <div class="flex-1">
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Test Email</label>
                <input type="email" [(ngModel)]="testEmailAddress"
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="you@example.com">
              </div>
              <button (click)="sendTestEmail()" [disabled]="emailSending()"
                class="px-4 py-2.5 border border-gray-300 text-gray-400 text-xs font-mono hover:text-gray-900 uppercase tracking-wider disabled:opacity-50 transition-colors">
                {{ emailSending() ? 'Sending...' : 'Send Test' }}
              </button>
              <button (click)="sendEmail()" [disabled]="emailSending()"
                class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                {{ emailSending() ? 'Sending...' : 'Send to All' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ====== SCANNER TAB ====== -->
      @if (activeTab() === 'scanner') {
        <div class="max-w-2xl space-y-4">

          @if (isTicketingDisabled()) {
            <div class="px-4 py-3 border flex items-start gap-3"
              [class]="event()?.external_ticket_link ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'">
              <span class="text-lg leading-none mt-0.5">{{ event()?.external_ticket_link ? '↗' : '⊘' }}</span>
              <div>
                <p class="text-xs font-black uppercase tracking-widest mb-0.5"
                  [class]="event()?.external_ticket_link ? 'text-blue-700' : 'text-amber-700'">
                  {{ event()?.external_ticket_link ? 'External Ticketing' : 'Ticketing Disabled' }}
                </p>
                <p class="text-xs font-mono"
                  [class]="event()?.external_ticket_link ? 'text-blue-600' : 'text-amber-600'">
                  {{ hasExistingTickets() ? 'The scanner can still be used to check in tickets sold while platform ticketing was active.' : (event()?.external_ticket_link ? 'Ticket scanning is not applicable — tickets are managed externally.' : 'Ticketing is disabled. The scanner is only useful if tickets were previously sold through the platform.') }}
                </p>
              </div>
            </div>
          }

          @if (!event()?.verification_link && !event()?.verification_pin) {
            <div class="border border-yellow-200 bg-yellow-50 p-4 text-xs font-mono text-yellow-700">
              Publish this event first to generate scanner credentials.
            </div>
          }

          <!-- Verification Link -->
          @if (event()?.verification_link) {
            <div class="border border-gray-200 bg-white p-6">
              <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Scanner Link</h3>
              <p class="text-xs font-mono text-gray-400 mb-3">Share this link with your scanner operators. They will enter the PIN below to log in.</p>
              <div class="flex items-center gap-3">
                <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 text-sm font-mono text-gray-700 truncate">{{ event()?.verification_link }}</code>
                <button (click)="copyToClipboard(event()?.verification_link || '', 'link')"
                  class="px-3 py-2 border text-xs font-mono uppercase tracking-wider transition-colors"
                  [class]="linkCopied() ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-500'">
                  {{ linkCopied() ? 'Copied!' : 'Copy' }}
                </button>
                <a [href]="event()?.verification_link" target="_blank"
                  class="px-3 py-2 border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-500 text-xs font-mono uppercase tracking-wider transition-colors">
                  Open →
                </a>
              </div>
            </div>
          }

          <!-- Verification PIN -->
          <div class="border border-gray-200 bg-white p-6">
            <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Verification PIN</h3>
            <p class="text-xs font-mono text-gray-400 mb-4">Scanners enter this PIN to authenticate. Keep it private — only share with authorized staff.</p>
            <div class="flex items-center gap-4 mb-4">
              <div class="flex-1">
                @if (event()?.verification_pin) {
                  <div class="text-4xl font-black text-gray-900 font-mono tracking-[0.5em] py-3">{{ event()?.verification_pin }}</div>
                } @else {
                  <div class="text-sm font-mono text-gray-400 italic">Not generated yet — publish the event first.</div>
                }
              </div>
              @if (event()?.verification_pin) {
                <button (click)="copyToClipboard(event()?.verification_pin || '', 'pin')"
                  class="px-3 py-2 border text-xs font-mono uppercase tracking-wider transition-colors"
                  [class]="pinCopied() ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-500'">
                  {{ pinCopied() ? 'Copied!' : 'Copy PIN' }}
                </button>
              }
            </div>
            <div class="pt-4 border-t border-gray-100">
              <button (click)="refreshPin()" [disabled]="pinRefreshing()"
                class="px-4 py-2 border border-red-200 text-red-500 hover:text-red-700 hover:border-red-400 text-xs font-mono uppercase tracking-wider disabled:opacity-50 transition-colors">
                {{ pinRefreshing() ? 'Regenerating...' : 'Regenerate PIN' }}
              </button>
              <p class="mt-2 text-xs font-mono text-gray-400">Warning: regenerating will invalidate any currently active scanner sessions.</p>
            </div>
          </div>

          <!-- QR code for scanner link -->
          @if (event()?.verification_link) {
            <div class="border border-gray-200 bg-white p-6">
              <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Scanner Link QR Code</h3>
              <p class="text-xs font-mono text-gray-400 mb-4">Print or display this QR code for scanners to quickly open the scanner page.</p>
              <div class="flex items-start gap-5">
                <img [src]="qrUrl(event()!.verification_link!)" alt="Scanner QR Code" class="w-32 h-32 border border-gray-200">
                <button (click)="downloadQrCode(event()!.verification_link!, 'scanner-' + event()!.id)"
                  class="mt-2 px-3 py-2 border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-500 text-xs font-mono uppercase tracking-wider transition-colors">
                  Download QR
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- ====== TICKET TYPE MODAL ====== -->
      @if (ticketTypeModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="ticketTypeModal.set(null)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-lg">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">
              {{ ticketTypeModal()!.id ? 'Edit Ticket Type' : 'Add Ticket Type' }}
            </h3>
            <form [formGroup]="ticketTypeForm" (ngSubmit)="saveTicketType()" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Name *</label>
                  <input type="text" formControlName="name"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Price (PHP) *</label>
                  <input type="number" formControlName="price" min="0" step="0.01"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Max Tickets (0=∞)</label>
                  <input type="number" formControlName="max_tickets" min="0"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Sale Start</label>
                  <input type="datetime-local" formControlName="start_date"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Sale End</label>
                  <input type="datetime-local" formControlName="end_date"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Special Instructions (Buyer)</label>
                  <textarea formControlName="special_instructions" rows="2"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors resize-none"></textarea>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Scanner Instructions</label>
                  <textarea formControlName="special_instructions_for_scanner" rows="2"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors resize-none"></textarea>
                </div>
                <div class="col-span-2 flex items-center gap-2">
                  <input type="checkbox" formControlName="disabled" id="tt-disabled"
                    class="w-4 h-4 border-gray-300 focus:ring-yellow-400">
                  <label for="tt-disabled" class="text-xs font-mono text-gray-600 uppercase tracking-widest">Disabled</label>
                </div>
              </div>
              @if (ticketTypeError()) {
                <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ ticketTypeError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button type="button" (click)="ticketTypeModal.set(null)"
                  class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="ticketTypeForm.invalid || ticketTypeSaving()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                  {{ ticketTypeSaving() ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ====== WALK-IN TYPE MODAL ====== -->
      @if (walkInTypeModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="walkInTypeModal.set(null)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-md">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">
              {{ walkInTypeModal()!.id ? 'Edit Walk-In Type' : 'Add Walk-In Type' }}
            </h3>
            <form [formGroup]="walkInTypeForm" (ngSubmit)="saveWalkInType()" class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Name *</label>
                <input type="text" formControlName="name"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Price (PHP) *</label>
                <input type="number" formControlName="price" min="0" step="0.01"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Max Slots (0=∞)</label>
                <input type="number" formControlName="max_slots" min="0"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              @if (walkInTypeError()) {
                <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ walkInTypeError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button type="button" (click)="walkInTypeModal.set(null)"
                  class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="walkInTypeForm.invalid || walkInTypeSaving()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                  {{ walkInTypeSaving() ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ====== REFERRER MODAL ====== -->
      @if (referrerModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="referrerModal.set(false)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-md">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">Add Referrer</h3>
            <form [formGroup]="referrerForm" (ngSubmit)="saveReferrer()" class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Name *</label>
                <input type="text" formControlName="name"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Referral Code *</label>
                <input type="text" formControlName="referral_code"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="e.g. FRIEND2025">
              </div>
              @if (referrerError()) {
                <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ referrerError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button type="button" (click)="referrerModal.set(false)"
                  class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="referrerForm.invalid || referrerSaving()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                  {{ referrerSaving() ? 'Saving...' : 'Add Referrer' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ====== CONFIRM MODAL ====== -->
      @if (confirmModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="confirmModal.set(null)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-sm">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-2">
              {{ confirmModal()!.action === 'cancel' ? 'Cancel Ticket' : 'Refund Ticket' }}
            </h3>
            <p class="text-sm font-mono text-gray-500 mb-5">
              Are you sure you want to {{ confirmModal()!.action }} this ticket for
              <strong class="text-gray-900">{{ confirmModal()!.ticket.name }}</strong>?
            </p>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button (click)="confirmModal.set(null)"
                class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                Cancel
              </button>
              <button (click)="executeAction()"
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ====== TRANSFER MODAL ====== -->
      @if (transferModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="transferModal.set(null)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-md">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">Transfer Ticket</h3>
            <p class="text-xs font-mono text-gray-400 mb-4">
              Transfer ticket <strong class="text-yellow-500">{{ transferModal()!.ticket_code }}</strong> from
              <strong class="text-gray-700">{{ transferModal()!.name }}</strong> to a new attendee.
              The original ticket will be cancelled and a new one sent.
            </p>
            <form [formGroup]="transferForm" (ngSubmit)="executeTransfer()" class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">New Attendee Name *</label>
                <input type="text" formControlName="name"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email *</label>
                <input type="email" formControlName="email_address"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Contact Number *</label>
                <input type="text" formControlName="contact_number"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
              </div>
              @if (transferError()) {
                <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ transferError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button type="button" (click)="transferModal.set(null)"
                  class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="transferForm.invalid || transferSaving()"
                  class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                  {{ transferSaving() ? 'Transferring...' : 'Transfer Ticket' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ====== CREATE CUSTOM TICKET MODAL ====== -->
      @if (createTicketModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/50" (click)="createTicketModal.set(false)"></div>
          <div class="relative bg-white border border-gray-200 shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">Create Custom Ticket</h3>
            <p class="text-xs font-mono text-gray-400 mb-4">Manually issue a ticket to an attendee. Use for comps, replacements, or offline payments.</p>
            <form [formGroup]="createTicketForm" (ngSubmit)="saveCustomTicket()" class="space-y-4">
              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Ticket Type *</label>
                <select formControlName="ticket_type_id"
                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                  <option value="">Select ticket type...</option>
                  @for (tt of ticketTypes(); track tt.id) {
                    <option [value]="tt.id">{{ tt.name }} — {{ tt.price | currency:'PHP':'symbol':'1.2-2' }}</option>
                  }
                </select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Full Name *</label>
                  <input type="text" formControlName="name"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Email *</label>
                  <input type="email" formControlName="email_address"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Contact Number *</label>
                  <input type="text" formControlName="contact_number"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Entries</label>
                  <input type="number" formControlName="number_of_entries" min="1"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Price Override (PHP)</label>
                  <input type="number" formControlName="price_per_ticket" min="0" step="0.01" placeholder="Leave blank to use ticket type price"
                    class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input type="checkbox" formControlName="send_email" id="ct-send-email" class="w-4 h-4 border-gray-300 focus:ring-yellow-400">
                <label for="ct-send-email" class="text-xs font-mono text-gray-600 uppercase tracking-widest">Send ticket email to attendee</label>
              </div>
              @if (createTicketError()) {
                <div class="p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ createTicketError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button type="button" (click)="createTicketModal.set(false)"
                  class="px-4 py-2 border border-gray-300 text-gray-500 text-xs font-mono hover:text-gray-900 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="createTicketForm.invalid || createTicketSaving()"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
                  {{ createTicketSaving() ? 'Creating...' : 'Create Ticket' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class EventDetailComponent implements OnInit {
  // Core state
  event = signal<Event | null>(null);
  activeTab = signal('overview');

  // Tickets tab
  tickets = signal<Ticket[]>([]);
  ticketsLoading = signal(false);
  ticketSearch = '';

  // Ticket summary
  ticketSummary = signal<any>(null);
  ticketSummaryLoading = signal(false);

  // Ticket types tab
  ticketTypes = signal<TicketType[]>([]);
  ticketTypeModal = signal<Partial<TicketType> | null>(null);
  ticketTypeForm: FormGroup;
  ticketTypeSaving = signal(false);
  ticketTypeError = signal('');

  // Pending orders tab
  pendingTickets = signal<Ticket[]>([]);
  pendingLoading = signal(false);
  pendingSearch = '';

  // Walk-in tab
  walkInTypes = signal<WalkInType[]>([]);
  walkInTypeModal = signal<Partial<WalkInType> | null>(null);
  walkInTypeForm: FormGroup;
  walkInTypeSaving = signal(false);
  walkInTypeError = signal('');
  walkInTransactions = signal<WalkInTransaction[]>([]);
  walkInTransactionsLoading = signal(false);

  // Referrals tab
  referrers = signal<EventReferrer[]>([]);
  referrerModal = signal(false);
  referrerForm: FormGroup;
  referrerSaving = signal(false);
  referrerError = signal('');

  // Email tab
  emailSubject = '';
  emailBody = '';
  testEmailAddress = '';
  emailSending = signal(false);
  emailSuccess = signal('');
  emailError = signal('');
  ticketHoldersCount = signal<number | null>(null);

  // Transfer modal
  transferModal = signal<Ticket | null>(null);
  transferForm: FormGroup;
  transferSaving = signal(false);
  transferError = signal('');

  // Create custom ticket modal
  createTicketModal = signal(false);
  createTicketForm: FormGroup;
  createTicketSaving = signal(false);
  createTicketError = signal('');

  // Scanner tab
  pinRefreshing = signal(false);
  pinCopied = signal(false);
  linkCopied = signal(false);

  // Shared
  confirmModal = signal<{ action: string; ticket: Ticket } | null>(null);

  tabs = [
    { id: 'overview', label: 'Overview', ticketingOnly: false },
    { id: 'sales', label: 'Sales', ticketingOnly: false },
    { id: 'referrals', label: 'Referrals', ticketingOnly: true },
    { id: 'email', label: 'Email', ticketingOnly: false },
    { id: 'scanner', label: 'Scanner', ticketingOnly: true },
  ];

  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
    if (tabId === 'sales') {
      this.loadWalkInTransactions();
    }
  }

  isTicketingDisabled(): boolean {
    return this.event()?.ticketing_enabled === false;
  }

  hasExistingTickets(): boolean {
    return (this.event()?.tickets_sold || 0) > 0;
  }

  routeEventId(): number {
    return +(this.route.snapshot.paramMap.get('id') || 0);
  }

  constructor(
    private route: ActivatedRoute,
    public eventsService: EventsService,
    public ticketsService: TicketsService,
    private ticketTypeService: TicketTypeService,
    private walkInService: WalkInService,
    private referrerService: ReferrerService,
    private fb: FormBuilder
  ) {
    this.ticketTypeForm = this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      max_tickets: [0],
      start_date: [''],
      end_date: [''],
      special_instructions: [''],
      special_instructions_for_scanner: [''],
      disabled: [false],
    });

    this.walkInTypeForm = this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      max_slots: [0],
    });

    this.referrerForm = this.fb.group({
      name: ['', Validators.required],
      referral_code: ['', Validators.required],
    });

    this.transferForm = this.fb.group({
      name: ['', Validators.required],
      email_address: ['', [Validators.required, Validators.email]],
      contact_number: ['', Validators.required],
    });

    this.createTicketForm = this.fb.group({
      ticket_type_id: ['', Validators.required],
      name: ['', Validators.required],
      email_address: ['', [Validators.required, Validators.email]],
      contact_number: ['', Validators.required],
      number_of_entries: [1, [Validators.required, Validators.min(1)]],
      price_per_ticket: [null],
      send_email: [true],
    });
  }

  ngOnInit(): void {
    const id = this.routeEventId();
    this.eventsService.getEvent(id).subscribe({ next: (e) => this.event.set(e) });
    this.loadTickets();
    this.loadTicketSummary();
    this.loadTicketTypes();
    this.loadPendingTickets();
    this.loadWalkInTypes();
    this.loadReferrers();
    this.loadTicketHoldersCount();
  }

  // ---- Tickets ----
  loadTickets(): void {
    const id = this.routeEventId();
    this.ticketsLoading.set(true);
    this.ticketsService.getTickets({
      event_id: id,
      status_filter: 'sent',
      search: this.ticketSearch || undefined,
    }).subscribe({
      next: (res) => { this.tickets.set(res.tickets); this.ticketsLoading.set(false); },
      error: () => this.ticketsLoading.set(false)
    });
  }

  // ---- Ticket Summary ----
  loadTicketSummary(): void {
    this.ticketSummaryLoading.set(true);
    this.eventsService.getTicketSummary({ event_id: this.routeEventId() }).subscribe({
      next: (res) => { this.ticketSummary.set(res.summary); this.ticketSummaryLoading.set(false); },
      error: () => this.ticketSummaryLoading.set(false)
    });
  }

  // ---- Ticket Types ----
  loadTicketTypes(): void {
    this.ticketTypeService.getTicketTypes(this.routeEventId()).subscribe({
      next: (res) => this.ticketTypes.set(res.ticketTypes),
      error: () => {}
    });
  }

  openTicketTypeModal(tt?: TicketType): void {
    this.ticketTypeError.set('');
    if (tt) {
      this.ticketTypeModal.set(tt);
      this.ticketTypeForm.patchValue({
        name: tt.name,
        price: tt.price,
        max_tickets: tt.max_tickets,
        start_date: tt.start_date?.slice(0, 16) || '',
        end_date: tt.end_date?.slice(0, 16) || '',
        special_instructions: tt.special_instructions || '',
        special_instructions_for_scanner: tt.special_instructions_for_scanner || '',
        disabled: tt.disabled,
      });
    } else {
      this.ticketTypeModal.set({});
      this.ticketTypeForm.reset({ name: '', price: 0, max_tickets: 0, start_date: '', end_date: '', special_instructions: '', special_instructions_for_scanner: '', disabled: false });
    }
  }

  saveTicketType(): void {
    if (this.ticketTypeForm.invalid) return;
    this.ticketTypeSaving.set(true);
    this.ticketTypeError.set('');
    const data = { ...this.ticketTypeForm.value };
    if (!data.start_date) delete data.start_date;
    if (!data.end_date) delete data.end_date;

    const modal = this.ticketTypeModal();
    const action = modal?.id
      ? this.ticketTypeService.updateTicketType(modal.id, data)
      : this.ticketTypeService.createTicketType(this.routeEventId(), data);

    action.subscribe({
      next: () => {
        this.ticketTypeModal.set(null);
        this.ticketTypeSaving.set(false);
        this.loadTicketTypes();
      },
      error: (err) => {
        this.ticketTypeError.set(err.error?.error || 'Failed to save ticket type.');
        this.ticketTypeSaving.set(false);
      }
    });
  }

  deleteTicketType(tt: TicketType): void {
    if (!confirm(`Delete ticket type "${tt.name}"?`)) return;
    this.ticketTypeService.deleteTicketType(tt.id).subscribe({
      next: () => this.loadTicketTypes(),
      error: (err) => alert(err.error?.error || 'Failed to delete ticket type.')
    });
  }

  // ---- Pending Orders ----
  loadPendingTickets(): void {
    this.pendingLoading.set(true);
    this.eventsService.getPendingTickets({ event_id: this.routeEventId(), search: this.pendingSearch || undefined }).subscribe({
      next: (res) => { this.pendingTickets.set(res.tickets); this.pendingLoading.set(false); },
      error: () => this.pendingLoading.set(false)
    });
  }

  markPaid(ticket: Ticket): void {
    this.eventsService.markTicketPaid([ticket.id]).subscribe({
      next: () => this.loadPendingTickets()
    });
  }

  verifyPayments(): void {
    if (!confirm('Verify all payments for this event? This will check payment statuses automatically.')) return;
    this.eventsService.verifyPayments(this.routeEventId()).subscribe({
      next: () => this.loadPendingTickets()
    });
  }

  cancelAllUnpaid(): void {
    if (!confirm('Cancel ALL unpaid (New status) orders? This cannot be undone.')) return;
    this.eventsService.cancelAllUnpaid(this.routeEventId()).subscribe({
      next: () => this.loadPendingTickets()
    });
  }

  // ---- Walk-In Types ----
  loadWalkInTypes(): void {
    this.walkInService.getWalkInTypes(this.routeEventId()).subscribe({
      next: (res) => this.walkInTypes.set(res.walkInTypes),
      error: () => {}
    });
  }

  openWalkInTypeModal(wt?: WalkInType): void {
    this.walkInTypeError.set('');
    if (wt) {
      this.walkInTypeModal.set(wt);
      this.walkInTypeForm.patchValue({ name: wt.name, price: wt.price, max_slots: wt.max_slots });
    } else {
      this.walkInTypeModal.set({});
      this.walkInTypeForm.reset({ name: '', price: 0, max_slots: 0 });
    }
  }

  saveWalkInType(): void {
    if (this.walkInTypeForm.invalid) return;
    this.walkInTypeSaving.set(true);
    this.walkInTypeError.set('');
    const data = this.walkInTypeForm.value;
    const modal = this.walkInTypeModal();

    const action = modal?.id
      ? this.walkInService.updateWalkInType(modal.id, data)
      : this.walkInService.createWalkInType(this.routeEventId(), data);

    action.subscribe({
      next: () => {
        this.walkInTypeModal.set(null);
        this.walkInTypeSaving.set(false);
        this.loadWalkInTypes();
      },
      error: (err) => {
        this.walkInTypeError.set(err.error?.error || 'Failed to save walk-in type.');
        this.walkInTypeSaving.set(false);
      }
    });
  }

  deleteWalkInType(wt: WalkInType): void {
    if (!confirm(`Delete walk-in type "${wt.name}"?`)) return;
    this.walkInService.deleteWalkInType(wt.id).subscribe({
      next: () => this.loadWalkInTypes(),
      error: (err) => alert(err.error?.error || 'Failed to delete walk-in type.')
    });
  }

  loadWalkInTransactions(): void {
    this.walkInTransactionsLoading.set(true);
    this.walkInService.getWalkInTransactions({ event_id: this.routeEventId() }).subscribe({
      next: (res) => { this.walkInTransactions.set(res.transactions); this.walkInTransactionsLoading.set(false); },
      error: () => this.walkInTransactionsLoading.set(false)
    });
  }

  // ---- Referrals ----
  loadReferrers(): void {
    this.referrerService.getReferrers(this.routeEventId()).subscribe({
      next: (res) => this.referrers.set(res.referrers),
      error: () => {}
    });
  }

  openReferrerModal(): void {
    this.referrerError.set('');
    this.referrerForm.reset({ name: '', referral_code: '' });
    this.referrerModal.set(true);
  }

  saveReferrer(): void {
    if (this.referrerForm.invalid) return;
    this.referrerSaving.set(true);
    this.referrerError.set('');
    this.referrerService.createReferrer(this.routeEventId(), this.referrerForm.value).subscribe({
      next: () => {
        this.referrerModal.set(false);
        this.referrerSaving.set(false);
        this.loadReferrers();
      },
      error: (err) => {
        this.referrerError.set(err.error?.error || 'Failed to add referrer.');
        this.referrerSaving.set(false);
      }
    });
  }

  deleteReferrer(ref: EventReferrer): void {
    if (!confirm(`Delete referrer "${ref.name}"?`)) return;
    this.referrerService.deleteReferrer(ref.id).subscribe({
      next: () => this.loadReferrers(),
      error: (err) => alert(err.error?.error || 'Failed to delete referrer.')
    });
  }

  copyLink(link: string): void {
    navigator.clipboard.writeText(link).then(() => alert('Link copied to clipboard!'));
  }

  // ---- Email ----
  loadTicketHoldersCount(): void {
    this.eventsService.getTicketHoldersCount(this.routeEventId()).subscribe({
      next: (res) => this.ticketHoldersCount.set(res.count),
      error: () => {}
    });
  }

  sendEmail(): void {
    if (!this.emailSubject || !this.emailBody) return;
    if (!confirm(`Send email to ${this.ticketHoldersCount()} ticket holders?`)) return;
    this.emailSending.set(true);
    this.emailSuccess.set('');
    this.emailError.set('');
    this.eventsService.sendEmail({ event_id: this.routeEventId(), subject: this.emailSubject, body: this.emailBody }).subscribe({
      next: (res) => {
        this.emailSuccess.set(res.message || 'Email sent successfully.');
        this.emailSending.set(false);
      },
      error: (err) => {
        this.emailError.set(err.error?.error || 'Failed to send email.');
        this.emailSending.set(false);
      }
    });
  }

  sendTestEmail(): void {
    if (!this.emailSubject || !this.emailBody || !this.testEmailAddress) return;
    this.emailSending.set(true);
    this.emailSuccess.set('');
    this.emailError.set('');
    this.eventsService.sendTestEmail({ event_id: this.routeEventId(), subject: this.emailSubject, body: this.emailBody, test_email: this.testEmailAddress }).subscribe({
      next: (res) => {
        this.emailSuccess.set(res.message || 'Test email sent.');
        this.emailSending.set(false);
      },
      error: (err) => {
        this.emailError.set(err.error?.error || 'Failed to send test email.');
        this.emailSending.set(false);
      }
    });
  }

  // ---- Transfer ----
  openTransferModal(ticket: Ticket): void {
    this.transferError.set('');
    this.transferModal.set(ticket);
    this.transferForm.patchValue({
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
    });
  }

  executeTransfer(): void {
    const original = this.transferModal();
    if (!original || this.transferForm.invalid) return;
    this.transferSaving.set(true);
    this.transferError.set('');

    const transferData = this.transferForm.value;
    const newTicketData = {
      event_id: original.event_id,
      ticket_type_id: original.ticket_type_id,
      name: transferData.name,
      email_address: transferData.email_address,
      contact_number: transferData.contact_number,
      number_of_entries: original.number_of_entries,
      price_per_ticket: original.price_per_ticket,
      payment_processing_fee: original.payment_processing_fee,
      platform_fee: original.platform_fee ?? 0,
      ticket_paid: true,
      send_email: false,
      order_timestamp: original.order_timestamp,
    };

    // Step 1: create new ticket
    this.ticketsService.addTicket(newTicketData).subscribe({
      next: (createRes) => {
        const newTicketId = createRes.ticket?.id;
        if (!newTicketId) {
          this.transferError.set('Failed to create new ticket.');
          this.transferSaving.set(false);
          return;
        }
        // Step 2: resend (send actual ticket email)
        this.ticketsService.resendTicket(newTicketId).subscribe({
          next: () => {
            // Step 3: cancel original
            this.ticketsService.cancelTicket(original.id).subscribe({
              next: () => {
                this.transferModal.set(null);
                this.transferSaving.set(false);
                this.loadTickets();
                this.loadTicketSummary();
                alert(`Ticket transferred! New ticket code: ${createRes.ticket?.ticket_code || 'N/A'}`);
              },
              error: (err) => {
                this.transferError.set(err.error?.error || 'New ticket created but failed to cancel original.');
                this.transferSaving.set(false);
              }
            });
          },
          error: (err) => {
            this.transferError.set(err.error?.error || 'Ticket created but failed to send email.');
            this.transferSaving.set(false);
          }
        });
      },
      error: (err) => {
        this.transferError.set(err.error?.error || 'Failed to create new ticket.');
        this.transferSaving.set(false);
      }
    });
  }

  // ---- Create Custom Ticket ----
  openCreateTicketModal(): void {
    this.createTicketError.set('');
    this.createTicketForm.reset({
      ticket_type_id: '',
      name: '',
      email_address: '',
      contact_number: '',
      number_of_entries: 1,
      price_per_ticket: null,
      send_email: true,
    });
    this.createTicketModal.set(true);
  }

  saveCustomTicket(): void {
    if (this.createTicketForm.invalid) return;
    this.createTicketSaving.set(true);
    this.createTicketError.set('');

    const v = this.createTicketForm.value;
    const data: any = {
      event_id: this.routeEventId(),
      ticket_type_id: +v.ticket_type_id,
      name: v.name,
      email_address: v.email_address,
      contact_number: v.contact_number,
      number_of_entries: v.number_of_entries,
      ticket_paid: true,
      send_email: v.send_email,
    };
    if (v.price_per_ticket != null && v.price_per_ticket !== '') {
      data.price_per_ticket = +v.price_per_ticket;
    }

    this.ticketsService.addTicket(data).subscribe({
      next: (res) => {
        this.createTicketModal.set(false);
        this.createTicketSaving.set(false);
        this.loadTickets();
        this.loadTicketSummary();
        alert(`Ticket created! Code: ${res.ticket?.ticket_code || 'N/A'}`);
      },
      error: (err) => {
        this.createTicketError.set(err.error?.error || 'Failed to create ticket.');
        this.createTicketSaving.set(false);
      }
    });
  }

  // ---- Scanner ----
  refreshPin(): void {
    if (!confirm('Regenerate the verification PIN? This will invalidate all active scanner sessions for this event.')) return;
    this.pinRefreshing.set(true);
    this.eventsService.refreshPin(this.routeEventId()).subscribe({
      next: (res) => {
        const e = this.event();
        if (e) this.event.set({ ...e, verification_pin: res.verification_pin });
        this.pinRefreshing.set(false);
      },
      error: () => this.pinRefreshing.set(false)
    });
  }

  copyToClipboard(text: string, field: 'pin' | 'link'): void {
    navigator.clipboard.writeText(text).then(() => {
      if (field === 'pin') {
        this.pinCopied.set(true);
        setTimeout(() => this.pinCopied.set(false), 2000);
      } else {
        this.linkCopied.set(true);
        setTimeout(() => this.linkCopied.set(false), 2000);
      }
    });
  }

  qrUrl(url: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(url)}`;
  }

  downloadQrCode(url: string, name: string): void {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(url)}`;
    fetch(qrUrl)
      .then(r => r.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${name.replace(/\s+/g, '-')}-qr.png`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => window.open(qrUrl, '_blank'));
  }

  // ---- Shared ----
  togglePublish(): void {
    const e = this.event();
    if (!e) return;
    const action = e.status === 'published'
      ? this.eventsService.unpublishEvent(e.id)
      : this.eventsService.publishEvent(e.id);
    action.subscribe({ next: () => this.eventsService.getEvent(e.id).subscribe(ev => this.event.set(ev)) });
  }

  confirmAction(action: string, ticket: Ticket): void {
    this.confirmModal.set({ action, ticket });
  }

  executeAction(): void {
    const modal = this.confirmModal();
    if (!modal) return;
    const action = modal.action === 'cancel'
      ? this.ticketsService.cancelTicket(modal.ticket.id)
      : this.ticketsService.refundTicket(modal.ticket.id);
    action.subscribe({
      next: () => {
        this.confirmModal.set(null);
        this.loadTickets();
        this.loadPendingTickets();
        this.loadTicketSummary();
      }
    });
  }

  resendTicket(ticket: Ticket): void {
    this.ticketsService.resendTicket(ticket.id).subscribe();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'published': return 'border-green-300 text-green-700 bg-green-50';
      case 'past': return 'border-blue-300 text-blue-700 bg-blue-50';
      default: return 'border-gray-300 text-gray-500 bg-gray-50';
    }
  }

  ticketStatusClass(status: string): string {
    switch (status) {
      case 'Ticket sent.': return 'border-green-300 text-green-700 bg-green-50';
      case 'Payment Confirmed': return 'border-blue-300 text-blue-700 bg-blue-50';
      case 'New': return 'border-yellow-300 text-yellow-700 bg-yellow-50';
      case 'Canceled': return 'border-gray-300 text-gray-500 bg-gray-50';
      case 'Refunded': return 'border-red-300 text-red-600 bg-red-50';
      default: return 'border-gray-300 text-gray-500 bg-gray-50';
    }
  }

  ticketStatusLabel(status: string): string {
    switch (status) {
      case 'Ticket sent.': return 'Sent';
      case 'Payment Confirmed': return 'Confirmed';
      case 'New': return 'Pending';
      case 'Canceled': return 'Canceled';
      case 'Refunded': return 'Refunded';
      default: return status;
    }
  }
}
