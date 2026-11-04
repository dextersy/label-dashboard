import {
  Component, OnInit, OnDestroy, Input,
  ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { WristbandDesignEditorComponent, WristbandColorOption } from '../../../components/wristband-design-editor/wristband-design-editor.component';
import { EventsService } from '../../../services/events.service';
import { WristbandService } from '../../../services/wristband.service';
import { AuthService } from '../../../services/auth.service';
import { PayoutsService } from '../../../services/payouts.service';
import { Event as AppEvent } from '../../../models/event.model';
import {
  WristbandColor, WristbandOrder,
  SavedDeliveryAddress, EventAddOnPayment,
} from '../../../models/wristband.model';

interface WristbandColorRow extends WristbandColor {
  quantity: number;
}

@Component({
  selector: 'app-event-add-ons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, WristbandDesignEditorComponent],
  template: `
<div [class]="embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'">

  <!-- Back link + header (standalone page only) -->
  @if (!embedded) {
    <div class="mb-6">
      <a [routerLink]="['/app/events', eventId]" class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase tracking-wider transition-colors">
        ← Back to Event
      </a>
      @if (event) {
        <h1 class="text-xl font-black text-gray-900 mt-2 uppercase">{{ event.title }}</h1>
        <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mt-0.5">Add-ons</p>
      }
    </div>
  }

  <!-- Loading (standalone only — event-detail already handles its own load) -->
  @if (!embedded && loadingEvent) {
    <div class="text-xs font-mono text-gray-400 py-10 text-center uppercase tracking-widest">Loading…</div>
  }

  @if (embedded || (!loadingEvent && event)) {

    <!-- Tab nav -->
    <div class="flex gap-0 border-b border-gray-200 overflow-x-auto mb-6">
      <button (click)="activeTab = 'wristbands'"
        class="px-4 py-2.5 text-xs font-mono uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors"
        [class]="activeTab === 'wristbands' ? 'border-yellow-400 text-yellow-500' : 'border-transparent text-gray-400 hover:text-gray-900'">
        Wristbands
      </button>
      @if (hasConfirmedOrders) {
        <button (click)="activeTab = 'payment'; loadOrders(); loadPayments()"
          class="px-4 py-2.5 text-xs font-mono uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors"
          [class]="activeTab === 'payment' ? 'border-yellow-400 text-yellow-500' : 'border-transparent text-gray-400 hover:text-gray-900'">
          Billing & Payments
          @if (!loadingPayments && addonRemainingBalance > 0) {
            <span class="ml-1 inline-block w-2 h-2 rounded-full bg-yellow-400"></span>
          }
        </button>
      }
    </div>

    <!-- ===== WRISTBANDS TAB ===== -->
    @if (activeTab === 'wristbands') {

      <!-- Post-event lock notice -->
      @if (isEventPast) {
        <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-4 py-3 mb-4 text-sm text-gray-500">
          <span class="shrink-0">🔒</span>
          This event has already taken place. Orders and delivery details can no longer be edited.
        </div>
      }

      <!-- Pending payment notice -->
      @if (!loadingPayments && addonRemainingBalance > 0) {
        <div class="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded px-4 py-3 mb-4 text-sm text-yellow-800">
          <span class="shrink-0">⚠</span>
          You have an outstanding balance of <strong class="font-semibold ml-1">₱{{ addonRemainingBalance | number:'1.2-2' }}</strong>.
          <button (click)="activeTab = 'payment'; loadOrders(); loadPayments()" class="ml-auto text-xs font-mono underline">Pay now</button>
        </div>
      }

      <!-- Awaiting confirmation notice -->
      @if (hasPendingOrders) {
        <div class="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded px-4 py-3 mb-4 text-sm text-blue-800">
          <span class="shrink-0">ℹ</span>
          {{ pendingOrderCount === 1 ? '1 order is' : pendingOrderCount + ' orders are' }} awaiting review. You will be notified once they are confirmed or rejected.
        </div>
      }

      <!-- Delivery Address section -->
      <div class="bg-white border border-gray-200 mb-6">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 class="text-xs font-mono uppercase tracking-widest text-gray-500">Delivery Address</h2>
          @if (hasDeliveryAddress && !editingDeliveryAddress && !isEventPast) {
            <button (click)="editingDeliveryAddress = true" class="text-xs font-mono text-yellow-500 hover:text-yellow-600 uppercase">Edit</button>
          }
        </div>
        <div class="p-5">

          <!-- Saved address book -->
          @if (!editingDeliveryAddress && savedAddresses.length > 0) {
            <div class="mb-4">
              <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Saved Addresses</p>
              <div class="flex flex-wrap gap-2">
                @for (addr of savedAddresses; track addr.id) {
                  <button (click)="selectSavedAddress(addr)"
                    class="text-xs px-3 py-1.5 border font-mono transition-colors"
                    [class]="selectedSavedAddressId === addr.id
                      ? 'border-yellow-400 text-yellow-600 bg-yellow-50'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'">
                    {{ addr.label || addr.name || addr.city || 'Address' }}
                  </button>
                }
              </div>
            </div>
          }

          <!-- Saved address display -->
          @if (!editingDeliveryAddress && hasDeliveryAddress) {
            <div class="space-y-0.5 text-sm text-gray-700">
              @if (deliveryName) { <p class="font-semibold">{{ deliveryName }}</p> }
              @if (deliveryStreet) { <p>{{ deliveryStreet }}</p> }
              @if (deliveryCityLine) { <p>{{ deliveryCityLine }}</p> }
              @if (deliveryPhone) { <p class="text-gray-500">{{ deliveryPhone }}</p> }
            </div>
            @if (!isEventPast) {
              <div class="flex gap-3 mt-3">
                <button (click)="openNewAddressForm()"
                  class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase transition-colors">
                  + Add new address
                </button>
                @if (canClearAddress) {
                  <button (click)="clearDeliveryAddress()"
                    class="text-xs font-mono text-gray-300 hover:text-red-400 uppercase transition-colors">
                    Clear
                  </button>
                }
              </div>
            }
          }

          <!-- No address + not editing -->
          @if (!editingDeliveryAddress && !hasDeliveryAddress && !isEventPast) {
            <div class="text-center py-4">
              <p class="text-sm text-gray-400 mb-3">No delivery address set. Wristbands will be shipped to this address.</p>
              @if (savedAddresses.length > 0) {
                <p class="text-xs text-gray-400 mb-2">Select one above or add a new one:</p>
              }
              <button (click)="openNewAddressForm()"
                class="px-4 py-2 border border-gray-300 text-xs font-mono uppercase tracking-wider text-gray-600 hover:border-gray-500 hover:text-gray-900 transition-colors">
                + Add Delivery Address
              </button>
            </div>
          }

          <!-- Edit form -->
          @if (editingDeliveryAddress) {
            <div class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Name / Organization</label>
                  <input [(ngModel)]="deliveryName" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" placeholder="Recipient name">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                  <input [(ngModel)]="deliveryPhone" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" placeholder="+63 912 345 6789">
                </div>
              </div>
              <div>
                <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Street Address</label>
                <input [(ngModel)]="deliveryStreet" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" placeholder="Street, building, unit">
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">City</label>
                  <input [(ngModel)]="deliveryCity" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Country</label>
                  <input [(ngModel)]="deliveryCountry" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
                </div>
                <div>
                  <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">ZIP / Postal</label>
                  <input [(ngModel)]="deliveryZip" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
                </div>
              </div>

              <!-- Save to address book toggle -->
              @if (!editingFromAddressBook) {
                <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" [(ngModel)]="saveToBook" (change)="onSaveToBookToggle()" class="w-4 h-4">
                  Save to address book
                </label>
                @if (saveToBook) {
                  <div>
                    <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Address label (optional)</label>
                    <input [(ngModel)]="saveToBookLabel" type="text" class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" placeholder="e.g. Venue, Office">
                  </div>
                }
              }

              @if (saveAddressBlockedByPayment) {
                <p class="text-xs text-red-500">Cannot clear address after a payment has been recorded.</p>
              }

              <div class="flex gap-2 pt-1">
                <button (click)="saveAddress()" [disabled]="savingAddress"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors disabled:opacity-50">
                  {{ savingAddress ? 'Saving…' : 'Save Address' }}
                </button>
                <button (click)="cancelDeliveryEdit()"
                  class="px-4 py-2 border border-gray-200 text-xs font-mono text-gray-500 hover:text-gray-900 hover:border-gray-400 uppercase tracking-wider transition-colors">
                  Cancel
                </button>
              </div>
              @if (addressSaved) {
                <p class="text-xs text-green-600 font-mono">✓ Address saved{{ savedToBook ? ' and added to address book' : '' }}</p>
              }
            </div>

            <!-- Address book management (when editing from book) -->
            @if (editingFromAddressBook && savedAddresses.length > 0) {
              <div class="mt-4 border-t border-gray-100 pt-4">
                <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Address Book</p>
                <div class="space-y-1">
                  @for (addr of savedAddresses; track addr.id) {
                    <div class="flex items-center justify-between gap-2 py-1">
                      <span class="text-xs text-gray-600 truncate">{{ addr.label || addr.name || addr.city || '—' }}</span>
                      <div class="flex gap-2 shrink-0">
                        <button (click)="startEditAddress(addr)" class="text-xs font-mono text-gray-400 hover:text-yellow-500">Edit</button>
                        <button (click)="deleteAddress(addr)" class="text-xs font-mono text-gray-300 hover:text-red-400">Delete</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      </div>

      <!-- Orders section -->
      <div class="bg-white border border-gray-200 mb-6">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 class="text-xs font-mono uppercase tracking-widest text-gray-500">Wristband Orders</h2>
          @if (!formOpen && !isEventPast) {
            <button (click)="openNewOrder()"
              class="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors">
              + New Order
            </button>
          }
        </div>

        <!-- Orders table -->
        @if (loadingOrders) {
          <div class="py-8 text-center text-xs font-mono text-gray-400 uppercase tracking-widest">Loading orders…</div>
        } @else if (orders.length === 0 && !formOpen) {
          <div class="py-10 text-center">
            <p class="text-sm text-gray-400 mb-4">No wristband orders yet.</p>
            @if (!isEventPast) {
              <button (click)="openNewOrder()"
                class="px-4 py-2 border border-gray-300 text-xs font-mono uppercase tracking-wider text-gray-600 hover:border-yellow-400 hover:text-yellow-600 transition-colors">
                Create your first order
              </button>
            }
          </div>
        } @else {
          <!-- Desktop table -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="text-left px-5 py-3 text-xs font-mono uppercase tracking-widest text-gray-400">Order</th>
                  <th class="text-left px-5 py-3 text-xs font-mono uppercase tracking-widest text-gray-400">Colors</th>
                  <th class="text-right px-5 py-3 text-xs font-mono uppercase tracking-widest text-gray-400">Qty</th>
                  <th class="text-right px-5 py-3 text-xs font-mono uppercase tracking-widest text-gray-400">Price</th>
                  <th class="text-center px-5 py-3 text-xs font-mono uppercase tracking-widest text-gray-400">Status</th>
                  <th class="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                @for (order of orders; track order.id) {
                  <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-3 text-xs font-mono text-gray-400">
                      #{{ order.id }}
                      @if (order.is_public) {
                        <span class="ml-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-mono uppercase tracking-wide">Public</span>
                      }
                    </td>
                    <td class="px-5 py-3 text-sm text-gray-700">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        @for (item of (order.items || []); track item.id) {
                          @if (item.quantity > 0 && item.color) {
                            <span class="inline-flex items-center gap-1 text-xs">
                              <span class="w-3 h-3 rounded-full inline-block border border-gray-200"
                                [style.background]="item.color.bg_color"></span>
                              {{ item.color.label }} ×{{ item.quantity }}
                            </span>
                          }
                        }
                      </div>
                    </td>
                    <td class="px-5 py-3 text-right text-sm font-mono">{{ totalQty(order) }}</td>
                    <td class="px-5 py-3 text-right text-sm font-mono text-gray-700">
                      ₱{{ orderPrice(order) | number:'1.0-0' }}
                      @if (orderShippingFee(order) > 0) {
                        <span class="text-gray-400 text-xs"> + ₱{{ orderShippingFee(order) | number:'1.0-0' }} ship.</span>
                      }
                      @if (orderDiscount(order) > 0) {
                        <span class="text-green-600 text-xs"> − ₱{{ orderDiscount(order) | number:'1.0-0' }} disc.</span>
                      }
                    </td>
                    <td class="px-5 py-3 text-center">
                      <span class="text-xs px-2 py-0.5 border font-mono uppercase" [class]="statusClass(order.status)">
                        {{ order.status }}
                      </span>
                      @if (order.status === 'rejected' && order.rejection_reason) {
                        <p class="text-xs text-red-600 mt-1 max-w-[160px] mx-auto text-left">{{ order.rejection_reason }}</p>
                      }
                    </td>
                    <td class="px-5 py-3 text-right">
                      <div class="flex gap-2 justify-end">
                        @if (canEdit(order) && !isEventPast) {
                          <button (click)="openEditOrder(order)" class="text-xs font-mono text-gray-400 hover:text-yellow-500 uppercase transition-colors">Edit</button>
                        }
                        @if (canDelete(order) && !isEventPast) {
                          <button (click)="promptDeleteOrder(order)" class="text-xs font-mono text-gray-300 hover:text-red-400 uppercase transition-colors">Delete</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="sm:hidden divide-y divide-gray-100">
            @for (order of orders; track order.id) {
              <div class="px-4 py-4">
                <div class="flex items-start justify-between mb-2">
                  <span class="text-xs font-mono text-gray-400">
                    #{{ order.id }}
                    @if (order.is_public) {
                      <span class="ml-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-mono uppercase tracking-wide">Public</span>
                    }
                  </span>
                  <span class="text-xs px-2 py-0.5 border font-mono uppercase" [class]="statusClass(order.status)">{{ order.status }}</span>
                </div>
                @if (order.status === 'rejected' && order.rejection_reason) {
                  <div class="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded px-3 py-2 mb-2 text-xs text-red-700">
                    <span class="shrink-0 mt-0.5">✕</span>
                    <span>{{ order.rejection_reason }}</span>
                  </div>
                }
                <div class="flex flex-wrap gap-1 mb-2">
                  @for (item of (order.items || []); track item.id) {
                    @if (item.quantity > 0 && item.color) {
                      <span class="inline-flex items-center gap-1 text-xs text-gray-600">
                        <span class="w-3 h-3 rounded-full inline-block border border-gray-200" [style.background]="item.color.bg_color"></span>
                        {{ item.color.label }} ×{{ item.quantity }}
                      </span>
                    }
                  }
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-mono text-gray-700">
                    ₱{{ orderPrice(order) | number:'1.0-0' }}
                    @if (orderDiscount(order) > 0) {
                      <span class="text-green-600 text-xs"> − ₱{{ orderDiscount(order) | number:'1.0-0' }}</span>
                    }
                  </span>
                  <div class="flex gap-3">
                    @if (canEdit(order) && !isEventPast) {
                      <button (click)="openEditOrder(order)" class="text-xs font-mono text-gray-400 hover:text-yellow-500">Edit</button>
                    }
                    @if (canDelete(order) && !isEventPast) {
                      <button (click)="promptDeleteOrder(order)" class="text-xs font-mono text-gray-300 hover:text-red-400">Delete</button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Order form (inline, below table) -->
        @if (formOpen) {
          <div class="border-t border-gray-200 p-5 bg-gray-50" #orderForm>
            <h3 class="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">
              {{ editingOrderId ? 'Edit Order #' + editingOrderId : 'New Wristband Order' }}
            </h3>

            <!-- Color qty selector -->
            <div class="mb-5">
              <p class="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">Colors & Quantities <span class="text-gray-300">(multiples of 10)</span></p>
              @if (loadingColors) {
                <p class="text-xs text-gray-400">Loading colors…</p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (color of formColors; track color.id) {
                    <div class="flex items-center gap-3 border border-gray-200 bg-white px-3 py-2.5">
                      <span class="w-5 h-5 rounded-full border border-gray-200 shrink-0" [style.background]="color.bg_color"></span>
                      <span class="text-sm text-gray-700 flex-1">{{ color.label }}</span>
                      <div class="flex items-center gap-1">
                        <button (click)="decreaseQty(color)"
                          class="w-7 h-7 border border-gray-200 text-gray-500 hover:border-gray-400 text-sm font-bold transition-colors"
                          [disabled]="color.quantity === 0">−</button>
                        <input type="number" [value]="color.quantity" (change)="setQtyFromInput(color, $event)"
                          class="w-14 text-center border border-gray-200 text-sm py-0.5 font-mono focus:outline-none focus:border-yellow-400" step="10" min="0">
                        <button (click)="increaseQty(color)"
                          class="w-7 h-7 border border-gray-200 text-gray-500 hover:border-gray-400 text-sm font-bold transition-colors">+</button>
                      </div>
                    </div>
                  }
                </div>
                @if (formTotalQuantity > 0) {
                  <p class="text-xs font-mono text-gray-500 mt-2">
                    Total: <strong>{{ formTotalQuantity }} wristbands</strong> — estimated ₱{{ formTotalPrice | number:'1.0-0' }} (₱35 per 10)
                  </p>
                }
              }
            </div>

            <!-- Design upload -->
            <div class="mb-5">
              <p class="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">Design (PNG, transparent background)</p>
              <app-wristband-design-editor
                [colors]="colorsForEditor"
                (designChange)="onEditorDesignChange($event)"
                accept="image/png">
              </app-wristband-design-editor>
            </div>

            <!-- Form error -->
            @if (saveOrderError) {
              <p class="text-xs text-red-500 mb-3">{{ saveOrderError }}</p>
            }

            <!-- Form actions -->
            <div class="flex flex-wrap gap-2">
              @if (!isEventPast) {
                <button (click)="saveAsDraft()" [disabled]="savingOrder || formTotalQuantity === 0"
                  class="px-4 py-2 border border-gray-300 text-xs font-mono text-gray-600 hover:border-gray-500 hover:text-gray-900 uppercase tracking-wider transition-colors disabled:opacity-40">
                  Save as Draft
                </button>
                <button (click)="placeOrder()" [disabled]="savingOrder || formTotalQuantity === 0 || !hasDeliveryAddress"
                  class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors disabled:opacity-40"
                  [title]="!hasDeliveryAddress ? 'Set a delivery address first' : ''">
                  {{ savingOrder ? 'Placing…' : 'Place Order' }}
                </button>
              }
              <button (click)="cancelForm()"
                class="px-4 py-2 border border-gray-200 text-xs font-mono text-gray-400 hover:text-gray-700 hover:border-gray-300 uppercase tracking-wider transition-colors">
                Cancel
              </button>
            </div>
            @if (!hasDeliveryAddress && formTotalQuantity > 0) {
              <p class="text-xs text-gray-400 mt-2">⚠ Set a delivery address above to place your order.</p>
            }
          </div>
        }
      </div>

      <!-- Summary bar (bottom — standalone page only) -->
      @if (!embedded && (hasConfirmedOrders || formOpen)) {
        <div class="fixed bottom-0 left-0 right-0 bg-black text-white px-6 py-3 flex items-center justify-between z-30 border-t border-gray-800">
          @if (formOpen && formTotalQuantity > 0) {
            <div class="flex items-center gap-4">
              <span class="text-xs font-mono text-gray-400 uppercase tracking-widest">Order total</span>
              <span class="font-mono font-black text-yellow-400">₱{{ formTotalPrice | number:'1.0-0' }}</span>
              <span class="text-xs font-mono text-gray-500">{{ formTotalQuantity }} wristbands</span>
            </div>
          } @else if (hasConfirmedOrders) {
            <div class="flex items-center gap-4">
              <span class="text-xs font-mono text-gray-400 uppercase tracking-widest">Confirmed total</span>
              <span class="font-mono font-black text-yellow-400">₱{{ addonWristbandTotal | number:'1.0-0' }}</span>
            </div>
            @if (addonRemainingBalance > 0) {
              <button (click)="openPaymentModal()"
                class="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors">
                Pay ₱{{ addonRemainingBalance | number:'1.0-0' }}
              </button>
            } @else {
              <span class="text-xs font-mono text-green-400">✓ Paid</span>
            }
          }
        </div>
      }
    }

    <!-- ===== PAYMENT TAB ===== -->
    @if (activeTab === 'payment') {
      <div class="bg-white border border-gray-200 mb-6">
        <div class="px-5 py-3 border-b border-gray-100">
          <h2 class="text-xs font-mono uppercase tracking-widest text-gray-500">Billing & Payments</h2>
        </div>
        <div class="p-5">

          @if (loadingPayments) {
            <p class="text-xs font-mono text-gray-400 py-4 text-center">Loading…</p>
          } @else {

            <!-- Summary row -->
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="border border-gray-100 p-4">
                <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Total Due</p>
                <p class="text-xl font-black text-gray-900">₱{{ addonTotalDue | number:'1.2-2' }}</p>
              </div>
              <div class="border border-gray-100 p-4">
                <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Paid</p>
                <p class="text-xl font-black text-green-600">₱{{ addonTotalPaid | number:'1.2-2' }}</p>
              </div>
              <div class="border border-gray-100 p-4">
                <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">Balance</p>
                <p class="text-xl font-black" [class]="addonRemainingBalance > 0 ? 'text-red-500' : 'text-gray-300'">₱{{ addonRemainingBalance | number:'1.2-2' }}</p>
              </div>
            </div>

            <!-- Discount line (only shown when there's a discount) -->
            @if (addonTotalDiscount > 0) {
              <div class="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 px-4 py-2 mb-4">
                <span class="text-xs font-mono uppercase tracking-widest text-green-600">Discount applied</span>
                <span class="ml-auto font-mono font-semibold">−₱{{ addonTotalDiscount | number:'1.2-2' }}</span>
              </div>
            }

            <div class="flex flex-wrap items-center gap-3 mb-6">
              @if (addonRemainingBalance > 0) {
                <button (click)="openPaymentModal()"
                  class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors">
                  Pay ₱{{ addonRemainingBalance | number:'1.2-2' }}
                </button>
              }
              @if (addonPayments.length > 0 || addonTotalDue > 0) {
                <div class="flex flex-col items-end gap-1">
                  <button (click)="downloadInvoice()" [disabled]="downloadingInvoice"
                    class="px-5 py-2.5 border border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-900 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50">
                    {{ downloadingInvoice ? 'Downloading…' : 'Download Invoice' }}
                  </button>
                  <a href="/app/settings#billing" class="text-xs font-mono text-gray-400 hover:text-gray-600 underline">Update billing details</a>
                </div>
              }
            </div>

            <!-- Payment history -->
            @if (addonPayments.length > 0) {
              <h3 class="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">Payment History</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-100">
                      <th class="text-left py-2 px-3 text-xs font-mono uppercase tracking-widest text-gray-400">Date</th>
                      <th class="text-left py-2 px-3 text-xs font-mono uppercase tracking-widest text-gray-400">Method</th>
                      <th class="text-right py-2 px-3 text-xs font-mono uppercase tracking-widest text-gray-400">Amount</th>
                      <th class="text-center py-2 px-3 text-xs font-mono uppercase tracking-widest text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of addonPayments; track p.id) {
                      <tr class="border-b border-gray-50">
                        <td class="py-2 px-3 text-xs font-mono text-gray-400">{{ p.createdAt | date:'MMM d, y' }}</td>
                        <td class="py-2 px-3 text-xs text-gray-700 capitalize">{{ p.method }}</td>
                        <td class="py-2 px-3 text-right font-mono text-sm">₱{{ p.amount | number:'1.2-2' }}</td>
                        <td class="py-2 px-3 text-center">
                          <span class="text-xs px-2 py-0.5 border font-mono uppercase" [class]="paymentStatusClass(p.status)">{{ p.status }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="text-sm text-gray-400 text-center py-4">No payments recorded yet.</p>
            }
          }
        </div>
      </div>
    }

  }

</div>

<!-- ===== MODALS ===== -->

<!-- Disclaimer / Place Order -->
@if (showDisclaimerDialog) {
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
    <div class="bg-white max-w-md w-full p-6">
      <h2 class="text-sm font-black uppercase tracking-widest mb-4">Confirm Order Submission</h2>
      <p class="text-sm text-gray-600 mb-4">Please confirm before submitting your order:</p>
      <div class="space-y-3 mb-5">
        <label class="flex items-start gap-3 cursor-pointer text-sm text-gray-700">
          <input type="checkbox" [(ngModel)]="dialogCheck1" class="mt-0.5 w-4 h-4 shrink-0">
          <span>I understand that the design and quantities are <strong>final</strong> once the order is confirmed.</span>
        </label>
        <label class="flex items-start gap-3 cursor-pointer text-sm text-gray-700">
          <input type="checkbox" [(ngModel)]="dialogCheck2" class="mt-0.5 w-4 h-4 shrink-0">
          <span>I acknowledge that wristband printing quality may vary and no refund is available for print quality concerns.</span>
        </label>
      </div>
      <div class="flex gap-2">
        <button (click)="confirmPlaceOrder()" [disabled]="!dialogCanConfirm"
          class="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors disabled:opacity-40">
          Submit Order
        </button>
        <button (click)="showDisclaimerDialog = false"
          class="px-4 py-2.5 border border-gray-200 text-xs font-mono text-gray-500 hover:text-gray-900 uppercase transition-colors">
          Cancel
        </button>
      </div>
    </div>
  </div>
}

<!-- Order Placed Success -->
@if (showOrderPlacedModal) {
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
    <div class="bg-white max-w-sm w-full p-6 text-center">
      <div class="text-4xl mb-4">🎉</div>
      <h2 class="text-sm font-black uppercase tracking-widest mb-2">Order Submitted!</h2>
      <p class="text-sm text-gray-600 mb-5">Your wristband order has been submitted for review. You'll be notified once it's confirmed or if any changes are needed.</p>
      <button (click)="showOrderPlacedModal = false"
        class="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors">
        Got it
      </button>
    </div>
  </div>
}

<!-- Delete Order Confirmation -->
@if (showDeleteOrderDialog) {
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
    <div class="bg-white max-w-sm w-full p-6">
      <h2 class="text-sm font-black uppercase tracking-widest mb-2">Delete Order?</h2>
      <p class="text-sm text-gray-600 mb-5">This draft order will be permanently deleted.</p>
      <div class="flex gap-2">
        <button (click)="confirmDeleteOrder()"
          class="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-mono font-black uppercase tracking-wider transition-colors">
          Delete
        </button>
        <button (click)="showDeleteOrderDialog = false; pendingDeleteOrder = null"
          class="px-4 py-2.5 border border-gray-200 text-xs font-mono text-gray-500 hover:text-gray-900 uppercase transition-colors">
          Cancel
        </button>
      </div>
    </div>
  </div>
}

<!-- Payment modal -->
@if (showPaymentModal) {
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
    <div class="bg-white max-w-md w-full p-6">
      <h2 class="text-sm font-black uppercase tracking-widest mb-1">Record Payment</h2>
      <p class="text-sm text-gray-500 mb-4">Outstanding balance: <strong class="text-gray-900">₱{{ addonRemainingBalance | number:'1.2-2' }}</strong></p>

      <!-- Payment method selector -->
      <div class="mb-4">
        <p class="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
        <div class="grid grid-cols-2 gap-2">
          <button (click)="paymentMethod = 'balance'"
            class="py-3 px-4 border text-sm font-mono transition-colors text-left"
            [class]="paymentMethod === 'balance' ? 'border-yellow-400 bg-yellow-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'">
            <span class="block text-xs uppercase tracking-wider mb-0.5">Payout Balance</span>
            @if (loadingBalance) {
              <span class="text-xs text-gray-300">Loading…</span>
            } @else {
              <span class="font-black" [class]="(brandBalance ?? 0) >= addonRemainingBalance ? 'text-green-600' : 'text-red-500'">
                ₱{{ (brandBalance ?? 0) | number:'1.2-2' }}
              </span>
            }
          </button>
          <button (click)="paymentMethod = 'paymongo'"
            class="py-3 px-4 border text-sm font-mono transition-colors text-left"
            [class]="paymentMethod === 'paymongo' ? 'border-yellow-400 bg-yellow-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'">
            <span class="block text-xs uppercase tracking-wider mb-0.5">Card / GCash</span>
            <span class="text-xs text-gray-400">via Paymongo</span>
          </button>
        </div>
      </div>

      <!-- Balance warning -->
      @if (paymentMethod === 'balance' && !loadingBalance && (brandBalance ?? 0) < addonRemainingBalance) {
        <div class="bg-amber-50 border border-amber-200 px-3 py-2 mb-4 text-xs text-amber-800">
          Insufficient payout balance. Available: ₱{{ (brandBalance ?? 0) | number:'1.2-2' }}. Use Card/GCash to pay the full amount.
        </div>
      }

      @if (paymentMethod === 'paymongo') {
        <div class="bg-blue-50 border border-blue-200 px-3 py-2 mb-4 text-xs text-blue-800">
          You will be redirected to a secure payment page to pay ₱{{ addonRemainingBalance | number:'1.2-2' }}.
        </div>
      }

      <!-- Notes -->
      <div class="mb-4">
        <label class="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Notes (optional)</label>
        <textarea [(ngModel)]="paymentNotes" rows="2"
          class="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
          placeholder="Any notes for this payment"></textarea>
      </div>

      @if (paymentSuccess) {
        <p class="text-xs text-green-600 font-mono mb-3">✓ Payment recorded successfully.</p>
      }

      @if (paymentError) {
        <p class="text-xs text-red-500 mb-3">{{ paymentError }}</p>
      }

      <div class="flex gap-2">
        <button (click)="submitPayment()"
          [disabled]="savingPayment || (paymentMethod === 'balance' && !loadingBalance && (brandBalance ?? 0) < addonRemainingBalance)"
          class="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-mono font-black uppercase tracking-wider transition-colors disabled:opacity-40">
          {{ savingPayment ? (paymentMethod === 'balance' ? 'Processing…' : 'Redirecting…') : (paymentMethod === 'balance' ? 'Pay from Balance' : 'Pay via Card') }}
        </button>
        <button (click)="showPaymentModal = false; paymentSuccess = false"
          class="px-4 py-2.5 border border-gray-200 text-xs font-mono text-gray-500 hover:text-gray-900 uppercase transition-colors">
          {{ paymentSuccess ? 'Close' : 'Cancel' }}
        </button>
      </div>
    </div>
  </div>
}
  `,
})
export class EventAddOnsComponent implements OnInit, OnDestroy {
  @ViewChild(WristbandDesignEditorComponent) designEditorRef?: WristbandDesignEditorComponent;
  @ViewChild('orderForm') orderFormEl?: ElementRef<HTMLDivElement>;

  @Input() embedded = false;
  /** When embedded as a tab, the parent passes the event directly. */
  @Input() set embeddedEvent(e: AppEvent | null) {
    if (!e) return;
    const firstLoad = !this.eventId;
    this.event = e;
    this.eventId = e.id;
    this.loadingEvent = false;
    // If ngOnInit already ran with eventId=0 (event arrived late), trigger loads now
    if (this._initialized && firstLoad) {
      this.loadAll();
    }
  }

  private _initialized = false;

  eventId!: number;
  event: AppEvent | null = null;
  loadingEvent = true;

  activeTab = 'wristbands';

  readonly PRICE_PER_10 = 35;

  // Colors
  wristbandColors: WristbandColorRow[] = [];
  loadingColors = true;
  formColors: WristbandColorRow[] = [];

  // Design
  formDesignChanged = false;

  // Delivery address
  deliveryName = '';
  deliveryStreet = '';
  deliveryCity = '';
  deliveryCountry = '';
  deliveryZip = '';
  deliveryPhone = '';
  savingAddress = false;
  addressSaved = false;
  savedToBook = false;
  editingDeliveryAddress = false;
  saveAddressBlockedByPayment = false;
  saveToBook = false;
  saveToBookLabel = '';
  editingFromAddressBook = false;
  editingAddressId: number | null = null;
  selectedSavedAddressId: number | null = null;

  // Address book
  savedAddresses: SavedDeliveryAddress[] = [];
  loadingAddresses = false;

  get hasDeliveryAddress(): boolean {
    return !!(this.deliveryName || this.deliveryStreet || this.deliveryCity || this.deliveryCountry || this.deliveryZip || this.deliveryPhone);
  }

  get deliveryCityLine(): string {
    return [this.deliveryCity, this.deliveryCountry, this.deliveryZip].filter(Boolean).join(', ');
  }

  get canClearAddress(): boolean { return !this.hasAnyPayment; }

  // Orders
  orders: WristbandOrder[] = [];
  loadingOrders = false;

  // Order form
  formOpen = false;
  editingOrderId: number | null = null;
  savingOrder = false;
  saveOrderError: string | null = null;

  get formTotalQuantity(): number {
    return this.formColors.reduce((s, c) => s + c.quantity, 0);
  }

  get formTotalPrice(): number {
    return (this.formTotalQuantity / 10) * this.PRICE_PER_10;
  }

  // Dialogs
  showDisclaimerDialog = false;
  dialogCheck1 = false;
  dialogCheck2 = false;
  get dialogCanConfirm(): boolean { return this.dialogCheck1 && this.dialogCheck2; }

  showOrderPlacedModal = false;
  showDeleteOrderDialog = false;
  pendingDeleteOrder: WristbandOrder | null = null;

  // Payments
  addonPayments: EventAddOnPayment[] = [];
  addonTotalPaid = 0;
  loadingPayments = false;
  showPaymentModal = false;
  paymentMethod: 'balance' | 'paymongo' = 'balance';
  paymentNotes = '';
  savingPayment = false;
  paymentError: string | null = null;
  paymentSuccess = false;
  brandBalance: number | null = null;
  loadingBalance = false;
  downloadingInvoice = false;

  get addonWristbandTotal(): number {
    return this.orders
      .filter(o => o.status === 'confirmed' || o.status === 'shipped')
      .reduce((s, o) => s + this.orderTotal(o), 0);
  }

  get addonTotalDiscount(): number {
    return this.orders
      .filter(o => o.status === 'confirmed' || o.status === 'shipped')
      .reduce((s, o) => s + this.orderDiscount(o), 0);
  }

  get addonTotalDue(): number { return this.addonWristbandTotal; }

  get addonRemainingBalance(): number {
    return Math.max(0, this.addonTotalDue - this.addonTotalPaid);
  }

  get hasConfirmedOrders(): boolean {
    return this.orders.some(o => o.status === 'confirmed' || o.status === 'shipped');
  }

  get hasPendingOrders(): boolean {
    return this.orders.some(o => o.status === 'placed');
  }

  get pendingOrderCount(): number {
    return this.orders.filter(o => o.status === 'placed').length;
  }

  get hasAnyPayment(): boolean { return this.addonTotalPaid > 0; }

  get isEventPast(): boolean {
    if (!this.event) return false;
    return new Date(this.event.date_and_time) < new Date();
  }

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private eventsService: EventsService,
    private wristbandService: WristbandService,
    private authService: AuthService,
    private payoutsService: PayoutsService,
  ) {}

  ngOnInit(): void {
    this._initialized = true;

    // Load colors (needed regardless of event)
    this.subs.add(
      this.wristbandService.getWristbandColors().subscribe({
        next: (colors) => {
          this.wristbandColors = colors.map(c => ({ ...c, quantity: 0 }));
          this.loadingColors = false;
          this.resetFormColors();
        },
        error: () => { this.loadingColors = false; },
      })
    );

    if (!this.embedded) {
      this.eventId = +(this.route.snapshot.paramMap.get('id') ?? 0);
      this.eventsService.getEvent(this.eventId).subscribe({
        next: (e) => { this.event = e; this.loadingEvent = false; },
        error: () => { this.loadingEvent = false; },
      });
      this.loadAll();

      // Check for Paymongo return (standalone page only)
      this.subs.add(this.route.queryParams.subscribe(params => {
        if (params['payment_status'] === 'success' || params['tab'] === 'payment') {
          this.activeTab = 'payment';
          this.loadPayments();
        }
      }));
    } else if (this.eventId) {
      // embeddedEvent setter already fired before ngOnInit with a valid event
      this.loadAll();
    }
    // If embedded and eventId=0, the setter will call loadAll() once the event arrives
  }

  private loadAll(): void {
    this.loadSettings();
    this.loadOrders();
    this.loadPayments();
    this.loadSavedAddresses();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private loadSettings(): void {
    this.subs.add(
      this.wristbandService.getWristbandSettings(this.eventId).subscribe({
        next: (s) => {
          this.deliveryName    = s.delivery_name    ?? '';
          this.deliveryStreet  = s.delivery_street  ?? '';
          this.deliveryCity    = s.delivery_city    ?? '';
          this.deliveryCountry = s.delivery_country ?? '';
          this.deliveryZip     = s.delivery_zip     ?? '';
          this.deliveryPhone   = s.delivery_phone   ?? '';
        },
        error: () => {},
      })
    );
  }

  loadOrders(): void {
    this.loadingOrders = true;
    this.subs.add(
      this.wristbandService.getWristbandOrders(this.eventId).subscribe({
        next: (orders) => { this.orders = orders; this.loadingOrders = false; },
        error: () => { this.loadingOrders = false; },
      })
    );
  }

  loadPayments(): void {
    this.loadingPayments = true;
    this.subs.add(
      this.wristbandService.getAddOnPayments(this.eventId).subscribe({
        next: (data) => {
          this.addonPayments = data.payments;
          this.addonTotalPaid = data.total_paid;
          this.loadingPayments = false;
        },
        error: () => { this.loadingPayments = false; },
      })
    );
  }

  private loadSavedAddresses(): void {
    this.loadingAddresses = true;
    this.subs.add(
      this.wristbandService.getSavedDeliveryAddresses().subscribe({
        next: (addrs) => { this.savedAddresses = addrs; this.loadingAddresses = false; },
        error: () => { this.loadingAddresses = false; },
      })
    );
  }

  // ─── Delivery address ────────────────────────────────────────────────────

  saveAddress(): void {
    const fields = {
      delivery_name:    this.deliveryName.trim()    || null,
      delivery_street:  this.deliveryStreet.trim()  || null,
      delivery_city:    this.deliveryCity.trim()    || null,
      delivery_country: this.deliveryCountry.trim() || null,
      delivery_zip:     this.deliveryZip.trim()     || null,
      delivery_phone:   this.deliveryPhone.trim()   || null,
    };
    const wouldClear = !Object.values(fields).some(v => !!v);
    if (this.hasAnyPayment && wouldClear) {
      this.saveAddressBlockedByPayment = true;
      return;
    }
    this.saveAddressBlockedByPayment = false;
    this.savingAddress = true;
    this.addressSaved = false;
    this.savedToBook = false;

    this.wristbandService.upsertWristbandSettings(this.eventId, fields).subscribe({
      next: () => {
        this.savingAddress = false;
        this.addressSaved = true;
        this.editingDeliveryAddress = false;

        if (this.editingFromAddressBook && this.editingAddressId) {
          this.wristbandService.updateSavedDeliveryAddress(this.editingAddressId, {
            name:    fields.delivery_name,
            street:  fields.delivery_street,
            city:    fields.delivery_city,
            country: fields.delivery_country,
            zip:     fields.delivery_zip,
            phone:   fields.delivery_phone,
          }).subscribe({
            next: (updated) => {
              const idx = this.savedAddresses.findIndex(a => a.id === updated.id);
              if (idx >= 0) this.savedAddresses[idx] = updated;
              this.selectedSavedAddressId = updated.id;
            },
            error: () => {},
          });
          this.editingFromAddressBook = false;
          this.editingAddressId = null;
        } else if (this.saveToBook && this.hasDeliveryAddress) {
          this.saveToAddressBook(fields);
        }
      },
      error: () => { this.savingAddress = false; },
    });
  }

  private saveToAddressBook(fields: any): void {
    this.wristbandService.createSavedDeliveryAddress({
      label:   this.saveToBookLabel.trim() || null,
      name:    fields.delivery_name,
      street:  fields.delivery_street,
      city:    fields.delivery_city,
      country: fields.delivery_country,
      zip:     fields.delivery_zip,
      phone:   fields.delivery_phone,
    }).subscribe({
      next: (saved) => {
        this.savedAddresses.unshift(saved);
        this.savedToBook = true;
        this.saveToBook = false;
        this.selectedSavedAddressId = saved.id;
      },
      error: () => {},
    });
  }

  cancelDeliveryEdit(): void {
    if (this.editingFromAddressBook && this.editingAddressId) {
      const addr = this.savedAddresses.find(a => a.id === this.editingAddressId);
      if (addr) {
        this.deliveryName    = addr.name    ?? '';
        this.deliveryStreet  = addr.street  ?? '';
        this.deliveryCity    = addr.city    ?? '';
        this.deliveryCountry = addr.country ?? '';
        this.deliveryZip     = addr.zip     ?? '';
        this.deliveryPhone   = addr.phone   ?? '';
      }
      this.editingFromAddressBook = false;
      this.editingAddressId = null;
    }
    this.editingDeliveryAddress = false;
  }

  selectSavedAddress(addr: SavedDeliveryAddress): void {
    this.selectedSavedAddressId = addr.id;
    this.deliveryName    = addr.name    ?? '';
    this.deliveryStreet  = addr.street  ?? '';
    this.deliveryCity    = addr.city    ?? '';
    this.deliveryCountry = addr.country ?? '';
    this.deliveryZip     = addr.zip     ?? '';
    this.deliveryPhone   = addr.phone   ?? '';
    this.addressSaved = false;
    this.saveToBook = false;
    this.editingDeliveryAddress = false;
    this.saveAddress();
  }

  openNewAddressForm(): void {
    this.deliveryName = '';
    this.deliveryStreet = '';
    this.deliveryCity = '';
    this.deliveryCountry = '';
    this.deliveryZip = '';
    this.deliveryPhone = '';
    this.selectedSavedAddressId = null;
    this.saveToBook = true;
    this.saveToBookLabel = '';
    this.addressSaved = false;
    this.editingDeliveryAddress = true;
  }

  clearDeliveryAddress(): void {
    this.deliveryName = '';
    this.deliveryStreet = '';
    this.deliveryCity = '';
    this.deliveryCountry = '';
    this.deliveryZip = '';
    this.deliveryPhone = '';
    this.selectedSavedAddressId = null;
    this.saveAddress();
  }

  startEditAddress(addr: SavedDeliveryAddress): void {
    this.editingAddressId = addr.id;
    this.editingFromAddressBook = true;
    this.selectedSavedAddressId = addr.id;
    this.deliveryName    = addr.name    ?? '';
    this.deliveryStreet  = addr.street  ?? '';
    this.deliveryCity    = addr.city    ?? '';
    this.deliveryCountry = addr.country ?? '';
    this.deliveryZip     = addr.zip     ?? '';
    this.deliveryPhone   = addr.phone   ?? '';
    this.saveToBook = false;
    this.addressSaved = false;
    this.editingDeliveryAddress = true;
  }

  deleteAddress(addr: SavedDeliveryAddress): void {
    if (!confirm(`Delete "${addr.label || addr.name || 'this address'}"?`)) return;
    this.wristbandService.deleteSavedDeliveryAddress(addr.id).subscribe({
      next: () => {
        this.savedAddresses = this.savedAddresses.filter(a => a.id !== addr.id);
        if (this.selectedSavedAddressId === addr.id) this.selectedSavedAddressId = null;
      },
      error: () => {},
    });
  }

  onSaveToBookToggle(): void {
    if (this.saveToBook) {
      this.saveToBookLabel = '';
      this.savedToBook = false;
    }
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  private resetFormColors(): void {
    this.formColors = this.wristbandColors.map(c => ({ ...c, quantity: 0 }));
  }

  openNewOrder(): void {
    this.resetFormColors();
    this.formDesignChanged = false;
    this.saveOrderError = null;
    this.editingOrderId = null;
    this.formOpen = true;
    setTimeout(() => this.orderFormEl?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  openEditOrder(order: WristbandOrder): void {
    this.resetFormColors();
    (order.items ?? []).forEach(item => {
      const row = this.formColors.find(c => c.id === item.wristband_color_id);
      if (row) row.quantity = item.quantity;
    });
    this.formDesignChanged = false;
    this.saveOrderError = null;
    this.editingOrderId = order.id;
    this.formOpen = true;
    if (order.design_url) {
      const url = `${this.wristbandService.getDesignUrl(order.id)}?v=${encodeURIComponent(order.design_url.split('/').pop() ?? '')}`;
      const savedPos = (order.design_x != null && order.design_y != null && order.design_width != null && order.design_height != null)
        ? { x: order.design_x, y: order.design_y, width: order.design_width, height: order.design_height, canvasWidth: (order as any).canvas_width ?? 700 }
        : undefined;
      setTimeout(() => this.designEditorRef?.loadFromUrl(url, savedPos), 0);
    }
    setTimeout(() => this.orderFormEl?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  cancelForm(): void {
    this.formOpen = false;
    this.editingOrderId = null;
  }

  totalQty(order: WristbandOrder): number {
    return (order.items ?? []).reduce((s, i) => s + i.quantity, 0);
  }

  orderPrice(order: WristbandOrder): number {
    return (this.totalQty(order) / 10) * this.PRICE_PER_10;
  }

  orderShippingFee(order: WristbandOrder): number {
    return parseFloat(String(order.shipping_fee ?? 0));
  }

  orderDiscount(order: WristbandOrder): number {
    return parseFloat(String(order.discount ?? 0));
  }

  orderTotal(order: WristbandOrder): number {
    return Math.max(0, this.orderPrice(order) + this.orderShippingFee(order) - this.orderDiscount(order));
  }

  canEdit(order: WristbandOrder): boolean {
    return order.status === 'draft' || order.status === 'rejected';
  }

  canDelete(order: WristbandOrder): boolean {
    return order.status === 'draft';
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      draft:     'border-yellow-200 text-yellow-600 bg-yellow-50',
      placed:    'border-blue-200 text-blue-600 bg-blue-50',
      rejected:  'border-red-200 text-red-600 bg-red-50',
      confirmed: 'border-green-200 text-green-700 bg-green-50',
    };
    return map[status] ?? 'border-gray-200 text-gray-500';
  }

  paymentStatusClass(status: string): string {
    if (status === 'succeeded') return 'border-green-200 text-green-700 bg-green-50';
    if (status === 'pending')   return 'border-yellow-200 text-yellow-600 bg-yellow-50';
    return 'border-red-200 text-red-600 bg-red-50';
  }

  // ─── Qty controls ────────────────────────────────────────────────────────

  decreaseQty(color: WristbandColorRow): void {
    if (color.quantity >= 10) {
      color.quantity -= 10;
    }
  }

  increaseQty(color: WristbandColorRow): void {
    color.quantity += 10;
  }

  setQtyFromInput(color: WristbandColorRow, event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    const snapped = isNaN(raw) || raw < 0 ? 0 : Math.round(raw / 10) * 10;
    color.quantity = snapped;
    (event.target as HTMLInputElement).value = String(snapped);
  }

  // ─── Order submission ────────────────────────────────────────────────────

  saveAsDraft(): void { this.submitOrder('draft'); }

  placeOrder(): void {
    this.dialogCheck1 = false;
    this.dialogCheck2 = false;
    this.showDisclaimerDialog = true;
  }

  confirmPlaceOrder(): void {
    this.showDisclaimerDialog = false;
    this.submitOrder('placed');
  }

  private async submitOrder(status: 'draft' | 'placed'): Promise<void> {
    this.savingOrder = true;
    this.saveOrderError = null;
    try {
      const fd = new FormData();
      fd.append('status', status);
      fd.append('disclaimer_acknowledged', status === 'placed' ? 'true' : 'false');

      const items = this.formColors
        .filter(c => c.quantity > 0)
        .map(c => ({ wristband_color_id: c.id, quantity: c.quantity }));
      fd.append('items', JSON.stringify(items));

      const editorDataUrl = this.designEditorRef?.designDataUrl;
      if (this.formDesignChanged && editorDataUrl) {
        const blob = await fetch(editorDataUrl).then(r => r.blob());
        fd.append('design', blob, 'design.png');
      }

      if (editorDataUrl && this.designEditorRef) {
        const pos = this.designEditorRef.designPos;
        fd.append('design_x',      String(pos.x));
        fd.append('design_y',      String(pos.y));
        fd.append('design_width',  String(pos.width));
        fd.append('design_height', String(pos.height));
        fd.append('canvas_width',  String(this.designEditorRef.getCanvasWidth()));
      }

      const obs = this.editingOrderId
        ? this.wristbandService.updateWristbandOrder(this.editingOrderId, fd)
        : this.wristbandService.createWristbandOrder(this.eventId, fd);

      obs.subscribe({
        next: (order) => {
          if (this.editingOrderId) {
            const idx = this.orders.findIndex(o => o.id === order.id);
            if (idx >= 0) this.orders[idx] = order;
          } else {
            this.orders.unshift(order);
          }
          this.savingOrder = false;
          this.formOpen = false;
          this.editingOrderId = null;
          if (status === 'placed') this.showOrderPlacedModal = true;
        },
        error: (err) => {
          this.savingOrder = false;
          this.saveOrderError = err?.error?.error ?? 'Failed to save order.';
        },
      });
    } catch (err: any) {
      this.savingOrder = false;
      this.saveOrderError = err.message ?? 'Failed to prepare order.';
    }
  }

  promptDeleteOrder(order: WristbandOrder): void {
    this.pendingDeleteOrder = order;
    this.showDeleteOrderDialog = true;
  }

  confirmDeleteOrder(): void {
    if (!this.pendingDeleteOrder) return;
    const id = this.pendingDeleteOrder.id;
    this.showDeleteOrderDialog = false;
    this.pendingDeleteOrder = null;
    this.wristbandService.deleteWristbandOrder(id).subscribe({
      next: () => { this.orders = this.orders.filter(o => o.id !== id); },
      error: () => {},
    });
  }

  // ─── Design editor ───────────────────────────────────────────────────────

  get colorsForEditor(): WristbandColorOption[] {
    return this.formColors.map(c => ({ id: c.id, slug: c.slug, label: c.label, bg_color: c.bg_color }));
  }

  onEditorDesignChange(url: string | null): void {
    this.formDesignChanged = url !== null;
  }

  // ─── Payment ─────────────────────────────────────────────────────────────

  openPaymentModal(): void {
    this.paymentMethod = 'balance';
    this.paymentNotes = '';
    this.paymentError = null;
    this.paymentSuccess = false;
    this.brandBalance = null;
    this.loadingBalance = true;
    this.showPaymentModal = true;

    this.authService.currentUser$.pipe(take(1)).subscribe(u => {
      if (u?.brand_id) {
        this.payoutsService.getBalance(u.brand_id).subscribe({
          next: (data) => { this.brandBalance = data.receivable_balance; this.loadingBalance = false; },
          error: () => { this.loadingBalance = false; },
        });
      } else {
        this.loadingBalance = false;
      }
    });
  }

  downloadInvoice(): void {
    if (this.downloadingInvoice) return;
    this.downloadingInvoice = true;
    this.wristbandService.downloadAddOnInvoicePdf(this.eventId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-event-${this.eventId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingInvoice = false;
      },
      error: () => { this.downloadingInvoice = false; },
    });
  }

  submitPayment(): void {
    if (this.savingPayment) return;
    const amount = this.addonRemainingBalance;
    if (!amount || amount <= 0) return;
    this.savingPayment = true;
    this.paymentError = null;
    this.paymentSuccess = false;

    if (this.paymentMethod === 'paymongo') {
      this.wristbandService.initiateAddOnPayment({
        event_id: this.eventId,
        amount,
        notes: this.paymentNotes || undefined,
      }).subscribe({
        next: (res) => { window.location.href = res.checkout_url; },
        error: (err) => {
          this.savingPayment = false;
          this.paymentError = err?.error?.error ?? 'Failed to create payment. Please try again.';
        },
      });
      return;
    }

    // Balance payment
    this.wristbandService.createAddOnPayment({
      event_id: this.eventId,
      amount,
      method: 'balance',
      notes: this.paymentNotes || undefined,
    }).subscribe({
      next: () => {
        this.savingPayment = false;
        this.paymentSuccess = true;
        this.loadPayments();
        // Refresh balance
        this.authService.currentUser$.pipe(take(1)).subscribe(u => {
          if (u?.brand_id) {
            this.payoutsService.getBalance(u.brand_id).subscribe({
              next: (data) => { this.brandBalance = data.receivable_balance; },
              error: () => {},
            });
          }
        });
      },
      error: (err) => {
        this.savingPayment = false;
        this.paymentError = err?.error?.error ?? 'Failed to record payment. Please try again.';
      },
    });
  }
}
