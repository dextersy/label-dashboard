import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PublicWristbandService, PublicWristbandOrder } from '../../services/public-wristband.service';
import { WristbandColor } from '../../models/wristband.model';

interface DesignPos { x: number; y: number; width: number; height: number; }

const PRICE_PER_10 = 45;

interface ColorRow extends WristbandColor {
  quantity: number;
}

@Component({
  selector: 'app-public-wristband-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="min-h-screen bg-gray-50 px-4 py-8">
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
        <div class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-800">
          <span class="shrink-0">✕</span>
          Your order was rejected. Please update your order and re-submit.
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
        <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
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

        <!-- ─── Step 1: Colours & Design ─── -->
        @if (activeStep === 1) {
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Wristband Colours & Quantities</h2>

            @if (loadingColors) {
              <p class="text-xs text-gray-400 text-center py-4">Loading colours…</p>
            } @else {
              <div class="tw-space-y-3">
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
              }
            }

            <!-- Design upload -->
            <div class="mt-6 pt-5 border-t border-gray-100">
              <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-1">Wristband Design</h2>
              <p class="text-xs text-gray-400 mb-3">Upload a PNG file of your wristband artwork. Max 10 MB.</p>

              @if (designProcessing) {
                <p class="text-xs text-gray-400 mt-2">Processing image…</p>
              }

              @if (designError) {
                <p class="text-xs text-red-500 mt-2">{{ designError }}</p>
              }

              @if (designIsImage && designDataUrl) {
                <div class="mt-3">
                  <!-- Color preview selector -->
                  @if (hasColoredRows) {
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs font-mono text-gray-400">Preview color:</span>
                      @for (row of colorRows; track row.id) {
                        @if (row.quantity > 0) {
                          <button type="button" (click)="previewColorId = row.id"
                            class="w-6 h-6 rounded-full border-2 transition-all"
                            [style.background]="row.bg_color"
                            [class.border-gray-900]="previewColor?.id === row.id"
                            [class.border-transparent]="previewColor?.id !== row.id">
                          </button>
                        }
                      }
                    </div>
                  }

                  <!-- Canvas editor -->
                  <div class="relative select-none overflow-hidden border border-gray-200"
                    #previewContainer
                    [style.background]="previewColor?.bg_color || '#F535B2'"
                    [style.aspect-ratio]="'1 / 0.107'">

                    <div class="absolute inset-0">
                      <div class="absolute border border-dashed border-black/20"
                        [style.left.%]="tmplL * 100"
                        [style.top.%]="tmplT * 100"
                        [style.width.%]="tmplW * 100"
                        [style.height.%]="tmplH * 100">
                      </div>
                    </div>

                    <div class="absolute"
                      [style.left.px]="designPos.x"
                      [style.top.px]="designPos.y"
                      [style.width.px]="designPos.width"
                      [style.height.px]="designPos.height"
                      [style.cursor]="isDragging ? 'grabbing' : 'grab'"
                      (mousedown)="startDrag($event)"
                      (touchstart)="startDragTouch($event)">
                      <img [src]="designDataUrl" class="w-full h-full object-contain pointer-events-none" style="mix-blend-mode:multiply">
                      @for (handle of resizeHandles; track handle) {
                        <div class="absolute w-3 h-3 bg-white border border-gray-400 rounded-sm"
                          [class]="resizeHandleClass(handle)"
                          (mousedown)="startResize($event, handle)"
                          (touchstart)="startResizeTouch($event, handle)">
                        </div>
                      }
                    </div>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">Drag to reposition · corner handles to resize proportionally</p>
                </div>
              }

              <label class="block w-full cursor-pointer rounded-lg border-2 border-dashed border-gray-300 hover:border-yellow-400 transition-colors px-6 py-5 text-center mt-3">
                <input type="file" accept="image/png" (change)="onDesignFileChange($event)" class="hidden" />
                @if (designFile) {
                  <p class="text-sm text-gray-700 font-medium">{{ designFile.name }}</p>
                  <p class="text-xs text-gray-400 mt-1">Click to change</p>
                } @else if (order.design_url) {
                  <p class="text-sm text-gray-400">Click to replace design</p>
                } @else {
                  <p class="text-sm text-gray-400">Click to upload a PNG file</p>
                }
              </label>
            </div>
          </div>

          <div class="flex justify-end">
            <button (click)="saveAndNext()" [disabled]="savingItems || totalQty === 0"
              class="rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm px-6 py-2.5 transition-colors uppercase tracking-wide">
              @if (savingItems) { Saving… } @else { Next: Delivery }
            </button>
          </div>
        }

        <!-- ─── Step 2: Delivery Address ─── -->
        @if (activeStep === 2) {
          <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-gray-700 mb-4">Delivery Address</h2>
            <div class="tw-space-y-3">
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
                  <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">ZIP</label>
                  <input type="text" [(ngModel)]="deliveryZip" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="ZIP code" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Country</label>
                <input type="text" [(ngModel)]="deliveryCountry" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="Philippines" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Phone Number</label>
                <input type="tel" [(ngModel)]="deliveryPhone" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent" placeholder="+63 9XX XXX XXXX" />
              </div>
              <div>
                <label class="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Notes (optional)</label>
                <textarea [(ngModel)]="notes" rows="2" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none" placeholder="Any special instructions…"></textarea>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <button (click)="activeStep = 1" class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700">← Back</button>
            <button (click)="saveDeliveryAndNext()" [disabled]="savingDelivery || !deliveryName.trim() || !deliveryStreet.trim() || !deliveryCity.trim()"
              class="rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm px-6 py-2.5 transition-colors uppercase tracking-wide">
              @if (savingDelivery) { Saving… } @else { Next: Review }
            </button>
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

            <!-- Design preview -->
            @if (order.design_url) {
              <div class="mb-4">
                <p class="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Design</p>
                <img [src]="designProxyUrl" alt="Wristband design" class="block w-full rounded-lg border border-gray-200 max-h-48 object-contain bg-gray-50" />
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

          <!-- Save draft reminder -->
          <div class="flex items-center justify-between mb-4">
            <button (click)="activeStep = 2" class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700">← Back</button>
            <button (click)="saveDraftReminder()" [disabled]="sendingReminder"
              class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline">
              @if (sendingReminder) { Sending… } @else { Save & Email me a link }
            </button>
          </div>

          <button (click)="placeOrder()" [disabled]="placingOrder || !disclaimerAcknowledged"
            class="w-full rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm py-3 transition-colors uppercase tracking-wide">
            @if (placingOrder) { Placing Order… } @else { Place Order }
          </button>
        }

        <!-- Save draft link (steps 1-2) -->
        @if (activeStep < 3) {
          <div class="mt-4 text-center">
            <button (click)="saveDraftReminder()" [disabled]="sendingReminder"
              class="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-gray-700 underline">
              @if (sendingReminder) { Sending… } @else { Save draft & email me a link }
            </button>
            @if (reminderSent) {
              <p class="text-xs text-green-600 mt-1">✓ Link sent to {{ order.customer_email }}</p>
            }
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
          @if (order.event?.wristbandSettings?.delivery_name || order.event?.wristbandSettings?.delivery_street) {
            <div class="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-0.5">
              <p class="font-bold text-gray-700 mb-1">Delivery address:</p>
              @if (order.event?.wristbandSettings?.delivery_name) { <p>{{ order.event?.wristbandSettings?.delivery_name }}</p> }
              @if (order.event?.wristbandSettings?.delivery_street) { <p>{{ order.event?.wristbandSettings?.delivery_street }}</p> }
              <p>{{ joinTruthy([order.event?.wristbandSettings?.delivery_city, order.event?.wristbandSettings?.delivery_country, order.event?.wristbandSettings?.delivery_zip]) }}</p>
              @if (order.event?.wristbandSettings?.delivery_phone) { <p>{{ order.event?.wristbandSettings?.delivery_phone }}</p> }
            </div>
          }
          @if (order.design_url) {
            <div class="mt-4">
              <p class="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Design</p>
              <img [src]="designProxyUrl" alt="Wristband design" class="block w-full rounded-lg border border-gray-200 max-h-48 object-contain bg-gray-50" />
            </div>
          }
        </div>
      }

    }

  </div>
</div>
  `,
})
export class PublicWristbandOrderComponent implements OnInit, OnDestroy {
  readonly PRICE_PER_10 = PRICE_PER_10;

  // Canvas layout constants (must mirror wristband-order-review)
  readonly tmplL = 0.05;
  readonly tmplT = 0.18;
  readonly tmplW = 0.90;
  readonly tmplH = 0.64;
  private readonly BAND_L = 0.13;
  private readonly BAND_R = 0.99;
  private readonly BAND_T = 0.28;
  private readonly BAND_B = 0.72;
  private readonly MIN_SIZE = 10;

  @ViewChild('previewContainer') previewContainer!: ElementRef;

  joinTruthy(parts: (string | null | undefined)[], sep = ', '): string {
    return parts.filter(v => !!v).join(sep);
  }

  token = '';
  order: PublicWristbandOrder | null = null;
  loadingOrder = true;

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
  designFile: File | null = null;
  designDataUrl: string | null = null;
  designIsImage = false;
  designProcessing = false;
  designError = '';
  previewColorId: number | null = null;

  // Design canvas positioning
  designPos: DesignPos = { x: 60, y: 20, width: 240, height: 80 };
  private _dragging = false;
  private _resizing = false;
  private _resizeHandle = '';
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _startPos: DesignPos = { x: 0, y: 0, width: 0, height: 0 };

  get isDragging(): boolean { return this._dragging || this._resizing; }

  readonly resizeHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  resizeHandleClass(handle: string): string {
    const map: Record<string, string> = {
      nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize',
      n:  'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-n-resize',
      ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize',
      e:  'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-e-resize',
      se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize',
      s:  'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize',
      sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize',
      w:  'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-w-resize',
    };
    return map[handle] ?? '';
  }


  // Step 2
  deliveryName = '';
  deliveryStreet = '';
  deliveryCity = '';
  deliveryCountry = 'Philippines';
  deliveryZip = '';
  deliveryPhone = '';
  notes = '';
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
        if (order.status === 'draft' || order.status === 'rejected') {
          this.loadColors();
          if (order.design_url) {
            this.loadExistingDesign(order);
          }
        }
      },
      error: () => { this.loadingOrder = false; },
    });
  }

  private loadExistingDesign(order: PublicWristbandOrder): void {
    this.designIsImage = true;
    this.designProcessing = true;
    fetch(this.designProxyUrl)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch design'); return r.blob(); })
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => this.processDesignImage(dataUrl))
      .then(processed => {
        this.designDataUrl = processed;
        this.designProcessing = false;
        // Restore saved position, scaled from canvas_width to current preview width
        const savedCanvasW = (order as any).canvas_width;
        const dx = (order as any).design_x;
        const dy = (order as any).design_y;
        const dw = (order as any).design_width;
        const dh = (order as any).design_height;
        if (savedCanvasW && dw != null) {
          const b = this.getPreviewBounds();
          const scale = b.width / savedCanvasW;
          this.designPos = {
            x:      Math.round(dx * scale),
            y:      Math.round(dy * scale),
            width:  Math.round(dw * scale),
            height: Math.round(dh * scale),
          };
        } else {
          this.resetDesignPos();
        }
      })
      .catch(() => {
        this.designIsImage = false;
        this.designProcessing = false;
      });
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

    if (this.designIsImage && this.designDataUrl) {
      const b = this.getPreviewBounds();
      payload.design_x      = this.designPos.x;
      payload.design_y      = this.designPos.y;
      payload.design_width  = this.designPos.width;
      payload.design_height = this.designPos.height;
      payload.canvas_width  = b.width;
    }

    // Send the processed dataUrl as a blob (background already removed)
    const sendDesign = (): Promise<File | undefined> => {
      if (!this.designIsImage || !this.designDataUrl) return Promise.resolve(undefined);
      return fetch(this.designDataUrl).then(r => r.blob()).then(blob => new File([blob], 'design.png', { type: 'image/png' }));
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
    this.savingDelivery = true;
    this.svc.updateOrder(this.token, {
      delivery_name: this.deliveryName,
      delivery_street: this.deliveryStreet,
      delivery_city: this.deliveryCity,
      delivery_country: this.deliveryCountry,
      delivery_zip: this.deliveryZip,
      delivery_phone: this.deliveryPhone,
      notes: this.notes,
    }).subscribe({
      next: (order) => {
        this.savingDelivery = false;
        this.order = order;
        this.activeStep = 3;
      },
      error: () => { this.savingDelivery = false; },
    });
  }

  onDesignFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.designError = '';
    if (!file) return;
    if (file.type !== 'image/png') { this.designError = 'Only PNG files are accepted.'; input.value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { this.designError = 'File is too large. Maximum size is 10 MB.'; input.value = ''; return; }
    this.designFile = file;
    this.designIsImage = true;
    this.designProcessing = true;
    this.designDataUrl = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.processDesignImage(e.target?.result as string)
        .then(processed => {
          this.designDataUrl = processed;
          this.designProcessing = false;
          this.resetDesignPos();
        })
        .catch(err => {
          this.designFile = null;
          this.designDataUrl = null;
          this.designIsImage = false;
          this.designProcessing = false;
          this.designError = err.message;
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  private processDesignImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.naturalWidth, H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, W, H);
        const data = imageData.data;
        let hasTransparent = false, hasNonBlackOpaque = false;
        const BT = 40;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) { hasTransparent = true; }
          else if (data[i] + data[i + 1] + data[i + 2] > BT * 3) { hasNonBlackOpaque = true; }
          if (hasTransparent && hasNonBlackOpaque) break;
        }
        if (hasTransparent && !hasNonBlackOpaque) { resolve(canvas.toDataURL('image/png')); return; }
        const patchSize = Math.min(5, Math.floor(Math.min(W, H) / 4));
        const samples: [number, number, number][] = [];
        for (let py = 0; py < patchSize; py++) {
          for (let px = 0; px < patchSize; px++) {
            for (const [cx, cy] of [[px, py], [W - 1 - px, py], [px, H - 1 - py], [W - 1 - px, H - 1 - py]]) {
              const i = (cy * W + cx) * 4;
              samples.push([data[i], data[i + 1], data[i + 2]]);
            }
          }
        }
        const avg: [number, number, number] = [
          samples.reduce((s, c) => s + c[0], 0) / samples.length,
          samples.reduce((s, c) => s + c[1], 0) / samples.length,
          samples.reduce((s, c) => s + c[2], 0) / samples.length,
        ];
        const variance = samples.reduce((s, c) => s + Math.abs(c[0] - avg[0]) + Math.abs(c[1] - avg[1]) + Math.abs(c[2] - avg[2]), 0) / samples.length;
        if (variance > 80) { reject(new Error('Image not suitable: use a solid-colour background with solid black artwork.')); return; }
        const TOL = 45;
        let opaquePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const dist = Math.sqrt((data[i] - avg[0]) ** 2 + (data[i + 1] - avg[1]) ** 2 + (data[i + 2] - avg[2]) ** 2);
          if (dist <= TOL) { data[i + 3] = 0; }
          else { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; opaquePixels++; }
        }
        if (opaquePixels / (W * H) < 0.005) { reject(new Error('Image not suitable: use a solid-colour background with solid black artwork.')); return; }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Could not load the image file.'));
      img.src = dataUrl;
    });
  }

  private getPreviewBounds(): { width: number; height: number } {
    if (this.previewContainer?.nativeElement) {
      const el = this.previewContainer.nativeElement;
      return { width: el.clientWidth, height: el.clientHeight };
    }
    return { width: 600, height: 64 };
  }

  resetDesignPos(): void {
    const b = this.getPreviewBounds();
    const bandLeft   = b.width  * (this.tmplL + this.tmplW * this.BAND_L);
    const bandRight  = b.width  * (this.tmplL + this.tmplW * this.BAND_R);
    const bandTop    = b.height * (this.tmplT + this.tmplH * this.BAND_T);
    const bandBottom = b.height * (this.tmplT + this.tmplH * this.BAND_B);
    const bw = bandRight - bandLeft, bh = bandBottom - bandTop;
    this.designPos = {
      x:      Math.round(bandLeft + bw * 0.05),
      y:      Math.round(bandTop  + bh * 0.1),
      width:  Math.round(bw * 0.55),
      height: Math.round(bh * 0.8),
    };
  }

  startDrag(event: MouseEvent): void {
    if (this._resizing) return;
    this._dragging = true;
    this._dragStartX = event.clientX; this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault();
  }

  startDragTouch(event: TouchEvent): void {
    if (this._resizing) return;
    const t = event.touches[0];
    this._dragging = true;
    this._dragStartX = t.clientX; this._dragStartY = t.clientY;
    this._startPos = { ...this.designPos };
  }

  startResize(event: MouseEvent, handle: string): void {
    this._resizing = true; this._resizeHandle = handle;
    this._dragStartX = event.clientX; this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault(); event.stopPropagation();
  }

  startResizeTouch(event: TouchEvent, handle: string): void {
    const t = event.touches[0];
    this._resizing = true; this._resizeHandle = handle;
    this._dragStartX = t.clientX; this._dragStartY = t.clientY;
    this._startPos = { ...this.designPos };
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this._dragging && !this._resizing) return;
    const dx = event.clientX - this._dragStartX, dy = event.clientY - this._dragStartY;
    const b = this.getPreviewBounds();
    if (this._dragging) {
      this.designPos = { ...this.designPos,
        x: Math.max(0, Math.min(b.width  - this.designPos.width,  this._startPos.x + dx)),
        y: Math.max(0, Math.min(b.height - this.designPos.height, this._startPos.y + dy)),
      };
    }
    if (this._resizing) {
      let { x, y, width, height } = this._startPos;
      if (this._resizeHandle.length === 2) {
        const aspect = this._startPos.width / this._startPos.height;
        const pdx = this._resizeHandle.includes('e') ? dx : -dx;
        const pdy = this._resizeHandle.includes('s') ? dy : -dy;
        const delta = Math.abs(pdx) >= Math.abs(pdy) ? pdx : pdy * aspect;
        const nw = Math.max(this.MIN_SIZE, width + delta), nh = nw / aspect;
        if (this._resizeHandle.includes('w')) x = Math.max(0, x + width - nw);
        if (this._resizeHandle.includes('n')) y = Math.max(0, y + height - nh);
        width = nw; height = nh;
      } else {
        if (this._resizeHandle === 'e') width  = Math.max(this.MIN_SIZE, width  + dx);
        if (this._resizeHandle === 's') height = Math.max(this.MIN_SIZE, height + dy);
        if (this._resizeHandle === 'w') { const r = x + width; const nw = Math.max(this.MIN_SIZE, width - dx); x = Math.max(0, r - nw); width = r - x; }
        if (this._resizeHandle === 'n') { const bot = y + height; const nh = Math.max(this.MIN_SIZE, height - dy); y = Math.max(0, bot - nh); height = bot - y; }
      }
      this.designPos = { x, y, width, height };
    }
  }

  @HostListener('document:mouseup') onMouseUp(): void { this._dragging = false; this._resizing = false; }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this._dragging && !this._resizing) return;
    const t = event.touches[0];
    this.onMouseMove({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
  }

  @HostListener('document:touchend') onTouchEnd(): void { this._dragging = false; this._resizing = false; }

  ngOnDestroy(): void {}

  get hasColoredRows(): boolean {
    return this.colorRows.some(r => r.quantity > 0);
  }

  get previewColor(): ColorRow | null {
    if (this.previewColorId !== null) {
      return this.colorRows.find(r => r.id === this.previewColorId) ?? null;
    }
    return this.colorRows.find(r => r.quantity > 0) ?? null;
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

    if (this.designIsImage && this.designDataUrl) {
      const b = this.getPreviewBounds();
      payload.design_x      = this.designPos.x;
      payload.design_y      = this.designPos.y;
      payload.design_width  = this.designPos.width;
      payload.design_height = this.designPos.height;
      payload.canvas_width  = b.width;
    }

    const sendDesign = (): Promise<File | undefined> => {
      if (!this.designIsImage || !this.designDataUrl) return Promise.resolve(undefined);
      return fetch(this.designDataUrl).then(r => r.blob()).then(blob => new File([blob], 'design.png', { type: 'image/png' }));
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
}
