import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicWristbandService, PublicWristbandOrder } from '../../services/public-wristband.service';
import { WristbandColor } from '../../models/wristband.model';
import { WristbandDesignEditorComponent, WristbandColorOption } from '../../components/wristband-design-editor/wristband-design-editor.component';

const SUPPORT_EMAIL = 'support@melt-records.com';

const PRICE_PER_10 = 45;

interface ColorRow extends WristbandColor {
  quantity: number;
}

@Component({
  selector: 'app-public-wristband-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WristbandDesignEditorComponent],
  styles: [`
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes checkDraw { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
    @keyframes confettiFall {
      0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
    }
    .modal-backdrop { animation: fadeIn 0.25s ease-out forwards; }
    .modal-card { animation: scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .check-path { stroke-dasharray: 100; animation: checkDraw 0.5s 0.3s ease-out forwards; stroke-dashoffset: 100; }
    .confetti-piece { position: absolute; width: 8px; height: 8px; border-radius: 2px; animation: confettiFall 1s ease-in forwards; }
  `],
  template: `
<div class="min-h-screen bg-gray-50 px-4 py-8 pb-28 md:pb-8">
  <div class="max-w-2xl mx-auto">

    <!-- Header -->
    <div class="mb-6">
      <img src="/assets/logo-light-bg.png" alt="Your Scene" class="h-7 mb-4" />
      <h1 class="text-xl font-black text-gray-900 uppercase tracking-tight">Wristband Order</h1>
      @if (order) {
        <p class="text-xs font-mono text-gray-400 mt-0.5">Order #{{ order.id }} · {{ order.customer_name }}</p>
      }
    </div>

    <!-- Loading -->
    @if (loadingOrder) {
      <div class="text-xs font-mono text-gray-400 py-10 text-center uppercase tracking-widest">Loading…</div>
    }

    <!-- Not found -->
    @if (!loadingOrder && orderNotFound) {
      <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-900 mb-2">Order not found</h2>
        <p class="text-sm text-gray-500 mb-6">This link may have expired or the order doesn't exist.</p>
        <div class="flex flex-col gap-3">
          <a routerLink="/wristband-order"
            class="block rounded-lg bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-sm py-2.5 transition-colors uppercase tracking-wide text-center">
            Create a New Order
          </a>
          <a href="https://yourscene.live" target="_blank"
            class="block rounded-lg border border-gray-300 hover:border-gray-400 text-gray-600 text-sm py-2.5 transition-colors text-center">
            Go to Your Scene
          </a>
        </div>
      </div>
    }

    @if (!loadingOrder && order) {

      <!-- Status banner -->
      @if (order.status === 'placed') {
        <div class="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-sm text-blue-800">
          <span class="shrink-0">ℹ</span>
          Your order has been submitted and is awaiting review. You'll get an email once it's confirmed or rejected.
        </div>
      }
      @if (order.status === 'confirmed' && order.payment_status !== 'paid') {
        <div class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 text-sm text-green-800">
          <span class="shrink-0">✓</span>
          Your order has been confirmed! Please proceed to payment below.
        </div>
      }
      @if (order.status === 'rejected') {
        <div class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-800">
          <span class="shrink-0 mt-0.5">✕</span>
          <div>
            Your order was rejected. Please update your order and re-submit.
            @if (order.rejection_reason) {
              <div class="mt-1"><strong>Reason:</strong> {{ order.rejection_reason }}</div>
            }
          </div>
        </div>
      }
      @if (order.status === 'shipped') {
        <div class="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-sm text-blue-800">
          <span class="shrink-0">📦</span>
          Your order has been shipped!
          @if (order.tracking_url) {
            <a [href]="order.tracking_url" target="_blank" class="ml-auto text-xs font-mono underline">Track shipment</a>
          }
        </div>
      }
      @if (order.payment_status === 'paid') {
        <div class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 text-sm text-green-800">
          <span class="shrink-0">✓</span>
          Payment received! Your wristbands will be shipped soon.
        </div>
      }
      @if (paymentStatus === 'success') {
        <div class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 text-sm text-green-800">
          <span class="shrink-0">✓</span>
          Payment successful! Thank you.
        </div>
      }
      @if (paymentStatus === 'cancelled') {
        <div class="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-5 text-sm text-yellow-800">
          <span class="shrink-0">⚠</span>
          Payment was cancelled. You can try again below.
        </div>
      }

      <!-- ═══ EDITABLE WIZARD (draft / rejected) ═══ -->
      @if (order.status === 'draft' || order.status === 'rejected') {

        <!-- Step indicator -->
        <div class="sticky top-0 z-10 bg-gray-50 -mx-4 px-4 pt-2 pb-3 mb-4 md:static md:mx-0 md:px-0 md:pt-0 md:pb-0 md:mb-6 md:bg-transparent border-b border-gray-100 md:border-0">
        <div class="flex items-center gap-2 overflow-x-auto pb-2 pr-4 md:pb-1 md:pr-0">
          @for (s of steps; track s.id) {
            <button
              (click)="goToStep(s.id)"
              class="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest transition-colors"
              [class]="activeStep === s.id
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-gray-100 text-gray-400 hover:text-gray-700'">
              <span>{{ s.id }}.</span> {{ s.label }}
            </button>
          }
        </div>
        </div>

        <!-- ─── Step 1: Colours & Design ─── -->
        @if (activeStep === 1) {
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Wristband Colours & Quantities</h2>

            @if (loadingColors) {
              <p class="text-xs text-gray-400 text-center py-4">Loading colours…</p>
            } @else {
              <div class="space-y-3">
                @for (row of colorRows; track row.id) {
                  <div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div class="w-8 h-8 rounded-full shrink-0 border border-gray-200" [style.background-color]="row.bg_color"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">{{ row.label }}</p>
                      <p class="text-xs text-gray-400">₱{{ PRICE_PER_10 }} per 10 pcs</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button type="button"
                        (click)="adjustQty(row, -10)"
                        [disabled]="row.quantity <= 0"
                        class="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-sm font-bold text-gray-700 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                      <span class="w-10 text-center text-sm font-mono text-gray-900">{{ row.quantity }}</span>
                      <button type="button"
                        (click)="adjustQty(row, 10)"
                        class="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-sm font-bold text-gray-700 hover:border-gray-500">+</button>
                    </div>
                  </div>
                }
              </div>

              @if (totalQty > 0) {
                <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                  <span class="text-gray-500">Subtotal</span>
                  <span class="font-bold text-gray-900">{{ totalQty }} pcs · ₱{{ subtotal | number:'1.2-2' }}</span>
                </div>
                <div class="mt-3 flex items-start gap-2.5 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2.5">
                  <span class="text-base leading-none mt-0.5">💡</span>
                  <p class="text-xs text-yellow-900 leading-relaxed">
                    <strong>Save ₱{{ (totalQty / 10 * 10) | number:'1.0-0' }} on this order!</strong>
                    <a href="/signup?mode=organizer" target="_blank" class="underline font-semibold hover:text-yellow-700 transition-colors"> List your event on Your Scene</a> and pay only ₱{{ (totalQty / 10 * 35) | number:'1.2-2' }} instead.
                  </p>
                </div>
              }
            }

            <!-- Design upload -->
            <div class="mt-6 pt-5 border-t border-gray-100">
              <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-1">Wristband Design</h2>
              <p class="text-xs text-gray-400 mb-3">Upload a PNG file of your wristband artwork. Max 10 MB.</p>
              <app-wristband-design-editor
                [colors]="colorsForEditor"
                accept="image/png">
              </app-wristband-design-editor>
            </div>
          </div>

          <div class="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t border-gray-200 md:border-0 px-4 pt-3 pb-4 md:px-0 md:pt-0 md:pb-0 md:mt-4 space-y-2 z-20">
            <button (click)="saveAndNext()" [disabled]="savingItems || totalQty === 0"
              class="w-full rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm px-6 py-2.5 transition-colors uppercase tracking-wide">
              @if (savingItems) { Saving… } @else { Next: Delivery }
            </button>
            <div class="text-center">
              <button (click)="saveDraftReminder()" [disabled]="sendingReminder"
                class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline">
                @if (sendingReminder) { Sending… } @else { Save draft & email me a link }
              </button>
              @if (reminderSent) {
                <p class="text-xs text-green-600 mt-1">✓ Link sent to {{ order.customer_email }}</p>
              }
            </div>
            <p class="text-center text-xs text-gray-400">Need help? <a href="mailto:{{ SUPPORT_EMAIL }}" class="underline hover:text-gray-600">{{ SUPPORT_EMAIL }}</a></p>
          </div>
        }

        <!-- ─── Step 2: Delivery Address ─── -->
        @if (activeStep === 2) {
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Delivery Address</h2>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Recipient Name *</label>
                <input type="text" [(ngModel)]="deliveryName" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Full name" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Street Address *</label>
                <input type="text" [(ngModel)]="deliveryStreet" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Street / barangay" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">City *</label>
                  <input type="text" [(ngModel)]="deliveryCity" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="City / municipality" />
                </div>
                <div>
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">ZIP *</label>
                  <input type="text" [(ngModel)]="deliveryZip" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="ZIP code" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Country</label>
                <input type="text" [(ngModel)]="deliveryCountry" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Philippines" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Phone Number *</label>
                <input type="tel" [(ngModel)]="deliveryPhone" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="+63 9XX XXX XXXX" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Notes (optional)</label>
                <textarea [(ngModel)]="notes" rows="2" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none" placeholder="Any special instructions…"></textarea>
              </div>
            </div>
          </div>

          <!-- Billing Address -->
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Billing Address</h2>
            <label class="flex items-center gap-3 cursor-pointer mb-4">
              <input type="checkbox" [(ngModel)]="billingSameAsShipping" class="rounded border-gray-300 text-yellow-400 focus:ring-yellow-400" />
              <span class="text-sm text-gray-700">Same as shipping address</span>
            </label>
            @if (!billingSameAsShipping) {
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Billing Name *</label>
                  <input type="text" [(ngModel)]="billingName" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Full name" />
                </div>
                <div>
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Street Address *</label>
                  <input type="text" [(ngModel)]="billingStreet" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Street / barangay" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">City *</label>
                    <input type="text" [(ngModel)]="billingCity" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="City / municipality" />
                  </div>
                  <div>
                    <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">ZIP</label>
                    <input type="text" [(ngModel)]="billingZip" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="ZIP code" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Country</label>
                  <input type="text" [(ngModel)]="billingCountry" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Philippines" />
                </div>
              </div>
            }
          </div>

          <div class="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t border-gray-200 md:border-0 px-4 pt-3 pb-4 md:px-0 md:pt-0 md:pb-0 space-y-2 z-20">
            <div class="flex items-center justify-between">
              <button (click)="activeStep = 1" class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700">← Back</button>
              <button (click)="saveDeliveryAndNext()" [disabled]="savingDelivery || !deliveryName.trim() || !deliveryStreet.trim() || !deliveryCity.trim() || !deliveryZip.trim() || !deliveryPhone.trim() || (!billingSameAsShipping && (!billingName.trim() || !billingStreet.trim() || !billingCity.trim()))"
                class="rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm px-6 py-2.5 transition-colors uppercase tracking-wide">
                @if (savingDelivery) { Saving… } @else { Next: Review }
              </button>
            </div>
            <div class="text-center">
              <button (click)="saveDraftReminder()" [disabled]="sendingReminder"
                class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline">
                @if (sendingReminder) { Sending… } @else { Save draft & email me a link }
              </button>
              @if (reminderSent) {
                <p class="text-xs text-green-600 mt-1">✓ Link sent to {{ order.customer_email }}</p>
              }
            </div>
            <p class="text-center text-xs text-gray-400">Need help? <a href="mailto:{{ SUPPORT_EMAIL }}" class="underline hover:text-gray-600">{{ SUPPORT_EMAIL }}</a></p>
          </div>
        }

        <!-- ─── Step 3: Review & Place ─── -->
        @if (activeStep === 3) {
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Review Your Order</h2>

            <!-- Items summary -->
            <table class="w-full text-sm mb-4">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="text-left py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Colour</th>
                  <th class="text-right py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Qty</th>
                  <th class="text-right py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Price</th>
                </tr>
              </thead>
              <tbody>
                @for (item of orderedItems; track item.id) {
                  <tr class="border-b border-gray-50">
                    <td class="py-1.5 text-gray-700">{{ item.color?.label }}</td>
                    <td class="py-1.5 text-right text-gray-700">{{ item.quantity }}</td>
                    <td class="py-1.5 text-right text-gray-700">₱{{ (item.quantity / 10 * PRICE_PER_10) | number:'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="font-bold">
                  <td class="pt-2 text-gray-900">Total</td>
                  <td class="pt-2 text-right text-gray-900">{{ totalQtyFromOrder }} pcs</td>
                  <td class="pt-2 text-right text-gray-900">₱{{ subtotalFromOrder | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>

            <!-- Delivery summary -->
            <div class="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-0.5">
              <p class="font-bold text-gray-700 mb-1">Delivery to:</p>
              <p>{{ order.event?.wristbandSettings?.delivery_name }}</p>
              <p>{{ order.event?.wristbandSettings?.delivery_street }}</p>
              <p>{{ joinTruthy([order.event?.wristbandSettings?.delivery_city, order.event?.wristbandSettings?.delivery_country, order.event?.wristbandSettings?.delivery_zip]) }}</p>
              @if (order.event?.wristbandSettings?.delivery_phone) { <p>{{ order.event?.wristbandSettings?.delivery_phone }}</p> }
              @if (order.notes) { <p class="mt-1 italic text-gray-400">{{ order.notes }}</p> }
            </div>

            <!-- Billing summary -->
            <div class="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-0.5">
              <p class="font-bold text-gray-700 mb-1">Billing address:</p>
              @if (order.billing_same_as_shipping !== false) {
                <p class="italic text-gray-400">Same as shipping address</p>
              } @else {
                @if (order.billing_name) { <p>{{ order.billing_name }}</p> }
                @if (order.billing_street) { <p>{{ order.billing_street }}</p> }
                <p>{{ joinTruthy([order.billing_city, order.billing_country, order.billing_zip]) }}</p>
              }
            </div>

            <!-- Design preview -->
            @if (order.design_url) {
              <div class="mb-4">
                <p class="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Design</p>
                <img [src]="designProxyUrl" alt="Wristband design" class="block w-full rounded-lg border border-gray-200 max-h-48 object-contain bg-gray-50" />
              </div>
            } @else {
              <div class="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4 text-xs text-red-800">
                <span class="shrink-0 mt-0.5">⚠</span>
                <span><strong>No design has been uploaded.</strong> Your wristbands will be printed without artwork. <button type="button" (click)="activeStep = 1" class="underline font-semibold">Go back to add one.</button></span>
              </div>
            }

            <!-- Disclaimer -->
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" [(ngModel)]="disclaimerAcknowledged" class="mt-0.5 rounded border-gray-300 text-yellow-400 focus:ring-yellow-400 shrink-0" />
              <span class="text-xs text-gray-600 leading-relaxed">
                I confirm that the order details above are correct, and I agree to the terms and conditions for wristband orders. I understand that once placed, this order will be reviewed before being confirmed.
              </span>
            </label>

            @if (placeError) {
              <p class="text-sm text-red-600 mt-3">{{ placeError }}</p>
            }
          </div>

          <!-- Save draft reminder + Place order (sticky on mobile) -->
          <div class="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t border-gray-200 md:border-0 px-4 pt-3 pb-4 md:px-0 md:pt-0 md:pb-0 z-20 space-y-2">
            <button (click)="placeOrder()" [disabled]="placingOrder || !disclaimerAcknowledged"
              class="w-full rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm py-3 transition-colors uppercase tracking-wide">
              @if (placingOrder) { Placing Order… } @else { Place Order }
            </button>
            <div class="flex items-center justify-between">
              <button (click)="activeStep = 2" class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700">← Back</button>
              <button (click)="saveDraftReminder()" [disabled]="sendingReminder"
                class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline">
                @if (sendingReminder) { Sending… } @else { Save & Email me a link }
              </button>
            </div>
            @if (reminderSent) {
              <p class="text-center text-xs text-green-600">✓ Link sent to {{ order.customer_email }}</p>
            }
            <p class="text-center text-xs text-gray-400">Need help? <a href="mailto:{{ SUPPORT_EMAIL }}" class="underline hover:text-gray-600">{{ SUPPORT_EMAIL }}</a></p>
          </div>
        }

      }

      <!-- ═══ PAYMENT (confirmed, not paid) ═══ -->
      @if (order.status === 'confirmed' && order.payment_status !== 'paid') {
        <div class="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Payment</h2>

          <!-- Order total -->
          <div class="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
            <div class="flex justify-between mb-1">
              <span class="text-gray-500">Wristbands ({{ totalQtyFromOrder }} pcs)</span>
              <span class="text-gray-900">₱{{ subtotalFromOrder | number:'1.2-2' }}</span>
            </div>
            @if (order.shipping_fee && +order.shipping_fee > 0) {
              <div class="flex justify-between mb-1">
                <span class="text-gray-500">Shipping fee</span>
                <span class="text-gray-900">₱{{ +order.shipping_fee | number:'1.2-2' }}</span>
              </div>
            }
            @if (order.discount && +order.discount > 0) {
              <div class="flex justify-between mb-1">
                <span class="text-gray-500">Discount</span>
                <span class="text-green-600">−₱{{ +order.discount | number:'1.2-2' }}</span>
              </div>
            }
            <div class="flex justify-between font-bold border-t border-gray-200 pt-2 mt-1">
              <span class="text-gray-900">Total due</span>
              <span class="text-gray-900">₱{{ totalDue | number:'1.2-2' }}</span>
            </div>
          </div>

          @if (paymentError) {
            <p class="text-sm text-red-600 mb-3">{{ paymentError }}</p>
          }

          <button (click)="initiatePayment()" [disabled]="initiatingPayment"
            class="w-full rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm py-3 transition-colors uppercase tracking-wide">
            @if (initiatingPayment) { Redirecting… } @else { Pay via Paymongo }
          </button>

          <div class="mt-4 text-center">
            <button (click)="downloadInvoice()" [disabled]="downloadingInvoice"
              class="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline disabled:opacity-50">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              @if (downloadingInvoice) { Downloading… } @else { Download Invoice PDF }
            </button>
          </div>
        </div>
      }

      <!-- ═══ READ-ONLY order summary (placed / shipped / paid) ═══ -->
      @if (order.status === 'placed' || order.status === 'shipped' || order.payment_status === 'paid') {
        <div class="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Order Summary</h2>
          <table class="w-full text-sm mb-4">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="text-left py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Colour</th>
                <th class="text-right py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Qty</th>
                <th class="text-right py-1.5 text-xs font-mono uppercase tracking-widest text-gray-400">Price</th>
              </tr>
            </thead>
            <tbody>
              @for (item of orderedItems; track item.id) {
                <tr class="border-b border-gray-50">
                  <td class="py-1.5 text-gray-700">{{ item.color?.label }}</td>
                  <td class="py-1.5 text-right text-gray-700">{{ item.quantity }}</td>
                  <td class="py-1.5 text-right text-gray-700">₱{{ (item.quantity / 10 * PRICE_PER_10) | number:'1.2-2' }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="font-bold">
                <td class="pt-2 text-gray-900">Total</td>
                <td class="pt-2 text-right text-gray-900">{{ totalQtyFromOrder }} pcs</td>
                <td class="pt-2 text-right text-gray-900">₱{{ subtotalFromOrder | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
          <div class="grid gap-3"
            [class.md:grid-cols-2]="order.event?.wristbandSettings?.delivery_name || order.event?.wristbandSettings?.delivery_street">
            @if (order.event?.wristbandSettings?.delivery_name || order.event?.wristbandSettings?.delivery_street) {
              <div class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-0.5">
                <p class="font-bold text-gray-700 mb-1">Delivery address:</p>
                @if (order.event?.wristbandSettings?.delivery_name) { <p>{{ order.event?.wristbandSettings?.delivery_name }}</p> }
                @if (order.event?.wristbandSettings?.delivery_street) { <p>{{ order.event?.wristbandSettings?.delivery_street }}</p> }
                <p>{{ joinTruthy([order.event?.wristbandSettings?.delivery_city, order.event?.wristbandSettings?.delivery_country, order.event?.wristbandSettings?.delivery_zip]) }}</p>
                @if (order.event?.wristbandSettings?.delivery_phone) { <p>{{ order.event?.wristbandSettings?.delivery_phone }}</p> }
              </div>
            }
            <div class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-0.5">
              <p class="font-bold text-gray-700 mb-1">Billing address:</p>
              @if (order.billing_same_as_shipping !== false) {
                <p class="italic text-gray-400">Same as delivery address</p>
              } @else {
                @if (order.billing_name) { <p>{{ order.billing_name }}</p> }
                @if (order.billing_street) { <p>{{ order.billing_street }}</p> }
                <p>{{ joinTruthy([order.billing_city, order.billing_country, order.billing_zip]) }}</p>
              }
            </div>
          </div>
          @if (order.design_url) {
            <div class="mt-4">
              <p class="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Design</p>
              <img [src]="designProxyUrl" alt="Wristband design" class="block w-full rounded-lg border border-gray-200 max-h-48 object-contain bg-gray-50" />
            </div>
          }
          @if (order.payment_status === 'paid') {
            <div class="mt-5 pt-4 border-t border-gray-100 text-center">
              <button (click)="downloadInvoice()" [disabled]="downloadingInvoice"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-mono uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-50">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                @if (downloadingInvoice) { Downloading… } @else { Download Invoice PDF }
              </button>
            </div>
          }
        </div>
      }

    }

  </div>

</div>

<!-- ═══ ORDER PLACED MODAL ═══ -->
@if (showOrderPlacedModal) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" style="background: rgba(0,0,0,0.5);">
    <div class="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center modal-card overflow-hidden">

      <!-- Confetti pieces -->
      <div class="pointer-events-none">
        @for (piece of confettiPieces; track piece.id) {
          <div class="confetti-piece"
            [style.left.px]="piece.x"
            [style.top.px]="piece.top"
            [style.background]="piece.color"
            [style.animation-delay]="piece.delay + 'ms'"
            [style.animation-duration]="piece.duration + 'ms'">
          </div>
        }
      </div>

      <!-- Check circle -->
      <div class="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
        <svg class="w-10 h-10" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#22c55e" stroke-width="2" opacity="0.3"/>
          <path class="check-path" d="M11 21l6 6 12-13" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <h2 class="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Order Placed!</h2>
      <p class="text-sm text-gray-500 leading-relaxed mb-6">
        Your wristband order has been submitted successfully. We'll review it and email you once it's confirmed or if we need anything.
      </p>
      <p class="text-xs text-gray-400 mb-6">Order #{{ order?.id }}</p>

      <button (click)="closeOrderPlacedModal()"
        class="w-full rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-sm py-3 transition-colors uppercase tracking-wide">
        Got it!
      </button>
    </div>
  </div>
}

<!-- ═══ PAYMENT SUCCESS MODAL ═══ -->
@if (showPaymentSuccessModal) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" style="background: rgba(0,0,0,0.5);">
    <div class="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center modal-card overflow-hidden">

      <!-- Confetti pieces -->
      <div class="pointer-events-none">
        @for (piece of confettiPieces; track piece.id) {
          <div class="confetti-piece"
            [style.left.px]="piece.x"
            [style.top.px]="piece.top"
            [style.background]="piece.color"
            [style.animation-delay]="piece.delay + 'ms'"
            [style.animation-duration]="piece.duration + 'ms'">
          </div>
        }
      </div>

      <!-- Check circle -->
      <div class="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
        <svg class="w-10 h-10" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#22c55e" stroke-width="2" opacity="0.3"/>
          <path class="check-path" d="M11 21l6 6 12-13" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <h2 class="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Payment Received!</h2>
      <p class="text-sm text-gray-500 leading-relaxed mb-6">
        Your payment has been confirmed. We'll start printing your wristbands and notify you once they've been shipped.
      </p>
      @if (order) {
        <p class="text-xs text-gray-400 mb-6">Order #{{ order.id }}</p>
      }

      <button (click)="closePaymentSuccessModal()"
        class="w-full rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-sm py-3 transition-colors uppercase tracking-wide">
        Got it!
      </button>
    </div>
  </div>
}
  `,
})
export class PublicWristbandOrderComponent implements OnInit, OnDestroy {
  readonly PRICE_PER_10 = PRICE_PER_10;
  readonly SUPPORT_EMAIL = SUPPORT_EMAIL;

