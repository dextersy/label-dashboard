import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { EventsService } from '../../../services/events.service';
import { TicketTypeService } from '../../../services/ticket-type.service';
import { GooglePlacesService, GooglePlacesPrediction, VenueSelection } from '../../../services/google-places.service';
import { AuthService } from '../../../services/auth.service';
import { OrganizationService, EventFeeSettings } from '../../../services/organization.service';
import { EventTag } from '../../../models/event.model';

interface TicketTypeFormItem {
  id?: number;
  name: string;
  price: number;
  isFree: boolean;
  max_tickets: number;
  isUnlimited: boolean;
  start_date: string | null;
  end_date: string | null;
  showDateRange: boolean;
  disabled: boolean;
  special_instructions: string | null;
  special_instructions_for_scanner: string | null;
  isEditing: boolean;
  _backup?: TicketTypeFormItem;
}

function newTicketTypeItem(): TicketTypeFormItem {
  return {
    name: '', price: 0, isFree: false,
    max_tickets: 0, isUnlimited: true,
    start_date: null, end_date: null, showDateRange: false,
    disabled: false,
    special_instructions: null, special_instructions_for_scanner: null,
    isEditing: true
  };
}

type FormTab = 'details' | 'tickets' | 'walk-in' | 'discovery';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, RouterLink],
  styles: [`
    .venue-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
      background: white; border: 1px solid rgba(0,0,0,0.12); border-radius: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12); max-height: 260px;
      overflow-y: auto; margin-top: 2px;
    }
  `],
  template: `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/app/events" class="text-gray-400 hover:text-gray-900 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h1 class="text-xl font-black text-gray-900 uppercase tracking-tight">{{ isEdit() ? 'Edit Event' : 'New Event' }}</h1>
          <p class="text-xs font-mono text-gray-400 mt-0.5">{{ isEdit() ? 'update event details' : 'fill in the details to list your show' }}</p>
        </div>
      </div>

      @if (error()) {
        <div class="mb-5 p-3 border border-red-300 bg-red-50 text-red-600 text-xs font-mono">{{ error() }}</div>
      }

      <!-- Tab Nav -->
      <div class="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
        @for (tab of tabs; track tab.id) {
          <button type="button" (click)="activeTab.set(tab.id)"
            class="flex items-center gap-1.5 px-5 py-3 text-xs font-mono uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors"
            [class]="activeTab() === tab.id
              ? 'border-yellow-400 text-yellow-500'
              : 'border-transparent text-gray-400 hover:text-gray-900'">
            {{ tab.label }}
            @if (tab.id === 'tickets' && form.get('ticketing_enabled')?.value) {
              <span class="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            }
            @if (tab.id === 'walk-in' && form.get('walk_in_enabled')?.value) {
              <span class="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            }
          </button>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()">

        <!-- ===================================================== -->
        <!-- TAB: DETAILS                                          -->
        <!-- ===================================================== -->
        @if (activeTab() === 'details') {
          <div class="space-y-4">

            <!-- Title + dates -->
            <div class="bg-white border border-gray-200 p-6 space-y-5">
              <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Event Info</h2>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Event Title *</label>
                <input type="text" formControlName="title"
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="Concert Night 2025">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Start Date & Time *</label>
                  <input type="datetime-local" formControlName="date_and_time"
                    (change)="onEventDateChange()"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                </div>

                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Close Ticket Sales</label>
                  <label class="flex items-center gap-2 mb-2 cursor-pointer select-none">
                    <input type="checkbox" [(ngModel)]="closeAtShowTime" [ngModelOptions]="{standalone:true}"
                      (change)="onCloseAtShowTimeChange()"
                      class="w-4 h-4 accent-yellow-400">
                    <span class="text-xs font-mono text-gray-500">At show time</span>
                  </label>
                  @if (!closeAtShowTime) {
                    <input type="datetime-local" formControlName="close_time"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                    <div class="flex flex-wrap gap-1.5 mt-2">
                      @for (s of closeTimeSuggestions; track s.label) {
                        <button type="button" (click)="applyCloseTimeSuggestion(s.offsetMinutes)"
                          class="px-2 py-0.5 text-xs font-mono border border-gray-300 text-gray-400 hover:text-gray-900 hover:border-gray-500 transition-colors">
                          {{ s.label }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Venue -->
            <div class="bg-white border border-gray-200 p-6 space-y-4">
              <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Venue</h2>
              <div class="relative">
                <input type="text" [(ngModel)]="venueQuery" [ngModelOptions]="{standalone:true}"
                  (input)="onVenueInput()" (focus)="onVenueFocus()" (blur)="onVenueBlur()"
                  placeholder="Search venue name or address..."
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors pr-8">
                @if (venueSearching()) {
                  <div class="absolute right-3 top-3">
                    <div class="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
                @if (venueDropdownOpen() && venuePredictions().length > 0) {
                  <div class="venue-dropdown">
                    @for (p of venuePredictions(); track p.place_id) {
                      <button type="button" (mousedown)="selectVenuePrediction(p)"
                        class="w-full text-left px-4 py-2.5 hover:bg-zinc-50 border-b border-gray-100 last:border-0">
                        <div class="text-sm font-medium text-gray-900">{{ p.structured_formatting.main_text }}</div>
                        <div class="text-xs font-mono text-gray-400">{{ p.structured_formatting.secondary_text }}</div>
                      </button>
                    }
                  </div>
                }
              </div>
              @if (selectedVenue()) {
                <div class="p-2 border border-yellow-400/30 bg-yellow-50 flex items-center justify-between">
                  <div class="text-xs font-mono text-yellow-600 min-w-0">
                    <span class="font-medium">{{ selectedVenue()!.venue }}</span>
                    @if (selectedVenue()!.venue_address) {
                      <span class="text-yellow-500/70 ml-1">— {{ selectedVenue()!.venue_address }}</span>
                    }
                  </div>
                  <button type="button" (click)="clearVenueSelection()" class="text-gray-400 hover:text-gray-700 ml-2 flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }
            </div>

            <!-- Description + Media -->
            <div class="bg-white border border-gray-200 p-6 space-y-5">
              <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">About the Event</h2>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea formControlName="description" rows="5"
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors resize-none"
                  placeholder="Describe your event..."></textarea>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Event Poster</label>
                  <input type="file" accept="image/*" (change)="onPosterChange($event)"
                    class="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:border file:border-gray-300 file:text-xs file:font-mono file:text-gray-500 file:bg-white file:uppercase file:tracking-wider hover:file:text-gray-900 hover:file:border-gray-500 transition-colors">
                  @if (posterPreview()) {
                    <img [src]="posterPreview()" alt="Poster preview" class="mt-3 h-32 object-cover border border-gray-200">
                  }
                </div>

                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">RSVP / Social Link <span class="normal-case text-gray-400">(optional)</span></label>
                  <input type="url" formControlName="rsvp_link"
                    class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                    placeholder="https://facebook.com/events/...">
                  <p class="mt-1.5 text-xs font-mono text-gray-400">Shown on the public event page alongside ticket info.</p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ===================================================== -->
        <!-- TAB: TICKETS                                          -->
        <!-- ===================================================== -->
        @if (activeTab() === 'tickets') {
          <div class="space-y-4">

            <!-- Ticketing toggle -->
            <div class="bg-white border border-gray-200 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xs font-black text-gray-900 uppercase tracking-widest">Sell Tickets Online</h2>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">Enable to sell tickets through this platform with online payment.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" formControlName="ticketing_enabled" class="sr-only peer">
                  <div class="w-10 h-5 bg-gray-200 peer-checked:bg-yellow-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
            </div>

            @if (!form.get('ticketing_enabled')?.value) {
              <!-- Listing-only mode -->
              <div class="bg-white border border-gray-200 p-6 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-xs font-black text-gray-900 uppercase tracking-widest">External Ticket Link</h2>
                    <p class="text-xs font-mono text-gray-400 mt-0.5">Direct buyers to another ticketing platform.</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" [(ngModel)]="hasExternalLink" [ngModelOptions]="{standalone:true}" class="sr-only peer">
                    <div class="w-10 h-5 bg-gray-200 peer-checked:bg-yellow-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>
                @if (hasExternalLink) {
                  <div>
                    <input type="url" formControlName="external_ticket_link"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="https://...">
                  </div>
                }
              </div>
            }

            @if (form.get('ticketing_enabled')?.value) {

              <!-- Fee info -->
              @if (feeSettings(); as fee) {
                <div class="p-3 bg-gray-50 border border-gray-200 text-xs font-mono text-gray-500 flex items-start gap-2">
                  <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>
                    @if (fee.revenue_percentage_fee > 0) {
                      Platform fee: <strong class="text-gray-700">{{ fee.revenue_percentage_fee }}%</strong> of {{ fee.fee_revenue_type }} sales{{ fee.transaction_fixed_fee > 0 ? ' + ₱' + (fee.transaction_fixed_fee | number:'1.0-2') + ' per ticket' : '' }}. You keep {{ 100 - fee.revenue_percentage_fee }}%.
                    } @else if (fee.transaction_fixed_fee > 0) {
                      Platform fee: <strong class="text-gray-700">₱{{ fee.transaction_fixed_fee | number:'1.0-2' }}</strong> per ticket.
                    } @else {
                      No platform fee — you keep 100% of your sales.
                    }
                  </span>
                </div>
              }

              <!-- Ticket Types -->
              <div class="bg-white border border-gray-200 p-6">
                <div class="flex items-center justify-between mb-5">
                  <div>
                    <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Ticket Types</h2>
                    <p class="text-xs font-mono text-gray-400 mt-0.5">Add one or more ticket tiers (e.g. General, VIP).</p>
                  </div>
                  <button type="button" (click)="addTicketType()"
                    class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
                    + Add Type
                  </button>
                </div>

                @if (ticketTypes.length === 0) {
                  <p class="text-xs font-mono text-gray-400 text-center py-6">No ticket types yet. Add one above.</p>
                }

                <div class="space-y-2">
                  @for (tt of ticketTypes; track tt; let i = $index) {
                    <div class="border border-gray-200 overflow-hidden">

                      <!-- VIEW MODE -->
                      @if (!tt.isEditing) {
                        <div class="flex items-center justify-between px-4 py-3 bg-gray-50">
                          <div class="min-w-0">
                            <span class="text-sm font-bold text-gray-900 uppercase">{{ tt.name }}</span>
                            <span class="ml-2 text-sm font-mono text-gray-400">{{ tt.isFree ? 'Free' : (tt.price | currency:'PHP':'symbol':'1.0-0') }}</span>
                            @if (!tt.isUnlimited && tt.max_tickets > 0) {
                              <span class="ml-2 text-xs font-mono text-gray-400">· {{ tt.max_tickets }} slots</span>
                            }
                            @if (tt.disabled) {
                              <span class="ml-2 text-xs font-mono border border-red-300 text-red-600 bg-red-50 px-1.5 py-0.5 uppercase">Disabled</span>
                            }
                          </div>
                          <div class="flex items-center gap-3 flex-shrink-0">
                            <button type="button" (click)="startEditTicketType(i)"
                              class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase tracking-wider">Edit</button>
                            @if (ticketTypes.length > 1) {
                              <button type="button" (click)="removeTicketType(i)"
                                class="text-xs font-mono text-red-400 hover:text-red-300 uppercase tracking-wider">Remove</button>
                            }
                          </div>
                        </div>
                      }

                      <!-- EDIT MODE -->
                      @if (tt.isEditing) {
                        <div class="p-4 space-y-3 bg-white">
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="sm:col-span-2">
                              <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Name *</label>
                              <input type="text" [(ngModel)]="tt.name" [ngModelOptions]="{standalone:true}"
                                class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                                placeholder="e.g. General Admission, VIP">
                            </div>

                            <div>
                              <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Price</label>
                              <div class="flex items-center gap-3">
                                <label class="flex items-center gap-1.5 text-xs font-mono text-gray-400 cursor-pointer flex-shrink-0">
                                  <input type="checkbox" [(ngModel)]="tt.isFree" [ngModelOptions]="{standalone:true}"
                                    class="w-3.5 h-3.5 accent-yellow-400">
                                  Free
                                </label>
                                @if (!tt.isFree) {
                                  <input type="number" [(ngModel)]="tt.price" [ngModelOptions]="{standalone:true}" min="0" step="0.01"
                                    class="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors"
                                    placeholder="0.00">
                                }
                              </div>
                            </div>

                            <div>
                              <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Capacity</label>
                              <div class="flex items-center gap-3">
                                <label class="flex items-center gap-1.5 text-xs font-mono text-gray-400 cursor-pointer flex-shrink-0">
                                  <input type="checkbox" [(ngModel)]="tt.isUnlimited" [ngModelOptions]="{standalone:true}"
                                    class="w-3.5 h-3.5 accent-yellow-400">
                                  Unlimited
                                </label>
                                @if (!tt.isUnlimited) {
                                  <input type="number" [(ngModel)]="tt.max_tickets" [ngModelOptions]="{standalone:true}" min="1"
                                    class="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors"
                                    placeholder="Max slots">
                                }
                              </div>
                            </div>

                            <div class="sm:col-span-2">
                              <label class="flex items-center gap-1.5 text-xs font-mono text-gray-400 cursor-pointer">
                                <input type="checkbox" [(ngModel)]="tt.showDateRange" [ngModelOptions]="{standalone:true}"
                                  class="w-3.5 h-3.5 accent-yellow-400">
                                Schedule sale window
                              </label>
                              @if (tt.showDateRange) {
                                <div class="grid grid-cols-2 gap-3 mt-2">
                                  <div>
                                    <label class="block text-xs font-mono text-gray-400 mb-1">Sale Start</label>
                                    <input type="datetime-local" [(ngModel)]="tt.start_date" [ngModelOptions]="{standalone:true}"
                                      class="w-full px-2 py-1.5 bg-white border border-gray-300 text-gray-900 text-xs focus:outline-none focus:border-yellow-400 transition-colors">
                                  </div>
                                  <div>
                                    <label class="block text-xs font-mono text-gray-400 mb-1">Sale End</label>
                                    <input type="datetime-local" [(ngModel)]="tt.end_date" [ngModelOptions]="{standalone:true}"
                                      class="w-full px-2 py-1.5 bg-white border border-gray-300 text-gray-900 text-xs focus:outline-none focus:border-yellow-400 transition-colors">
                                  </div>
                                </div>
                              }
                            </div>

                            <!-- Advanced: collapsed by default -->
                            <div class="sm:col-span-2">
                              <button type="button" (click)="tt._showAdvanced = !tt._showAdvanced"
                                class="text-xs font-mono text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                                <svg class="w-3 h-3 transition-transform" [class.rotate-90]="tt._showAdvanced" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                                Advanced options
                              </button>
                            </div>

                            @if (tt._showAdvanced) {
                              <div class="sm:col-span-2">
                                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Buyer Instructions <span class="normal-case text-gray-400">(shown at checkout)</span></label>
                                <textarea [(ngModel)]="tt.special_instructions" [ngModelOptions]="{standalone:true}" rows="2"
                                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors resize-none"
                                  placeholder="Optional note shown at checkout..."></textarea>
                              </div>

                              <div class="sm:col-span-2">
                                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Scanner Instructions <span class="normal-case text-gray-400">(shown to staff)</span></label>
                                <textarea [(ngModel)]="tt.special_instructions_for_scanner" [ngModelOptions]="{standalone:true}" rows="2"
                                  class="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors resize-none"
                                  placeholder="Optional note shown to scanner staff..."></textarea>
                              </div>

                              <div class="sm:col-span-2">
                                <label class="flex items-center gap-2 text-xs font-mono text-gray-400 cursor-pointer">
                                  <input type="checkbox" [(ngModel)]="tt.disabled" [ngModelOptions]="{standalone:true}"
                                    class="w-3.5 h-3.5 accent-yellow-400">
                                  Disable this ticket type
                                </label>
                              </div>
                            }

                            <div class="sm:col-span-2 flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                              @if (tt._backup !== undefined) {
                                <button type="button" (click)="cancelEditTicketType(i)"
                                  class="px-3 py-1.5 text-xs font-mono border border-gray-300 text-gray-400 hover:text-gray-900 uppercase tracking-wider">Cancel</button>
                              }
                              <button type="button" (click)="saveTicketType(i)" [disabled]="!tt.name.trim()"
                                class="px-3 py-1.5 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black uppercase tracking-wider disabled:opacity-40">
                                {{ tt._backup !== undefined ? 'Save' : 'Done' }}
                              </button>
                            </div>
                          </div>
                        </div>
                      }

                    </div>
                  }
                </div>

                @if (ticketTypeError()) {
                  <p class="mt-3 text-xs font-mono text-red-600">{{ ticketTypeError() }}</p>
                }
              </div>

              <!-- Payment Methods -->
              <div class="bg-white border border-gray-200 p-6 space-y-4">
                <div>
                  <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Accepted Payment Methods</h2>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">Select which methods buyers can use at checkout.</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  @for (pm of paymentMethods; track pm.key) {
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" [formControlName]="pm.key"
                        class="w-4 h-4 accent-yellow-400">
                      <span class="text-sm font-mono text-gray-500">{{ pm.label }}</span>
                    </label>
                  }
                </div>
              </div>

              <!-- Purchase Settings -->
              <div class="bg-white border border-gray-200 p-6 space-y-5">
                <div>
                  <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Purchase Page Settings</h2>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">Control how the public ticket page looks and behaves.</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Countdown Display</label>
                    <select formControlName="countdown_display"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                      <option value="always">Always show</option>
                      <option value="1_week">1 Week before</option>
                      <option value="3_days">3 Days before</option>
                      <option value="1_day">1 Day before</option>
                      <option value="never">Never show</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Ticket Label <span class="normal-case text-gray-400">(optional)</span></label>
                    <input type="text" formControlName="ticket_naming"
                      class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors"
                      placeholder="e.g. Ticket, Pass, Seat">
                    <p class="mt-1 text-xs font-mono text-gray-400">Replaces the word "ticket" on the purchase page.</p>
                  </div>
                  <div class="md:col-span-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" formControlName="show_tickets_remaining"
                        class="w-4 h-4 accent-yellow-400">
                      <span class="text-sm font-mono text-gray-500">Show tickets remaining to buyers</span>
                    </label>
                    <p class="mt-1 text-xs font-mono text-gray-400 ml-6">Displays remaining count when stock is low.</p>
                  </div>
                </div>
              </div>

            } <!-- end @if ticketing_enabled -->

          </div>
        }

        <!-- ===================================================== -->
        <!-- TAB: WALK-IN                                          -->
        <!-- ===================================================== -->
        @if (activeTab() === 'walk-in') {
          <div class="space-y-4">

            <div class="bg-white border border-gray-200 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xs font-black text-gray-900 uppercase tracking-widest">Walk-In Sales</h2>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">Accept payments at the door via scanner staff.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" formControlName="walk_in_enabled" class="sr-only peer">
                  <div class="w-10 h-5 bg-gray-200 peer-checked:bg-yellow-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
            </div>

            @if (form.get('walk_in_enabled')?.value) {
              <div class="bg-white border border-gray-200 p-6 space-y-5">
                <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Walk-In Configuration</h2>

                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Accepted Payment Methods</label>
                  <div class="flex flex-wrap gap-5">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" formControlName="walk_in_supports_cash" class="w-4 h-4 accent-yellow-400">
                      <span class="text-sm font-mono text-gray-500">Cash</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" formControlName="walk_in_supports_gcash" class="w-4 h-4 accent-yellow-400">
                      <span class="text-sm font-mono text-gray-500">GCash</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" formControlName="walk_in_supports_card" class="w-4 h-4 accent-yellow-400">
                      <span class="text-sm font-mono text-gray-500">Card</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Max Walk-In Count</label>
                  <div class="flex items-center gap-3">
                    <input type="number" formControlName="walk_in_max_count" min="0"
                      class="w-36 px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                    <span class="text-xs font-mono text-gray-400">0 = unlimited</span>
                  </div>
                </div>
              </div>

              <div class="bg-amber-50 border border-amber-200 p-4">
                <p class="text-xs font-mono text-amber-700">Walk-in types (what you're selling at the door) are managed from the event's detail page after saving, under the Walk-In tab.</p>
              </div>
            }

            @if (!form.get('walk_in_enabled')?.value) {
              <div class="bg-gray-50 border border-gray-200 p-8 text-center">
                <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Walk-in sales are off</p>
                <p class="text-xs font-mono text-gray-400">Toggle the switch above to enable door sales for scanner staff.</p>
              </div>
            }

          </div>
        }

        <!-- ===================================================== -->
        <!-- TAB: DISCOVERY                                        -->
        <!-- ===================================================== -->
        @if (activeTab() === 'discovery') {
          <div class="space-y-4">

            <!-- Listing toggle -->
            <div class="bg-white border border-gray-200 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xs font-black text-gray-900 uppercase tracking-widest">List on Platform</h2>
                  <p class="text-xs font-mono text-gray-400 mt-0.5">Show this event on the public discovery page for people to find.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" formControlName="listed_on_ticketing" class="sr-only peer">
                  <div class="w-10 h-5 bg-gray-200 peer-checked:bg-yellow-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
              </div>
            </div>

            <!-- Event Type + Tags -->
            <div class="bg-white border border-gray-200 p-6 space-y-5">
              <div>
                <h2 class="text-xs font-black text-gray-400 uppercase tracking-widest">Categorisation</h2>
                <p class="text-xs font-mono text-gray-400 mt-0.5">Help people find your event by adding a type and relevant tags.</p>
              </div>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-1.5">Event Type</label>
                <select formControlName="event_type"
                  class="w-full px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-yellow-400 transition-colors">
                  <option value="">— Select type —</option>
                  <option value="concert">Concert</option>
                  <option value="festival">Festival</option>
                  <option value="club_night">Club Night</option>
                  <option value="open_mic">Open Mic</option>
                  <option value="dj_set">DJ Set</option>
                  <option value="listening_party">Listening Party</option>
                  <option value="album_launch">Album Launch</option>
                  <option value="workshop">Workshop</option>
                  <option value="meetup">Meetup</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Tags</label>
                @if (availableTags().length > 0) {
                  <div class="flex flex-wrap gap-2 mb-3">
                    @for (tag of availableTags(); track tag.id) {
                      <button type="button" (click)="toggleTag(tag.id)"
                        [class]="isTagSelected(tag.id)
                          ? 'px-2.5 py-1 text-xs font-mono bg-yellow-400 text-black border border-yellow-400 uppercase tracking-wider'
                          : 'px-2.5 py-1 text-xs font-mono bg-white text-gray-500 border border-gray-300 hover:border-gray-500 uppercase tracking-wider transition-colors'">
                        {{ tag.name }}
                      </button>
                    }
                  </div>
                }
                <div class="flex gap-2">
                  <input type="text" [(ngModel)]="newTagInput" [ngModelOptions]="{standalone:true}"
                    placeholder="Add custom tag..."
                    class="flex-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-yellow-400 transition-colors">
                  <button type="button" (click)="addCustomTag()" [disabled]="!newTagInput.trim()"
                    class="px-3 py-1.5 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black uppercase tracking-wider disabled:opacity-40 transition-colors">
                    Add
                  </button>
                </div>
                <p class="mt-1.5 text-xs font-mono text-gray-400">{{ selectedTagIds().length }} tag{{ selectedTagIds().length !== 1 ? 's' : '' }} selected</p>
              </div>
            </div>

          </div>
        }

        <!-- Save Bar (always visible) -->
        <div class="flex items-center justify-between mt-6 pt-5 border-t border-gray-200">
          <div class="flex items-center gap-3">
            @for (tab of tabs; track tab.id; let i = $index) {
              <button type="button" (click)="activeTab.set(tab.id)"
                [disabled]="activeTab() === tab.id"
                class="text-xs font-mono text-gray-400 hover:text-gray-900 disabled:text-gray-300 transition-colors">
                {{ tab.label }}
              </button>
              @if (i < tabs.length - 1) {
                <span class="text-gray-200 text-xs">·</span>
              }
            }
          </div>
          <div class="flex items-center gap-3">
            <a routerLink="/app/events"
               class="px-4 py-2.5 border border-gray-300 text-gray-400 text-xs font-mono hover:text-gray-900 hover:border-gray-500 uppercase tracking-wider transition-colors">
              Cancel
            </a>
            <button type="submit" [disabled]="loading()"
              class="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors">
              {{ loading() ? 'Saving...' : (isEdit() ? 'Save Changes' : 'Create Event') }}
            </button>
          </div>
        </div>

      </form>
    </div>
  `
})
export class EventFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  isEdit = signal(false);
  eventId = signal<number | null>(null);
  posterPreview = signal<string | null>(null);
  posterFile = signal<File | null>(null);
  verificationPin = signal<string | null>(null);
  ticketTypeError = signal('');
  feeSettings = signal<EventFeeSettings | null>(null);

  activeTab = signal<FormTab>('details');

  tabs: { id: FormTab; label: string }[] = [
    { id: 'details',   label: 'Details'   },
    { id: 'tickets',   label: 'Tickets'   },
    { id: 'walk-in',   label: 'Walk-In'   },
    { id: 'discovery', label: 'Discovery' },
  ];

  // Ticket types
  ticketTypes: (TicketTypeFormItem & { _showAdvanced?: boolean })[] = [];

  // Tags
  availableTags = signal<EventTag[]>([]);
  selectedTagIds = signal<number[]>([]);
  newTagInput = '';

  hasExternalLink = false;

  // Close time
  closeAtShowTime = true;
  closeTimeSuggestions = [
    { label: '1h before',     offsetMinutes: 60   },
    { label: '4h before',     offsetMinutes: 240  },
    { label: '12h before',    offsetMinutes: 720  },
    { label: '1 day before',  offsetMinutes: 1440 },
    { label: '2 days before', offsetMinutes: 2880 },
  ];

  // Venue autocomplete
  venueQuery = '';
  venueDropdownOpen = signal(false);
  venuePredictions = signal<GooglePlacesPrediction[]>([]);
  venueSearching = signal(false);
  selectedVenue = signal<VenueSelection | null>(null);
  private venueSearch$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  paymentMethods = [
    { key: 'supports_gcash',   label: 'GCash' },
    { key: 'supports_qrph',    label: 'QRPH' },
    { key: 'supports_card',    label: 'Credit/Debit Card' },
    { key: 'supports_ubp',     label: 'UnionBank' },
    { key: 'supports_dob',     label: 'Dragonpay' },
    { key: 'supports_maya',    label: 'Maya' },
    { key: 'supports_grabpay', label: 'GrabPay' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventsService: EventsService,
    private ticketTypeService: TicketTypeService,
    private googlePlacesService: GooglePlacesService,
    private authService: AuthService,
    private orgService: OrganizationService
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      date_and_time: ['', Validators.required],
      close_time: [''],
      venue: [''],
      description: [''],
      rsvp_link: [''],
      event_type: [''],
      listed_on_ticketing: [false],
      ticketing_enabled: [false],
      external_ticket_link: [''],
      supports_gcash: [true], supports_qrph: [true], supports_card: [true],
      supports_ubp: [true], supports_dob: [true], supports_maya: [true], supports_grabpay: [true],
      countdown_display: ['always'],
      show_tickets_remaining: [false],
      ticket_naming: [''],
      walk_in_enabled: [false],
      walk_in_supports_cash: [true], walk_in_supports_gcash: [false], walk_in_supports_card: [false],
      walk_in_max_count: [0],
    });
  }

  ngOnInit(): void {
    // Load brand fee settings
    const user = this.authService.getCurrentUser();
    if (user?.brand_id) {
      this.orgService.getFeeSettings(user.brand_id).subscribe({
        next: (res) => this.feeSettings.set(res.event),
        error: () => {}
      });
    }

    // Load available tags
    this.eventsService.getTags().subscribe({
      next: (tags) => this.availableTags.set(tags),
      error: () => {}
    });

    // Venue search debounce
    this.venueSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.venuePredictions.set([]); return []; }
        this.venueSearching.set(true);
        return this.googlePlacesService.getPlacePredictions(q);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (predictions) => {
        this.venuePredictions.set(predictions);
        this.venueSearching.set(false);
        if (predictions.length > 0) this.venueDropdownOpen.set(true);
      },
      error: () => this.venueSearching.set(false)
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.eventId.set(+id);
      this.eventsService.getEvent(+id).subscribe({
        next: (event) => {
          this.form.patchValue({
            title: event.title,
            date_and_time: event.date_and_time?.slice(0, 16),
            close_time: event.close_time?.slice(0, 16) || '',
            venue: event.venue || '',
            description: event.description || '',
            rsvp_link: event.rsvp_link || '',
            event_type: event.event_type || '',
            listed_on_ticketing: event.listed_on_ticketing ?? false,
            ticketing_enabled: event.ticketing_enabled !== undefined ? event.ticketing_enabled : true,
            external_ticket_link: event.external_ticket_link || '',
            supports_gcash: event.supports_gcash ?? false,
            supports_qrph: event.supports_qrph ?? false,
            supports_card: event.supports_card ?? false,
            supports_ubp: event.supports_ubp ?? false,
            supports_dob: event.supports_dob ?? false,
            supports_maya: event.supports_maya ?? false,
            supports_grabpay: event.supports_grabpay ?? false,
            countdown_display: event.countdown_display || 'always',
            show_tickets_remaining: event.show_tickets_remaining ?? false,
            ticket_naming: event.ticket_naming || '',
            walk_in_enabled: event.walk_in_enabled ?? false,
            walk_in_supports_cash: event.walk_in_supports_cash ?? true,
            walk_in_supports_gcash: event.walk_in_supports_gcash ?? false,
            walk_in_supports_card: event.walk_in_supports_card ?? false,
            walk_in_max_count: event.walk_in_max_count ?? 0,
          });
          this.hasExternalLink = !!(event.external_ticket_link);
          this.closeAtShowTime = !event.close_time;
          if (event.venue) {
            this.venueQuery = event.venue;
          }
          if (event.poster_url) this.posterPreview.set(event.poster_url);
          if (event.verification_pin) this.verificationPin.set(event.verification_pin);
          if (event.tags) this.selectedTagIds.set(event.tags.map(t => t.id));
        }
      });
      // Load existing ticket types
      this.ticketTypeService.getTicketTypes(+id).subscribe({
        next: (res) => {
          this.ticketTypes = res.ticketTypes.map(tt => ({
            id: tt.id,
            name: tt.name,
            price: tt.price,
            isFree: tt.price === 0,
            max_tickets: tt.max_tickets,
            isUnlimited: tt.max_tickets === 0,
            start_date: tt.start_date?.slice(0, 16) || null,
            end_date: tt.end_date?.slice(0, 16) || null,
            showDateRange: !!(tt.start_date || tt.end_date),
            disabled: tt.disabled,
            special_instructions: tt.special_instructions || null,
            special_instructions_for_scanner: tt.special_instructions_for_scanner || null,
            isEditing: false,
            _showAdvanced: !!(tt.special_instructions || tt.special_instructions_for_scanner || tt.disabled),
          }));
        }
      });
    } else {
      // New event: one default ticket type ready to fill in
      this.ticketTypes = [newTicketTypeItem()];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Ticket Types ----
  addTicketType(): void {
    this.ticketTypes.push(newTicketTypeItem());
  }

  startEditTicketType(i: number): void {
    const tt = this.ticketTypes[i];
    tt._backup = { ...tt };
    tt.isEditing = true;
  }

  saveTicketType(i: number): void {
    const tt = this.ticketTypes[i];
    if (!tt.name.trim()) return;
    tt.isEditing = false;
    delete tt._backup;
    this.ticketTypeError.set('');
  }

  cancelEditTicketType(i: number): void {
    const tt = this.ticketTypes[i];
    if (tt._backup) {
      Object.assign(tt, tt._backup);
      delete tt._backup;
    }
    tt.isEditing = false;
  }

  removeTicketType(i: number): void {
    if (this.ticketTypes.length <= 1) return;
    this.ticketTypes.splice(i, 1);
  }

  // ---- Tags ----
  isTagSelected(tagId: number): boolean {
    return this.selectedTagIds().includes(tagId);
  }

  toggleTag(tagId: number): void {
    const current = this.selectedTagIds();
    if (current.includes(tagId)) {
      this.selectedTagIds.set(current.filter(id => id !== tagId));
    } else {
      this.selectedTagIds.set([...current, tagId]);
    }
  }

  addCustomTag(): void {
    const name = this.newTagInput.trim();
    if (!name) return;
    this.eventsService.createTag(name).subscribe({
      next: (tag) => {
        this.availableTags.set([...this.availableTags(), tag]);
        this.selectedTagIds.set([...this.selectedTagIds(), tag.id]);
        this.newTagInput = '';
      },
      error: () => {}
    });
  }

  // ---- Close time ----
  onCloseAtShowTimeChange(): void {
    if (this.closeAtShowTime) {
      this.form.patchValue({ close_time: '' });
    }
  }

  onEventDateChange(): void {}

  applyCloseTimeSuggestion(offsetMinutes: number): void {
    const eventDateStr = this.form.get('date_and_time')?.value;
    if (!eventDateStr) return;
    const eventDate = new Date(eventDateStr);
    const closeDate = new Date(eventDate.getTime() - offsetMinutes * 60 * 1000);
    this.form.patchValue({ close_time: this.toLocalDatetimeString(closeDate) });
  }

  private toLocalDatetimeString(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  }

  // ---- Venue autocomplete ----
  onVenueInput(): void {
    this.selectedVenue.set(null);
    this.venueSearch$.next(this.venueQuery);
  }

  onVenueFocus(): void {
    if (this.venuePredictions().length > 0) this.venueDropdownOpen.set(true);
  }

  onVenueBlur(): void {
    setTimeout(() => {
      this.venueDropdownOpen.set(false);
      if (!this.selectedVenue()) this.form.patchValue({ venue: this.venueQuery });
    }, 200);
  }

  selectVenuePrediction(prediction: GooglePlacesPrediction): void {
    this.venueDropdownOpen.set(false);
    this.venueSearching.set(true);
    this.googlePlacesService.getPlaceDetails(prediction.place_id).subscribe({
      next: (venue) => {
        this.selectedVenue.set(venue);
        this.venueQuery = venue.venue;
        this.form.patchValue({ venue: venue.venue });
        this.venueSearching.set(false);
      },
      error: () => {
        this.venueQuery = prediction.description;
        this.form.patchValue({ venue: prediction.description });
        this.venueSearching.set(false);
      }
    });
  }

  clearVenueSelection(): void {
    this.selectedVenue.set(null);
    this.venueQuery = '';
    this.form.patchValue({ venue: '' });
    this.venuePredictions.set([]);
  }

  // ---- Poster ----
  onPosterChange(event: globalThis.Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.posterFile.set(file);
      const reader = new FileReader();
      reader.onload = (e) => this.posterPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  // ---- Submit ----
  submit(): void {
    if (this.form.invalid) {
      // Switch to details tab if required fields missing
      if (this.form.get('title')?.invalid || this.form.get('date_and_time')?.invalid) {
        this.activeTab.set('details');
      }
      return;
    }

    // Validate ticket types only when ticketing is enabled
    const ticketingEnabled = this.form.get('ticketing_enabled')?.value !== false;
    const unsaved = ticketingEnabled ? this.ticketTypes.filter(tt => tt.isEditing) : [];
    if (unsaved.length > 0) {
      this.activeTab.set('tickets');
      this.ticketTypeError.set('Please finish editing all ticket types before saving.');
      return;
    }
    if (ticketingEnabled && this.ticketTypes.length === 0) {
      this.activeTab.set('tickets');
      this.ticketTypeError.set('At least one ticket type is required.');
      return;
    }
    const unnamed = ticketingEnabled ? this.ticketTypes.find(tt => !tt.name.trim()) : null;
    if (unnamed) {
      this.activeTab.set('tickets');
      this.ticketTypeError.set('All ticket types must have a name.');
      return;
    }
    this.ticketTypeError.set('');

    this.loading.set(true);
    this.error.set('');

    const formValue = this.form.value;
    const data: any = { ...formValue };

    // Clear external ticket link if toggle is disabled
    if (!this.hasExternalLink) data.external_ticket_link = '';

    // Close time
    if (this.closeAtShowTime) data.close_time = '';

    // Include tags
    data.tags = this.selectedTagIds();

    // Build ticketTypes for API — omit entirely when ticketing is disabled so the API
    // doesn't attempt to reconcile (and delete) existing ticket types.
    if (ticketingEnabled) {
      const ticketTypesForApi = this.ticketTypes.map(tt => ({
        ...(tt.id ? { id: tt.id } : {}),
        name: tt.name.trim(),
        price: tt.isFree ? 0 : Number(tt.price),
        max_tickets: tt.isUnlimited ? 0 : Number(tt.max_tickets),
        start_date: tt.showDateRange && tt.start_date ? new Date(tt.start_date).toISOString() : null,
        end_date: tt.showDateRange && tt.end_date ? new Date(tt.end_date).toISOString() : null,
        disabled: tt.disabled ?? false,
        special_instructions: tt.special_instructions || null,
        special_instructions_for_scanner: tt.special_instructions_for_scanner || null,
      }));
      data.ticketTypes = JSON.stringify(ticketTypesForApi);
      data.ticket_price = String(ticketTypesForApi[0]?.price ?? 0);
    }

    // Google Places venue fields
    const venue = this.selectedVenue();
    if (venue?.google_place_id) {
      data.google_place_id = venue.google_place_id;
      data.venue_address = venue.venue_address || '';
      data.venue_latitude = venue.venue_latitude ?? '';
      data.venue_longitude = venue.venue_longitude ?? '';
      data.venue_phone = venue.venue_phone || '';
      data.venue_website = venue.venue_website || '';
      data.venue_maps_url = venue.venue_maps_url || '';
    }

    if (this.posterFile()) data.poster = this.posterFile();

    const action = this.isEdit()
      ? this.eventsService.updateEvent(this.eventId()!, data)
      : this.eventsService.createEvent(data);

    action.subscribe({
      next: (res) => this.router.navigate(['/app/events', res.event.id]),
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save event.');
        this.loading.set(false);
      }
    });
  }
}
