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

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, RouterLink],
  styles: [`
    .venue-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
      background: white; border: 1px solid #d1d5db; border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12); max-height: 260px;
      overflow-y: auto; margin-top: 2px;
    }
  `],
  template: `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/events" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <h1 class="text-2xl font-bold text-gray-900">{{ isEdit() ? 'Edit Event' : 'New Event' }}</h1>
      </div>

      @if (error()) {
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">

        <!-- ===== BASIC INFO ===== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5 mb-6">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Info</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
              <input type="text" formControlName="title"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Concert Night 2025">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date & Time *</label>
              <input type="datetime-local" formControlName="date_and_time"
                (change)="onEventDateChange()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
            </div>

            <!-- Close Time -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Close Ticket Sales</label>
              <label class="flex items-center gap-2 mb-2 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="closeAtShowTime" [ngModelOptions]="{standalone:true}"
                  (change)="onCloseAtShowTimeChange()"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                <span class="text-sm text-gray-700">End at show time</span>
              </label>
              @if (!closeAtShowTime) {
                <input type="datetime-local" formControlName="close_time"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <div class="flex flex-wrap gap-1.5 mt-2">
                  @for (s of closeTimeSuggestions; track s.label) {
                    <button type="button" (click)="applyCloseTimeSuggestion(s.offsetMinutes)"
                      class="px-2 py-0.5 text-xs rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors">
                      {{ s.label }}
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Venue with Google Places -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <div class="relative">
                <input type="text" [(ngModel)]="venueQuery" [ngModelOptions]="{standalone:true}"
                  (input)="onVenueInput()" (focus)="onVenueFocus()" (blur)="onVenueBlur()"
                  placeholder="Search venue name or address..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-8">
                @if (venueSearching()) {
                  <div class="absolute right-3 top-2.5">
                    <div class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
                @if (venueDropdownOpen() && venuePredictions().length > 0) {
                  <div class="venue-dropdown">
                    @for (p of venuePredictions(); track p.place_id) {
                      <button type="button" (mousedown)="selectVenuePrediction(p)"
                        class="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <div class="text-sm font-medium text-gray-900">{{ p.structured_formatting.main_text }}</div>
                        <div class="text-xs text-gray-500">{{ p.structured_formatting.secondary_text }}</div>
                      </button>
                    }
                  </div>
                }
              </div>
              @if (selectedVenue()) {
                <div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div class="text-xs text-blue-800 min-w-0">
                    <span class="font-medium">{{ selectedVenue()!.venue }}</span>
                    @if (selectedVenue()!.venue_address) {
                      <span class="text-blue-600 ml-1">— {{ selectedVenue()!.venue_address }}</span>
                    }
                  </div>
                  <button type="button" (click)="clearVenueSelection()" class="text-blue-400 hover:text-blue-600 ml-2 flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea formControlName="description" rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe your event..."></textarea>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Event Poster</label>
              <input type="file" accept="image/*" (change)="onPosterChange($event)"
                class="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100">
              @if (posterPreview()) {
                <img [src]="posterPreview()" alt="Poster preview" class="mt-3 h-32 rounded-lg object-cover border border-gray-200">
              }
            </div>
          </div>
        </div>

        <!-- ===== TICKET TYPES ===== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ticket Types</h2>
            <button type="button" (click)="addTicketType()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors">
              + Add Ticket Type
            </button>
          </div>

          @if (ticketTypes.length === 0) {
            <p class="text-sm text-gray-400 text-center py-4">No ticket types yet. Add one above.</p>
          }

          <div class="space-y-3">
            @for (tt of ticketTypes; track tt; let i = $index) {
              <div class="border border-gray-200 rounded-lg overflow-hidden">

                <!-- VIEW MODE -->
                @if (!tt.isEditing) {
                  <div class="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="min-w-0">
                        <span class="text-sm font-medium text-gray-900">{{ tt.name }}</span>
                        <span class="ml-2 text-sm text-gray-500">{{ tt.isFree ? 'Free' : (tt.price | currency:'PHP':'symbol':'1.0-0') }}</span>
                        @if (!tt.isUnlimited && tt.max_tickets > 0) {
                          <span class="ml-2 text-xs text-gray-400">· {{ tt.max_tickets }} slots</span>
                        }
                        @if (tt.disabled) {
                          <span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Disabled</span>
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button type="button" (click)="startEditTicketType(i)"
                        class="text-xs text-primary-600 hover:text-primary-700 font-medium">Edit</button>
                      @if (ticketTypes.length > 1) {
                        <button type="button" (click)="removeTicketType(i)"
                          class="text-xs text-red-500 hover:text-red-600 font-medium">Remove</button>
                      }
                    </div>
                  </div>
                }

                <!-- EDIT MODE -->
                @if (tt.isEditing) {
                  <div class="p-4 space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div class="sm:col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                        <input type="text" [(ngModel)]="tt.name" [ngModelOptions]="{standalone:true}"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="e.g. General Admission, VIP">
                      </div>

                      <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Price</label>
                        <div class="flex items-center gap-2">
                          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer flex-shrink-0">
                            <input type="checkbox" [(ngModel)]="tt.isFree" [ngModelOptions]="{standalone:true}"
                              class="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded">
                            Free
                          </label>
                          @if (!tt.isFree) {
                            <input type="number" [(ngModel)]="tt.price" [ngModelOptions]="{standalone:true}" min="0" step="0.01"
                              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="0.00">
                          }
                        </div>
                      </div>

                      <div>
                        <label class="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
                        <div class="flex items-center gap-2">
                          <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer flex-shrink-0">
                            <input type="checkbox" [(ngModel)]="tt.isUnlimited" [ngModelOptions]="{standalone:true}"
                              class="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded">
                            Unlimited
                          </label>
                          @if (!tt.isUnlimited) {
                            <input type="number" [(ngModel)]="tt.max_tickets" [ngModelOptions]="{standalone:true}" min="1"
                              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Max slots">
                          }
                        </div>
                      </div>

                      <div class="sm:col-span-2">
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" [(ngModel)]="tt.showDateRange" [ngModelOptions]="{standalone:true}"
                            class="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded">
                          Schedule sale window
                        </label>
                        @if (tt.showDateRange) {
                          <div class="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label class="block text-xs text-gray-500 mb-1">Sale Start</label>
                              <input type="datetime-local" [(ngModel)]="tt.start_date" [ngModelOptions]="{standalone:true}"
                                class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                            </div>
                            <div>
                              <label class="block text-xs text-gray-500 mb-1">Sale End</label>
                              <input type="datetime-local" [(ngModel)]="tt.end_date" [ngModelOptions]="{standalone:true}"
                                class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                            </div>
                          </div>
                        }
                      </div>

                      <div class="sm:col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Special Instructions <span class="font-normal text-gray-400">(shown to buyer)</span></label>
                        <textarea [(ngModel)]="tt.special_instructions" [ngModelOptions]="{standalone:true}" rows="2"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          placeholder="Optional note shown at checkout..."></textarea>
                      </div>

                      <div class="sm:col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Scanner Instructions <span class="font-normal text-gray-400">(shown to staff)</span></label>
                        <textarea [(ngModel)]="tt.special_instructions_for_scanner" [ngModelOptions]="{standalone:true}" rows="2"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          placeholder="Optional note shown to scanner staff..."></textarea>
                      </div>

                      <div class="sm:col-span-2 flex items-center justify-between">
                        <label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" [(ngModel)]="tt.disabled" [ngModelOptions]="{standalone:true}"
                            class="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded">
                          Disable this ticket type
                        </label>
                        <div class="flex items-center gap-2">
                          @if (tt._backup !== undefined) {
                            <button type="button" (click)="cancelEditTicketType(i)"
                              class="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">Cancel</button>
                          }
                          <button type="button" (click)="saveTicketType(i)" [disabled]="!tt.name.trim()"
                            class="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40">
                            {{ tt._backup !== undefined ? 'Save' : 'Done' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                }

              </div>
            }
          </div>

          @if (ticketTypeError()) {
            <p class="mt-3 text-xs text-red-600">{{ ticketTypeError() }}</p>
          }
        </div>

        <!-- ===== PAYMENT METHODS ===== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment Methods</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            @for (pm of paymentMethods; track pm.key) {
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" [formControlName]="pm.key"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                <span class="text-sm text-gray-700">{{ pm.label }}</span>
              </label>
            }
          </div>
        </div>

        <!-- ===== PURCHASE SETTINGS ===== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5 mb-6">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Purchase Settings</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Countdown Display</label>
              <select formControlName="countdown_display"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="always">Always</option>
                <option value="1_week">1 Week Before</option>
                <option value="3_days">3 Days Before</option>
                <option value="1_day">1 Day Before</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ticket Naming</label>
              <input type="text" formControlName="ticket_naming"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Ticket, Pass, Seat">
            </div>
            <div class="md:col-span-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" formControlName="show_tickets_remaining"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                <span class="text-sm text-gray-700">Show tickets remaining to buyers</span>
              </label>
            </div>
          </div>
        </div>

        <!-- ===== WALK-IN SETTINGS ===== -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5 mb-6">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Walk-In Sales</h2>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" formControlName="walk_in_enabled"
                class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
              <span class="text-sm text-gray-700">Enable walk-in sales</span>
            </label>
          </div>
          @if (form.get('walk_in_enabled')?.value) {
            <div class="space-y-4 pt-2 border-t border-gray-100">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Accepted Payment Methods</label>
                <div class="flex flex-wrap gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" formControlName="walk_in_supports_cash" class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                    <span class="text-sm text-gray-700">Cash</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" formControlName="walk_in_supports_gcash" class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                    <span class="text-sm text-gray-700">GCash</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" formControlName="walk_in_supports_card" class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500">
                    <span class="text-sm text-gray-700">Card</span>
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max Walk-In Count <span class="text-gray-400 font-normal">(0 = unlimited)</span></label>
                <input type="number" formControlName="walk_in_max_count" min="0"
                  class="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              </div>
            </div>
          }
        </div>

        <!-- ===== SCANNER SETTINGS (edit only) ===== -->
        @if (isEdit() && verificationPin()) {
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Scanner Settings</h2>
            <div class="flex items-center gap-4">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Verification PIN</label>
                <span class="text-2xl font-mono font-bold text-gray-900 tracking-widest">{{ verificationPin() }}</span>
              </div>
              <button type="button" (click)="refreshPin()"
                class="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                Refresh PIN
              </button>
            </div>
          </div>
        }

        <div class="flex items-center justify-end gap-3 mt-6">
          <a routerLink="/events"
             class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </a>
          <button type="submit" [disabled]="loading()"
            class="px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {{ loading() ? 'Saving...' : (isEdit() ? 'Save Changes' : 'Create Event') }}
          </button>
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

  // Ticket types
  ticketTypes: TicketTypeFormItem[] = [];

  // Close time
  closeAtShowTime = true;
  closeTimeSuggestions = [
    { label: '1h before',    offsetMinutes: 60   },
    { label: '4h before',    offsetMinutes: 240  },
    { label: '12h before',   offsetMinutes: 720  },
    { label: '1 day before', offsetMinutes: 1440 },
    { label: '2 days before',offsetMinutes: 2880 },
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
    private googlePlacesService: GooglePlacesService
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      date_and_time: ['', Validators.required],
      close_time: [''],
      venue: [''],
      description: [''],
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
          this.venueQuery = event.venue || '';
          this.closeAtShowTime = !event.close_time;
          if (event.poster_url) this.posterPreview.set(event.poster_url);
          if (event.verification_pin) this.verificationPin.set(event.verification_pin);
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
          }));
        }
      });
    } else {
      // New event: start with one default ticket type in edit mode
      this.ticketTypes = [newTicketTypeItem()];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Ticket Types ----
  addTicketType(): void {
    // Save any currently open edit first
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

  // ---- Close time ----
  onCloseAtShowTimeChange(): void {
    if (this.closeAtShowTime) {
      this.form.patchValue({ close_time: '' });
    }
  }

  onEventDateChange(): void {
    // No auto-recalc needed; user picks manually via suggestion pills
  }

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

  // ---- PIN ----
  refreshPin(): void {
    const id = this.eventId();
    if (!id) return;
    this.eventsService.refreshPin(id).subscribe({
      next: (res) => this.verificationPin.set(res.verification_pin)
    });
  }

  // ---- Submit ----
  submit(): void {
    if (this.form.invalid) return;

    // Validate ticket types
    const unsaved = this.ticketTypes.filter(tt => tt.isEditing);
    if (unsaved.length > 0) {
      this.ticketTypeError.set('Please finish editing all ticket types before saving.');
      return;
    }
    if (this.ticketTypes.length === 0) {
      this.ticketTypeError.set('At least one ticket type is required.');
      return;
    }
    const unnamed = this.ticketTypes.find(tt => !tt.name.trim());
    if (unnamed) {
      this.ticketTypeError.set('All ticket types must have a name.');
      return;
    }
    this.ticketTypeError.set('');

    this.loading.set(true);
    this.error.set('');

    const formValue = this.form.value;
    const data: any = { ...formValue };

    // Close time
    if (this.closeAtShowTime) data.close_time = '';

    // Build ticketTypes for API
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
      next: (res) => this.router.navigate(['/events', res.event.id]),
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save event.');
        this.loading.set(false);
      }
    });
  }
}