  @ViewChild(WristbandDesignEditorComponent) editorRef?: WristbandDesignEditorComponent;

  joinTruthy(parts: (string | null | undefined)[], sep = ', '): string {
    return parts.filter(v => !!v).join(sep);
  }

  token = '';
  order: PublicWristbandOrder | null = null;
  loadingOrder = true;
  orderNotFound = false;

  // Colors
  colorRows: ColorRow[] = [];
  loadingColors = false;

  // Wizard
  activeStep = 1;
  steps = [
    { id: 1, label: 'Colours & Design' },
    { id: 2, label: 'Delivery' },
    { id: 3, label: 'Review' },
  ];

  // Step 1
  savingItems = false;

  // Step 2
  deliveryName = '';
  deliveryStreet = '';
  deliveryCity = '';
  deliveryCountry = 'Philippines';
  deliveryZip = '';
  deliveryPhone = '';
  notes = '';
  billingSameAsShipping = true;
  billingName = '';
  billingStreet = '';
  billingCity = '';
  billingCountry = 'Philippines';
  billingZip = '';
  savingDelivery = false;

  // Step 3
  disclaimerAcknowledged = false;
  placingOrder = false;
  placeError = '';

  // Save reminder
  sendingReminder = false;
  reminderSent = false;

  // Payment
  initiatingPayment = false;
  paymentError = '';
  paymentStatus: string | null = null;

