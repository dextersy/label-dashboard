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
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/events" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900">{{ event()?.title }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">{{ event()?.venue }} · {{ event()?.date_and_time | date:'mediumDate' }}</p>
        </div>
        <a [routerLink]="['/events', routeEventId(), 'edit']"
           class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Edit
        </a>
        <button (click)="togglePublish()"
           class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
           [class]="event()?.status === 'published'
             ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
             : 'bg-green-100 text-green-700 hover:bg-green-200'">
          {{ event()?.status === 'published' ? 'Unpublish' : 'Publish' }}
        </button>
      </div>

      <!-- Tab Nav -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6 overflow-x-auto">
          @for (tab of tabs; track tab.id) {
            <button (click)="activeTab.set(tab.id)"
              class="pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              [class]="activeTab() === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'">
              {{ tab.label }}
            </button>
          }
        </nav>
      </div>

      <!-- ====== OVERVIEW TAB ====== -->
      @if (activeTab() === 'overview') {
        <div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p class="text-xs font-medium text-gray-500 uppercase">Tickets Sold</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ event()?.tickets_sold || 0 }}</p>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p class="text-xs font-medium text-gray-500 uppercase">Revenue</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ (event()?.total_revenue || 0) | currency:'PHP':'symbol':'1.0-0' }}</p>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p class="text-xs font-medium text-gray-500 uppercase">Status</p>
              <span class="inline-flex items-center mt-1 px-2.5 py-1 rounded-full text-sm font-medium"
                [class]="statusClass(event()?.status || '')">
                {{ event()?.status | titlecase }}
              </span>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p class="text-xs font-medium text-gray-500 uppercase">Walk-In</p>
              <p class="text-sm font-medium text-gray-900 mt-1">{{ event()?.walk_in_enabled ? 'Enabled' : 'Disabled' }}</p>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-semibold text-gray-900 mb-4">Event Details</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500">Date</dt>
                <dd class="font-medium text-gray-900 mt-0.5">{{ event()?.date_and_time | date:'long' }}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Venue</dt>
                <dd class="font-medium text-gray-900 mt-0.5">{{ event()?.venue || '—' }}</dd>
              </div>
              @if (event()?.buy_shortlink) {
                <div>
                  <dt class="text-gray-500">Buy Link</dt>
                  <dd class="font-medium text-primary-600 mt-0.5 truncate">
                    <a [href]="event()?.buy_shortlink" target="_blank">{{ event()?.buy_shortlink }}</a>
                  </dd>
                </div>
              }
              @if (event()?.description) {
                <div class="sm:col-span-2">
                  <dt class="text-gray-500">Description</dt>
                  <dd class="font-medium text-gray-900 mt-0.5">{{ event()?.description }}</dd>
                </div>
              }
            </dl>
          </div>
        </div>
      }

      <!-- ====== TICKETS TAB ====== -->
      @if (activeTab() === 'tickets') {
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <input type="text" [(ngModel)]="ticketSearch" (input)="loadTickets()"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search by name...">
            </div>
            <a [href]="ticketsService.exportCsvUrl({ event_id: routeEventId() })"
               class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export CSV
            </a>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            @if (ticketsLoading()) {
              <div class="flex items-center justify-center py-12">
                <div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            } @else if (tickets().length === 0) {
              <div class="text-center py-12 text-gray-500 text-sm">No tickets found.</div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200">
                    <tr>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Entries</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (ticket of tickets(); track ticket.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-3 font-medium text-gray-900">{{ ticket.name }}</td>
                        <td class="px-6 py-3 text-gray-500">{{ ticket.email_address }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ticket.ticket_type_name }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ticket.number_of_entries }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ticket.amount | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            [class]="ticketStatusClass(ticket.status)">
                            {{ ticketStatusLabel(ticket.status) }}
                          </span>
                        </td>
                        <td class="px-6 py-3">
                          <div class="flex items-center justify-end gap-2">
                            <button (click)="resendTicket(ticket)" class="text-xs text-primary-600 hover:text-primary-700 font-medium">Resend</button>
                            @if (ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed') {
                              <button (click)="confirmAction('cancel', ticket)" class="text-xs text-yellow-600 hover:text-yellow-700 font-medium">Cancel</button>
                              <button (click)="confirmAction('refund', ticket)" class="text-xs text-red-600 hover:text-red-700 font-medium">Refund</button>
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
      }

      <!-- ====== TICKET TYPES TAB ====== -->
      @if (activeTab() === 'ticket-types') {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-gray-900">Ticket Types</h2>
            <button (click)="openTicketTypeModal()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              + Add Ticket Type
            </button>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            @if (ticketTypes().length === 0) {
              <div class="text-center py-12 text-gray-500 text-sm">No ticket types yet. Add one to start selling tickets.</div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200">
                    <tr>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Max</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sold</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Pending</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (tt of ticketTypes(); track tt.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-3 font-medium text-gray-900">{{ tt.name }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ tt.price | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ tt.max_tickets === 0 ? '∞' : tt.max_tickets }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ tt.sold_tickets || 0 }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ tt.pending_tickets || 0 }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ tt.remaining_tickets == null ? '∞' : tt.remaining_tickets }}</td>
                        <td class="px-6 py-3">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            [class]="tt.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'">
                            {{ tt.disabled ? 'Disabled' : 'Active' }}
                          </span>
                        </td>
                        <td class="px-6 py-3">
                          <div class="flex items-center justify-end gap-2">
                            <button (click)="openTicketTypeModal(tt)" class="text-xs text-primary-600 hover:text-primary-700 font-medium">Edit</button>
                            <button (click)="deleteTicketType(tt)" class="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
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

      <!-- ====== PENDING ORDERS TAB ====== -->
      @if (activeTab() === 'pending') {
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <input type="text" [(ngModel)]="pendingSearch" (input)="loadPendingTickets()"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search by name...">
            </div>
            <div class="flex items-center gap-2">
              <a [href]="eventsService.getPendingCsvUrl(routeEventId())"
                 class="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Download CSV
              </a>
              <button (click)="verifyPayments()"
                class="px-3 py-2 border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors">
                Verify Payments
              </button>
              <button (click)="cancelAllUnpaid()"
                class="px-3 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                Cancel All Unpaid
              </button>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            @if (pendingLoading()) {
              <div class="flex items-center justify-center py-12">
                <div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            } @else if (pendingTickets().length === 0) {
              <div class="text-center py-12 text-gray-500 text-sm">No pending orders.</div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200">
                    <tr>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Entries</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ticket Type</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ordered</th>
                      <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (ticket of pendingTickets(); track ticket.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-3 font-medium text-gray-900">{{ ticket.name }}</td>
                        <td class="px-6 py-3 text-gray-500">{{ ticket.email_address }}</td>
                        <td class="px-6 py-3 text-gray-500">{{ ticket.contact_number || '—' }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ticket.number_of_entries }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ticket.ticket_type_name }}</td>
                        <td class="px-6 py-3">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            [class]="ticketStatusClass(ticket.status)">
                            {{ ticketStatusLabel(ticket.status) }}
                          </span>
                        </td>
                        <td class="px-6 py-3 text-gray-500">{{ ticket.order_timestamp | date:'short' }}</td>
                        <td class="px-6 py-3">
                          <div class="flex items-center justify-end gap-2">
                            <button (click)="markPaid(ticket)" class="text-xs text-green-600 hover:text-green-700 font-medium">Mark Paid</button>
                            <button (click)="confirmAction('cancel', ticket)" class="text-xs text-red-600 hover:text-red-700 font-medium">Cancel</button>
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

      <!-- ====== WALK-IN TAB ====== -->
      @if (activeTab() === 'walk-in') {
        <div>
          <!-- Walk-in sub-nav -->
          <div class="flex gap-4 mb-5">
            <button (click)="walkInView.set('types')"
              class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              [class]="walkInView() === 'types' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'">
              Walk-In Types
            </button>
            <button (click)="walkInView.set('transactions'); loadWalkInTransactions()"
              class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              [class]="walkInView() === 'transactions' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'">
              Transactions
            </button>
          </div>

          @if (walkInView() === 'types') {
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-base font-semibold text-gray-900">Walk-In Types</h2>
                <button (click)="openWalkInTypeModal()"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                  + Add Type
                </button>
              </div>
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                @if (walkInTypes().length === 0) {
                  <div class="text-center py-12 text-gray-500 text-sm">No walk-in types yet.</div>
                } @else {
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200">
                      <tr>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Max Slots</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sold</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Remaining</th>
                        <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (wt of walkInTypes(); track wt.id) {
                        <tr class="hover:bg-gray-50">
                          <td class="px-6 py-3 font-medium text-gray-900">{{ wt.name }}</td>
                          <td class="px-6 py-3 text-gray-700">{{ wt.price | currency:'PHP':'symbol':'1.2-2' }}</td>
                          <td class="px-6 py-3 text-gray-700">{{ wt.max_slots === 0 ? '∞' : wt.max_slots }}</td>
                          <td class="px-6 py-3 text-gray-700">{{ wt.sold_count || 0 }}</td>
                          <td class="px-6 py-3 text-gray-700">{{ wt.remaining_slots == null ? '∞' : wt.remaining_slots }}</td>
                          <td class="px-6 py-3">
                            <div class="flex items-center justify-end gap-2">
                              <button (click)="openWalkInTypeModal(wt)" class="text-xs text-primary-600 hover:text-primary-700 font-medium">Edit</button>
                              <button (click)="deleteWalkInType(wt)" class="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </div>
          }

          @if (walkInView() === 'transactions') {
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              @if (walkInTransactionsLoading()) {
                <div class="flex items-center justify-center py-12">
                  <div class="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              } @else if (walkInTransactions().length === 0) {
                <div class="text-center py-12 text-gray-500 text-sm">No walk-in transactions yet.</div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="border-b border-gray-200">
                      <tr>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Payment</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">By</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (tx of walkInTransactions(); track tx.id) {
                        <tr class="hover:bg-gray-50">
                          <td class="px-6 py-3 text-gray-500">{{ tx.created_at | date:'short' }}</td>
                          <td class="px-6 py-3 text-gray-700">
                            @for (item of tx.items; track item.id) {
                              <div>{{ item.quantity }}× {{ item.walk_in_type_name }}</div>
                            }
                          </td>
                          <td class="px-6 py-3 text-gray-700 capitalize">{{ tx.payment_method }}</td>
                          <td class="px-6 py-3 text-gray-700">{{ tx.total_amount | currency:'PHP':'symbol':'1.2-2' }}</td>
                          <td class="px-6 py-3 text-gray-500">{{ tx.registered_by_name || tx.registered_by }}</td>
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

      <!-- ====== REFERRALS TAB ====== -->
      @if (activeTab() === 'referrals') {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-gray-900">Referrers</h2>
            <button (click)="openReferrerModal()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              + Add Referrer
            </button>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            @if (referrers().length === 0) {
              <div class="text-center py-12 text-gray-500 text-sm">No referrers yet.</div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b border-gray-200">
                    <tr>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tickets Sold</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Gross</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Net</th>
                      <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Shortlink</th>
                      <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (ref of referrers(); track ref.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-3 font-medium text-gray-900">{{ ref.name }}</td>
                        <td class="px-6 py-3 font-mono text-gray-700">{{ ref.referral_code }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ ref.tickets_sold || 0 }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ (ref.gross || 0) | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3 text-gray-700">{{ (ref.net || 0) | currency:'PHP':'symbol':'1.2-2' }}</td>
                        <td class="px-6 py-3 text-gray-500 truncate max-w-[160px]">
                          @if (ref.referral_shortlink) {
                            <a [href]="ref.referral_shortlink" target="_blank" class="text-primary-600 hover:underline">{{ ref.referral_shortlink }}</a>
                          } @else {
                            —
                          }
                        </td>
                        <td class="px-6 py-3">
                          <div class="flex items-center justify-end gap-2">
                            @if (ref.referral_shortlink) {
                              <button (click)="copyLink(ref.referral_shortlink)" class="text-xs text-gray-500 hover:text-gray-700 font-medium">Copy Link</button>
                            }
                            <button (click)="deleteReferrer(ref)" class="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
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
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-gray-900">Email Ticket Holders</h2>
              @if (ticketHoldersCount() !== null) {
                <span class="text-sm text-gray-500">{{ ticketHoldersCount() }} recipient{{ ticketHoldersCount() !== 1 ? 's' : '' }}</span>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input type="text" [(ngModel)]="emailSubject"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Email subject...">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Body *</label>
              <textarea [(ngModel)]="emailBody" rows="10"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono resize-y"
                placeholder="Email body (HTML supported)..."></textarea>
              <p class="mt-1 text-xs text-gray-400">You can use HTML for formatting.</p>
            </div>

            @if (emailSuccess()) {
              <div class="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{{ emailSuccess() }}</div>
            }
            @if (emailError()) {
              <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ emailError() }}</div>
            }

            <div class="flex items-end gap-3 pt-2 border-t border-gray-100">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Test Email Address</label>
                <input type="email" [(ngModel)]="testEmailAddress"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="you@example.com">
              </div>
              <button (click)="sendTestEmail()" [disabled]="emailSending()"
                class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {{ emailSending() ? 'Sending...' : 'Send Test' }}
              </button>
              <button (click)="sendEmail()" [disabled]="emailSending()"
                class="px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {{ emailSending() ? 'Sending...' : 'Send to All' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ====== TICKET TYPE MODAL ====== -->
      @if (ticketTypeModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div class="fixed inset-0 bg-black/30" (click)="ticketTypeModal.set(null)"></div>
          <div class="relative bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
            <h3 class="text-base font-semibold text-gray-900 mb-4">
              {{ ticketTypeModal()!.id ? 'Edit Ticket Type' : 'Add Ticket Type' }}
            </h3>
            <form [formGroup]="ticketTypeForm" (ngSubmit)="saveTicketType()" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" formControlName="name"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Price (PHP) *</label>
                  <input type="number" formControlName="price" min="0" step="0.01"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Max Tickets <span class="text-gray-400 font-normal">(0=unlimited)</span></label>
                  <input type="number" formControlName="max_tickets" min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Sale Start</label>
                  <input type="datetime-local" formControlName="start_date"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Sale End</label>
                  <input type="datetime-local" formControlName="end_date"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <textarea formControlName="special_instructions" rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Shown to buyer at checkout..."></textarea>
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Instructions for Scanner</label>
                  <textarea formControlName="special_instructions_for_scanner" rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Shown to scanner staff..."></textarea>
                </div>
                <div class="col-span-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" formControlName="disabled"
                      class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                    <span class="text-sm text-gray-700">Disable this ticket type</span>
                  </label>
                </div>
              </div>
              @if (ticketTypeError()) {
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ ticketTypeError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" (click)="ticketTypeModal.set(null)"
                  class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" [disabled]="ticketTypeForm.invalid || ticketTypeSaving()"
                  class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
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
          <div class="fixed inset-0 bg-black/30" (click)="walkInTypeModal.set(null)"></div>
          <div class="relative bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 class="text-base font-semibold text-gray-900 mb-4">
              {{ walkInTypeModal()!.id ? 'Edit Walk-In Type' : 'Add Walk-In Type' }}
            </h3>
            <form [formGroup]="walkInTypeForm" (ngSubmit)="saveWalkInType()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" formControlName="name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Price (PHP) *</label>
                <input type="number" formControlName="price" min="0" step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max Slots <span class="text-gray-400 font-normal">(0=unlimited)</span></label>
                <input type="number" formControlName="max_slots" min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              </div>
              @if (walkInTypeError()) {
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ walkInTypeError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" (click)="walkInTypeModal.set(null)"
                  class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" [disabled]="walkInTypeForm.invalid || walkInTypeSaving()"
                  class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
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
          <div class="fixed inset-0 bg-black/30" (click)="referrerModal.set(false)"></div>
          <div class="relative bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 class="text-base font-semibold text-gray-900 mb-4">Add Referrer</h3>
            <form [formGroup]="referrerForm" (ngSubmit)="saveReferrer()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" formControlName="name"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Referral Code *</label>
                <input type="text" formControlName="referral_code"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. FRIEND2025">
              </div>
              @if (referrerError()) {
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ referrerError() }}</div>
              }
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" (click)="referrerModal.set(false)"
                  class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" [disabled]="referrerForm.invalid || referrerSaving()"
                  class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
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
          <div class="fixed inset-0 bg-black/30" (click)="confirmModal.set(null)"></div>
          <div class="relative bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h3 class="text-base font-semibold text-gray-900 mb-2">
              {{ confirmModal()!.action === 'cancel' ? 'Cancel Ticket' : 'Refund Ticket' }}
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              Are you sure you want to {{ confirmModal()!.action }} this ticket for
              <strong>{{ confirmModal()!.ticket.name }}</strong>?
            </p>
            <div class="flex justify-end gap-3">
              <button (click)="confirmModal.set(null)"
                class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button (click)="executeAction()"
                class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                Confirm
              </button>
            </div>
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
  walkInView = signal<'types' | 'transactions'>('types');
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

  // Shared
  confirmModal = signal<{ action: string; ticket: Ticket } | null>(null);

  tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'ticket-types', label: 'Ticket Types' },
    { id: 'pending', label: 'Pending Orders' },
    { id: 'walk-in', label: 'Walk-In' },
    { id: 'referrals', label: 'Referrals' },
    { id: 'email', label: 'Email' },
  ];

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
  }

  ngOnInit(): void {
    const id = this.routeEventId();
    this.eventsService.getEvent(id).subscribe({ next: (e) => this.event.set(e) });
    this.loadTickets();
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
      }
    });
  }

  resendTicket(ticket: Ticket): void {
    this.ticketsService.resendTicket(ticket.id).subscribe();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'past': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  ticketStatusClass(status: string): string {
    switch (status) {
      case 'Ticket sent.': return 'bg-green-100 text-green-700';
      case 'Payment Confirmed': return 'bg-blue-100 text-blue-700';
      case 'New': return 'bg-yellow-100 text-yellow-700';
      case 'Canceled': return 'bg-gray-100 text-gray-600';
      case 'Refunded': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
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