  // Invoice download
  downloadingInvoice = false;

  // Order placed modal
  showOrderPlacedModal = false;
  // Payment success modal
  showPaymentSuccessModal = false;
  confettiPieces: { id: number; x: number; top: number; color: string; delay: number; duration: number }[] = [];

  constructor(private route: ActivatedRoute, private svc: PublicWristbandService) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.paymentStatus = this.route.snapshot.queryParamMap.get('payment_status');
    this.loadOrder();
  }

  loadOrder(): void {
    this.loadingOrder = true;
    this.svc.getOrder(this.token).subscribe({
      next: (order) => {
        this.loadingOrder = false;
        this.order = order;
        this.prefillDelivery(order);
        this.disclaimerAcknowledged = order.disclaimer_acknowledged;
        if (this.paymentStatus === 'success') {
          this.openPaymentSuccessModal();
        }
        if (order.status === 'draft' || order.status === 'rejected') {
          this.loadColors();
          if (order.design_url) {
            this.loadExistingDesign(order);
          }
        }
      },
      error: () => { this.loadingOrder = false; this.orderNotFound = true; },
    });
  }

  private loadExistingDesign(order: PublicWristbandOrder): void {
    const savedCanvasW = (order as any).canvas_width;
    const dx = (order as any).design_x;
    const dy = (order as any).design_y;
    const dw = (order as any).design_width;
    const dh = (order as any).design_height;
    const savedPos = (savedCanvasW && dw != null)
      ? { x: dx, y: dy, width: dw, height: dh, canvasWidth: savedCanvasW }
      : undefined;
    setTimeout(() => {
      this.editorRef?.loadFromUrl(this.designProxyUrl, savedPos);
    }, 0);
  }

  loadColors(): void {
    this.loadingColors = true;
    this.svc.getColors().subscribe({
      next: (colors) => {
        this.loadingColors = false;
        this.colorRows = colors.map(c => {
          const existing = this.order?.items?.find(i => i.wristband_color_id === c.id);
          return { ...c, quantity: existing?.quantity ?? 0 };
        });
      },
      error: () => { this.loadingColors = false; },
    });
  }

  prefillDelivery(order: PublicWristbandOrder): void {
    const s = order.event?.wristbandSettings;
    this.deliveryName = s?.delivery_name ?? '';
    this.deliveryStreet = s?.delivery_street ?? '';
    this.deliveryCity = s?.delivery_city ?? '';
    this.deliveryCountry = s?.delivery_country ?? 'Philippines';
    this.deliveryZip = s?.delivery_zip ?? '';
    this.deliveryPhone = s?.delivery_phone ?? '';
    this.notes = order.notes ?? '';
    this.billingSameAsShipping = order.billing_same_as_shipping !== false;
    this.billingName = order.billing_name ?? '';
    this.billingStreet = order.billing_street ?? '';
    this.billingCity = order.billing_city ?? '';
    this.billingCountry = order.billing_country ?? 'Philippines';
    this.billingZip = order.billing_zip ?? '';
  }

  get totalQty(): number {
    return this.colorRows.reduce((s, r) => s + r.quantity, 0);
  }

  get subtotal(): number {
    return (this.totalQty / 10) * PRICE_PER_10;
  }

  get orderedItems() {
    return (this.order?.items ?? []).filter(i => i.quantity > 0);
  }

  get totalQtyFromOrder(): number {
    return this.orderedItems.reduce((s, i) => s + i.quantity, 0);
  }

  get subtotalFromOrder(): number {
    return (this.totalQtyFromOrder / 10) * PRICE_PER_10;
  }

  get totalDue(): number {
    if (!this.order) return 0;
    const shipping = this.order.shipping_fee ? +this.order.shipping_fee : 0;
    const discount = this.order.discount ? +this.order.discount : 0;
    return Math.max(0, this.subtotalFromOrder + shipping - discount);
  }

  get designProxyUrl(): string {
    const base = this.svc.getDesignUrl(this.token);
    // Cache-bust whenever the design_url changes so the browser refetches after an upload
    const bust = this.order?.design_url ? encodeURIComponent(this.order.design_url.split('/').pop() ?? '') : Date.now();
    return `${base}?v=${bust}`;
  }

  adjustQty(row: ColorRow, delta: number): void {
    row.quantity = Math.max(0, row.quantity + delta);
  }

  goToStep(step: number): void {
    if (step < this.activeStep) this.activeStep = step;
  }

  saveAndNext(): void {
    if (this.totalQty === 0) return;
    this.savingItems = true;
    const items = this.colorRows
      .filter(r => r.quantity > 0)
      .map(r => ({ wristband_color_id: r.id, quantity: r.quantity }));

    const payload: any = { items };
    const editorDataUrl = this.editorRef?.designDataUrl;

    if (editorDataUrl && this.editorRef) {
      const pos = this.editorRef.designPos;
      payload.design_x      = pos.x;
      payload.design_y      = pos.y;
      payload.design_width  = pos.width;
      payload.design_height = pos.height;
      payload.canvas_width  = this.editorRef.getCanvasWidth();
    }

    // Send the processed dataUrl as a blob (background already removed)
    const sendDesign = (): Promise<File | undefined> => {
      if (!editorDataUrl) return Promise.resolve(undefined);
      return fetch(editorDataUrl).then(r => r.blob()).then(blob => new File([blob], 'design.png', { type: 'image/png' }));
    };

    sendDesign().then(file => {
      this.svc.updateOrder(this.token, payload, file).subscribe({
        next: (order) => {
          this.savingItems = false;
          this.order = order;
          this.activeStep = 2;
        },
        error: () => { this.savingItems = false; },
      });
    });
  }

  saveDeliveryAndNext(): void {
    if (!this.deliveryName.trim() || !this.deliveryStreet.trim() || !this.deliveryCity.trim()) return;
    if (!this.billingSameAsShipping && (!this.billingName.trim() || !this.billingStreet.trim() || !this.billingCity.trim())) return;
    this.savingDelivery = true;
    this.svc.updateOrder(this.token, {
      delivery_name: this.deliveryName,
      delivery_street: this.deliveryStreet,
      delivery_city: this.deliveryCity,
      delivery_country: this.deliveryCountry,
      delivery_zip: this.deliveryZip,
      delivery_phone: this.deliveryPhone,
      notes: this.notes,
      billing_same_as_shipping: this.billingSameAsShipping,
      billing_name: this.billingSameAsShipping ? null : this.billingName,
      billing_street: this.billingSameAsShipping ? null : this.billingStreet,
      billing_city: this.billingSameAsShipping ? null : this.billingCity,
      billing_country: this.billingSameAsShipping ? null : this.billingCountry,
      billing_zip: this.billingSameAsShipping ? null : this.billingZip,
    }).subscribe({
      next: (order) => {
        this.savingDelivery = false;
        this.order = order;
        this.activeStep = 3;
      },
      error: () => { this.savingDelivery = false; },
    });
  }

  ngOnDestroy(): void {}

  get colorsForEditor(): WristbandColorOption[] {
    return this.colorRows.map(r => ({ id: r.id, slug: r.slug, label: r.label, bg_color: r.bg_color }));
  }

  placeOrder(): void {
    if (!this.disclaimerAcknowledged) return;
    // Save disclaimer first, then place
    this.placingOrder = true;
    this.placeError = '';
    this.svc.updateOrder(this.token, { disclaimer_acknowledged: true }).subscribe({
      next: () => {
        this.svc.placeOrder(this.token).subscribe({
          next: (order) => {
            this.placingOrder = false;
            this.order = order;
            this.openOrderPlacedModal();
          },
          error: (err) => {
            this.placingOrder = false;
            this.placeError = err?.error?.error ?? 'Failed to place order. Please try again.';
          },
        });
      },
      error: () => {
        this.placingOrder = false;
        this.placeError = 'Failed to save order. Please try again.';
      },
    });
  }

  saveDraftReminder(): void {
    this.sendingReminder = true;
    this.reminderSent = false;

    const save$ = this.activeStep === 1 ? this.buildStep1Save() : this.buildStep2Save();

    save$.subscribe({
      next: (order) => {
        if (order) this.order = order;
        this.svc.sendReminder(this.token).subscribe({
          next: () => { this.sendingReminder = false; this.reminderSent = true; },
          error: () => { this.sendingReminder = false; this.reminderSent = true; },
        });
      },
      error: () => {
        // Save failed — still attempt reminder
        this.svc.sendReminder(this.token).subscribe({
          next: () => { this.sendingReminder = false; this.reminderSent = true; },
          error: () => { this.sendingReminder = false; this.reminderSent = true; },
        });
      },
    });
  }

  private buildStep1Save() {
    const items = this.colorRows
      .filter(r => r.quantity > 0)
      .map(r => ({ wristband_color_id: r.id, quantity: r.quantity }));

    const payload: any = { items };
    const editorDataUrl = this.editorRef?.designDataUrl;

    if (editorDataUrl && this.editorRef) {
      const pos = this.editorRef.designPos;
      payload.design_x      = pos.x;
      payload.design_y      = pos.y;
      payload.design_width  = pos.width;
      payload.design_height = pos.height;
      payload.canvas_width  = this.editorRef.getCanvasWidth();
    }

    const sendDesign = (): Promise<File | undefined> => {
      if (!editorDataUrl) return Promise.resolve(undefined);
      return fetch(editorDataUrl).then(r => r.blob()).then(blob => new File([blob], 'design.png', { type: 'image/png' }));
    };

    return new Observable<any>(observer => {
      sendDesign().then(file => {
        this.svc.updateOrder(this.token, payload, file).subscribe({
          next: (order) => { observer.next(order); observer.complete(); },
          error: (err) => { observer.error(err); },
        });
      }).catch(err => observer.error(err));
    });
  }

  private buildStep2Save() {
    return this.svc.updateOrder(this.token, {
      delivery_name:   this.deliveryName,
      delivery_street: this.deliveryStreet,
      delivery_city:   this.deliveryCity,
      delivery_country: this.deliveryCountry,
      delivery_zip:    this.deliveryZip,
      delivery_phone:  this.deliveryPhone,
      notes:           this.notes,
      billing_same_as_shipping: this.billingSameAsShipping,
      billing_name:    this.billingSameAsShipping ? null : this.billingName,
      billing_street:  this.billingSameAsShipping ? null : this.billingStreet,
      billing_city:    this.billingSameAsShipping ? null : this.billingCity,
      billing_country: this.billingSameAsShipping ? null : this.billingCountry,
      billing_zip:     this.billingSameAsShipping ? null : this.billingZip,
    });
  }

  initiatePayment(): void {
    this.initiatingPayment = true;
    this.paymentError = '';
    this.svc.initiatePayment(this.token).subscribe({
      next: ({ checkout_url }) => {
        window.location.href = checkout_url;
      },
      error: (err) => {
        this.initiatingPayment = false;
        this.paymentError = err?.error?.error ?? 'Failed to start payment. Please try again.';
      },
    });
  }

  openOrderPlacedModal(): void {
    const colors = ['#FACC15', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C'];
    this.confettiPieces = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 300,
      top: -10,
      color: colors[i % colors.length],
      delay: Math.random() * 400,
      duration: 800 + Math.random() * 600,
    }));
    this.showOrderPlacedModal = true;
  }

  closeOrderPlacedModal(): void {
    this.showOrderPlacedModal = false;
  }

  openPaymentSuccessModal(): void {
    const colors = ['#FACC15', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C'];
    this.confettiPieces = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 300,
      top: -10,
      color: colors[i % colors.length],
      delay: Math.random() * 400,
      duration: 800 + Math.random() * 600,
    }));
    this.showPaymentSuccessModal = true;
  }

  closePaymentSuccessModal(): void {
    this.showPaymentSuccessModal = false;
  }

  downloadInvoice(): void {
    if (this.downloadingInvoice) return;
    this.downloadingInvoice = true;
    this.svc.downloadInvoice(this.token).subscribe({
      next: (blob) => {
        this.downloadingInvoice = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-order-${this.order?.id ?? this.token}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingInvoice = false;
      },
    });
  }
}
