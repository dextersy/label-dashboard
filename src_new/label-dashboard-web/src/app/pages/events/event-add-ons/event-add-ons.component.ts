import { Component, OnInit, OnDestroy, HostListener, HostBinding, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { EventService, WristbandColor, WristbandOrder, Event as AppEvent, SavedDeliveryAddress, EventAddOnPayment } from '../../../services/event.service';
import { EventSelectionComponent } from '../components/event-selection/event-selection.component';
import { AuthService } from '../../../services/auth.service';
import { LabelFinanceService } from '../../../services/label-finance.service';

interface WristbandColorRow extends WristbandColor {
  quantity: number;
}

interface DesignPos {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-event-add-ons',
  imports: [CommonModule, FormsModule, BreadcrumbComponent, InPageNavComponent, IconComponent, EventSelectionComponent],
  templateUrl: './event-add-ons.component.html',
  styleUrl: './event-add-ons.component.scss',
  animations: [
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(110%)', opacity: 0 }),
        animate('220ms cubic-bezier(0.16, 1, 0.3, 1)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ transform: 'translateY(110%)', opacity: 0 }))
      ])
    ]),
    trigger('barContent', [
      transition('editing <=> viewing', [
        animate('300ms ease', keyframes([
          style({ opacity: 1, transform: 'translateY(0)',    offset: 0 }),
          style({ opacity: 0, transform: 'translateY(-8px)', offset: 0.35 }),
          style({ opacity: 0, transform: 'translateY(8px)',  offset: 0.55 }),
          style({ opacity: 1, transform: 'translateY(0)',    offset: 1 }),
        ]))
      ])
    ])
  ]
})
export class EventAddOnsComponent implements OnInit, OnDestroy {
  @ViewChild('previewContainer') previewContainer!: ElementRef<HTMLDivElement>;

  @HostBinding('class.has-summary-bar')
  get hasSummaryBar(): boolean {
    return !!(this.selectedEvent && this.isTab('wristbands') && this.showSummaryBar);
  }

  activeTab: string = 'wristbands';

  get tabs(): InPageNavTab[] {
    const base: InPageNavTab[] = [
      { id: 'wristbands', label: 'Wristbands', icon: 'tag' },
      { id: 'equipment-rental', label: 'Equipment Rental', icon: 'wrench' },
    ];
    if (this.hasPlacedOrConfirmedOrders) {
      base.push({ id: 'payment', label: 'Payment', icon: 'credit-card' });
    }
    return base;
  }

  wristbandColors: WristbandColorRow[] = [];
  loadingColors = true;

  readonly PRICE_PER_10 = 35;

  // Canvas layout
  private readonly TMPL_L = 0.05;
  private readonly TMPL_T = 0.18;
  private readonly TMPL_W = 0.90;
  private readonly TMPL_H = 0.64;
  private readonly BAND_L = 0.13;
  private readonly BAND_R = 0.99;
  private readonly BAND_T = 0.28;
  private readonly BAND_B = 0.72;

  // Design upload (form)
  formDesignFile: File | null = null;
  formDesignFileName = '';
  formDesignDataUrl: string | null = null;
  formDesignIsImage = false;
  formDesignProcessing = false;
  formDesignError: string | null = null;

  // Preview color (by slug)
  previewColorSlug = '';

  // Design placement (px, relative to canvas)
  designPos: DesignPos = { x: 60, y: 20, width: 240, height: 80 };

  // Interaction state
  private _dragging = false;
  private _resizing = false;
  private _resizeHandle = '';
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _startPos: DesignPos = { x: 0, y: 0, width: 0, height: 0 };
  private readonly MIN_SIZE = 20;

  // Delivery address (granular)
  deliveryName = '';
  deliveryStreet = '';
  deliveryCity = '';
  deliveryCountry = '';
  deliveryZip = '';
  deliveryPhone = '';
  savingAddress = false;
  addressSaved = false;
  editingDeliveryAddress = false;

  get isEventPast(): boolean {
    if (!this.selectedEvent) return false;
    return new Date((this.selectedEvent as any).date_and_time) < new Date();
  }

  get hasAnyPayment(): boolean {
    return this.addonTotalPaid > 0;
  }

  get canClearAddress(): boolean {
    return !this.hasAnyPayment;
  }

  get hasDeliveryAddress(): boolean {
    return !!(this.deliveryName || this.deliveryStreet || this.deliveryCity ||
              this.deliveryCountry || this.deliveryZip || this.deliveryPhone);
  }

  get deliveryCityLine(): string {
    return [this.deliveryCity, this.deliveryCountry, this.deliveryZip].filter(s => !!s).join(', ');
  }

  get deliveryAddressSummary(): string {
    const parts = [
      this.deliveryName,
      this.deliveryStreet,
      [this.deliveryCity, this.deliveryCountry, this.deliveryZip].filter(Boolean).join(', '),
      this.deliveryPhone,
    ].filter(Boolean);
    return parts.join('\n');
  }

  // Address book
  savedAddresses: SavedDeliveryAddress[] = [];
  loadingAddresses = false;
  selectedSavedAddressId: number | null = null;

  // Save-to-book toggle
  saveToBook = false;
  saveToBookLabel = '';
  saveToBookLat: string = '';
  saveToBookLng: string = '';
  savedToBook = false;

  // Edit saved address in book (reuses main delivery form)
  editingAddressId: number | null = null;
  editingFromAddressBook = false;

  // Event selection
  availableEvents: AppEvent[] = [];
  selectedEvent: AppEvent | null = null;
  loadingEvents = false;
  isAdmin = false;

  // Orders
  eventId: number | null = null;
  orders: WristbandOrder[] = [];
  loadingOrders = false;

  // Payment tab
  addonPayments: EventAddOnPayment[] = [];
  addonTotalPaid = 0;
  loadingPayments = false;
  showPaymentModal = false;
  paymentMethod: 'balance' | 'paymongo' = 'balance';
  paymentNotes = '';
  savingPayment = false;
  paymentError: string | null = null;
  paymentSuccess = false;
  paymentSuccessAmount = 0;
  labelBalance: number | null = null;
  loadingLabelBalance = false;
  pendingPaymongoSuccess = false;


  // Mobile layout
  isMobile = false;
  activeMenuOrderId: number | null = null;

  // Form state
  formOpen = false;
  editingOrderId: number | null = null;
  formColors: WristbandColorRow[] = [];
  savingOrder = false;
  saveOrderError: string | null = null;

  // Order placed confirmation modal
  showOrderPlacedModal = false;

  // Delete order confirmation dialog
  showDeleteOrderDialog = false;
  private orderPendingDelete: WristbandOrder | null = null;

  // Disclaimer dialog
  showDisclaimerDialog = false;
  dialogCheck1 = false; // design & quantities are final
  dialogCheck2 = false; // quality disclaimer

  get dialogCanConfirm(): boolean {
    return this.dialogCheck1 && this.dialogCheck2;
  }

  private subscriptions = new Subscription();

  constructor(
    private breadcrumbService: BreadcrumbService,
    private eventService: EventService,
    private authService: AuthService,
    private labelFinanceService: LabelFinanceService,
    private route: ActivatedRoute
  ) {}

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 640;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuOrderId = null;
  }

  ngOnInit(): void {
    this.isMobile = window.innerWidth < 640;
    this.breadcrumbService.setBreadcrumbs([
      { label: 'Events', route: '/campaigns/events', icon: 'ticket' },
      { label: 'Add-ons' }
    ]);

    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    // Load available events for the selector
    this.loadingEvents = true;
    this.subscriptions.add(
      this.eventService.getEvents().subscribe({
        next: (events) => {
          this.availableEvents = events;
          this.loadingEvents = false;
          // Restore previously selected event
          const stored = this.eventService.getSelectedEvent();
          if (stored && events.find(e => e.id === stored.id)) {
            this.onEventSelection(stored);
          } else if (events.length === 1) {
            this.onEventSelection(events[0]);
          }
        },
        error: () => { this.loadingEvents = false; }
      })
    );

    this.loadSavedAddresses();

    this.subscriptions.add(
      this.eventService.getWristbandColors().subscribe({
        next: (colors) => {
          this.wristbandColors = colors.map(c => ({ ...c, quantity: 0 }));
          if (this.wristbandColors.length > 0) {
            this.previewColorSlug = this.wristbandColors[0].slug;
          }
          this.loadingColors = false;
          this.resetFormColors();
        },
        error: () => { this.loadingColors = false; }
      })
    );

    // Read query params on load; modal is deferred until event is selected
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        if (params['tab']) {
          this.activeTab = params['tab'];
        }
        if (params['payment_status'] === 'success') {
          this.pendingPaymongoSuccess = true;
        }
      })
    );
  }

  onEventSelection(event: AppEvent): void {
    this.selectedEvent = event;
    this.eventId = event.id;
    this.eventService.setSelectedEvent(event);
    // Reset order state when event changes
    this.orders = [];
    this.formOpen = false;
    this.editingOrderId = null;
    this.deliveryName = '';
    this.deliveryStreet = '';
    this.deliveryCity = '';
    this.deliveryCountry = '';
    this.deliveryZip = '';
    this.deliveryPhone = '';
    this.addressSaved = false;
    this.editingDeliveryAddress = false;
    this.selectedSavedAddressId = null;
    this.saveToBook = false;
    this.savedToBook = false;
    this.editingAddressId = null;
    this.addonPayments = [];
    this.addonTotalPaid = 0;
    this.loadSettings();
    this.loadOrders();
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadSettings(): void {
    if (!this.eventId) return;
    this.subscriptions.add(
      this.eventService.getWristbandSettings(this.eventId).subscribe({
        next: (s) => {
          this.deliveryName    = s.delivery_name    ?? '';
          this.deliveryStreet  = s.delivery_street  ?? '';
          this.deliveryCity    = s.delivery_city    ?? '';
          this.deliveryCountry = s.delivery_country ?? '';
          this.deliveryZip     = s.delivery_zip     ?? '';
          this.deliveryPhone   = s.delivery_phone   ?? '';
        },
        error: () => {}
      })
    );
  }

  private loadOrders(): void {
    if (!this.eventId) return;
    this.loadingOrders = true;
    this.subscriptions.add(
      this.eventService.getWristbandOrders(this.eventId).subscribe({
        next: (orders) => { this.orders = orders; this.loadingOrders = false; },
        error: () => { this.loadingOrders = false; }
      })
    );
  }

  private loadPayments(): void {
    if (!this.eventId) return;
    this.loadingPayments = true;
    this.subscriptions.add(
      this.eventService.getAddOnPayments(this.eventId).subscribe({
        next: (data) => {
          this.addonPayments = data.payments;
          this.addonTotalPaid = data.total_paid;
          this.loadingPayments = false;
          if (this.pendingPaymongoSuccess) {
            this.pendingPaymongoSuccess = false;
            this.paymentMethod = 'paymongo';
            this.paymentSuccess = true;
            this.showPaymentModal = true;
          }
        },
        error: () => { this.loadingPayments = false; }
      })
    );
  }

  openPaymentModal(): void {
    if (!this.hasDeliveryAddress) return;
    this.paymentMethod = 'balance';
    this.paymentNotes = '';
    this.paymentError = null;
    this.paymentSuccess = false;
    this.labelBalance = null;
    this.loadingLabelBalance = true;
    this.showPaymentModal = true;
    const user = this.authService.currentUserValue;
    if (user?.brand_id) {
      this.subscriptions.add(
        this.labelFinanceService.getDashboard(user.brand_id).subscribe({
          next: (data) => {
            this.labelBalance = data.receivable_balance;
            this.loadingLabelBalance = false;
          },
          error: () => { this.loadingLabelBalance = false; }
        })
      );
    } else {
      this.loadingLabelBalance = false;
    }
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  submitPayment(): void {
    if (this.savingPayment) return;
    const amount = this.effectivePaymentAmount;
    if (!this.eventId || !amount || amount <= 0) return;
    this.savingPayment = true;
    this.paymentError = null;

    if (this.paymentMethod === 'paymongo') {
      this.eventService.initiateAddOnPayment({
        event_id: this.eventId,
        amount,
        notes: this.paymentNotes || undefined,
      }).subscribe({
        next: (res) => {
          window.location.href = res.checkout_url;
        },
        error: (err) => {
          this.savingPayment = false;
          this.paymentError = err?.error?.error ?? 'Failed to create payment. Please try again.';
        }
      });
      return;
    }

    this.eventService.createAddOnPayment({
      event_id: this.eventId,
      amount,
      method: this.paymentMethod,
      notes: this.paymentNotes || undefined,
    }).subscribe({
      next: () => {
        this.savingPayment = false;
        this.paymentSuccessAmount = amount;
        this.paymentSuccess = true;
        this.loadPayments();
      },
      error: (err) => {
        this.savingPayment = false;
        this.paymentError = err?.error?.error ?? 'Failed to record payment. Please try again.';
      }
    });
  }

  paymentMethodLabel(method: string): string {
    return method === 'balance' ? 'Label Balance' : 'Paymongo';
  }

  get hasPlacedOrConfirmedOrders(): boolean {
    return this.orders.some(o => o.status === 'confirmed');
  }

  get hasPendingOrders(): boolean {
    return this.orders.some(o => o.status === 'placed');
  }

  get pendingOrderCount(): number {
    return this.orders.filter(o => o.status === 'placed').length;
  }

  get addonWristbandTotal(): number {
    return this.orders
      .filter(o => o.status === 'confirmed')
      .reduce((sum, o) => sum + this.orderPrice(o), 0);
  }

  get addonTotalDue(): number {
    return this.addonWristbandTotal; // equipment rental always 0 for now
  }

  get addonRemainingBalance(): number {
    return Math.max(0, this.addonTotalDue - this.addonTotalPaid);
  }

  /** Amount that will be charged: capped at the available label balance, minimum 0 */
  get effectivePaymentAmount(): number {
    if (this.labelBalance === null) return this.addonRemainingBalance;
    return Math.max(0, Math.min(this.addonRemainingBalance, this.labelBalance));
  }

  /** Remaining invoice balance after the effective payment is applied */
  get afterPaymentBalance(): number {
    return Math.max(0, this.addonRemainingBalance - this.effectivePaymentAmount);
  }

  paymentStatusBadgeClass(status: string): string {
    if (status === 'succeeded') return 'badge bg-success';
    if (status === 'pending') return 'badge bg-warning text-dark';
    return 'badge bg-danger';
  }

  onTabChange(tabId: string): void {
    this.activeTab = tabId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tabId === 'payment' && this.eventId) {
      this.loadPayments();
    }
  }

  isTab(id: string): boolean {
    return this.activeTab === id;
  }

  // ─── Delivery Address ────────────────────────────────────────────────────

  saveAddressBlockedByPayment = false;

  saveAddress(): void {
    if (!this.eventId) return;

    // Prevent clearing the address when payments have been recorded
    const wouldClear = !this.deliveryName.trim() && !this.deliveryStreet.trim() &&
      !this.deliveryCity.trim() && !this.deliveryCountry.trim() &&
      !this.deliveryZip.trim() && !this.deliveryPhone.trim();
    if (this.hasAnyPayment && wouldClear) {
      this.saveAddressBlockedByPayment = true;
      return;
    }
    this.saveAddressBlockedByPayment = false;

    this.savingAddress = true;
    this.addressSaved = false;
    this.savedToBook = false;

    const fields = {
      delivery_name:    this.deliveryName.trim()    || null,
      delivery_street:  this.deliveryStreet.trim()  || null,
      delivery_city:    this.deliveryCity.trim()    || null,
      delivery_country: this.deliveryCountry.trim() || null,
      delivery_zip:     this.deliveryZip.trim()     || null,
      delivery_phone:   this.deliveryPhone.trim()   || null,
    };

    this.eventService.upsertWristbandSettings(this.eventId, fields).subscribe({
      next: () => {
        this.savingAddress = false;
        this.addressSaved = true;
        this.editingDeliveryAddress = false;

        if (this.editingFromAddressBook && this.editingAddressId) {
          // Update the saved address book entry with the edited values
          this.eventService.updateSavedDeliveryAddress(this.editingAddressId, {
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
            error: () => {}
          });
          this.editingFromAddressBook = false;
          this.editingAddressId = null;
        } else if (this.saveToBook && this.hasDeliveryAddress) {
          this.saveToAddressBook();
        }
      },
      error: () => { this.savingAddress = false; }
    });
  }

  cancelDeliveryEdit(): void {
    if (this.editingFromAddressBook && this.editingAddressId) {
      // Restore fields from the saved address
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

  // ─── Address Book ─────────────────────────────────────────────────────────

  private loadSavedAddresses(): void {
    this.loadingAddresses = true;
    this.subscriptions.add(
      this.eventService.getSavedDeliveryAddresses().subscribe({
        next: (addresses) => { this.savedAddresses = addresses; this.loadingAddresses = false; },
        error: () => { this.loadingAddresses = false; }
      })
    );
  }

  selectSavedAddress(address: SavedDeliveryAddress): void {
    this.selectedSavedAddressId = address.id;
    this.deliveryName    = address.name    ?? '';
    this.deliveryStreet  = address.street  ?? '';
    this.deliveryCity    = address.city    ?? '';
    this.deliveryCountry = address.country ?? '';
    this.deliveryZip     = address.zip     ?? '';
    this.deliveryPhone   = address.phone   ?? '';
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
    this.saveToBookLat = '';
    this.saveToBookLng = '';
    this.addressSaved = false;
    this.editingDeliveryAddress = true;
  }

  clearSavedAddressSelection(): void {
    this.selectedSavedAddressId = null;
    this.deliveryName = '';
    this.deliveryStreet = '';
    this.deliveryCity = '';
    this.deliveryCountry = '';
    this.deliveryZip = '';
    this.deliveryPhone = '';
    this.addressSaved = false;
  }

  onSaveToBookToggle(): void {
    if (this.saveToBook) {
      this.saveToBookLabel = '';
      this.saveToBookLat = '';
      this.saveToBookLng = '';
      this.savedToBook = false;
    }
  }

  private saveToAddressBook(): void {
    const lat = this.saveToBookLat.trim() ? parseFloat(this.saveToBookLat) : null;
    const lng = this.saveToBookLng.trim() ? parseFloat(this.saveToBookLng) : null;
    this.eventService.createSavedDeliveryAddress({
      label:   this.saveToBookLabel.trim()    || undefined,
      name:    this.deliveryName.trim()    || null,
      street:  this.deliveryStreet.trim()  || null,
      city:    this.deliveryCity.trim()    || null,
      country: this.deliveryCountry.trim() || null,
      zip:     this.deliveryZip.trim()     || null,
      phone:   this.deliveryPhone.trim()   || null,
      latitude: lat,
      longitude: lng,
    }).subscribe({
      next: (saved) => {
        this.savedAddresses.unshift(saved);
        this.savedToBook = true;
        this.saveToBook = false;
        this.selectedSavedAddressId = saved.id;
      },
      error: () => {}
    });
  }

  startEditAddress(address: SavedDeliveryAddress): void {
    this.editingAddressId = address.id;
    this.editingFromAddressBook = true;
    this.selectedSavedAddressId = address.id;
    this.deliveryName    = address.name    ?? '';
    this.deliveryStreet  = address.street  ?? '';
    this.deliveryCity    = address.city    ?? '';
    this.deliveryCountry = address.country ?? '';
    this.deliveryZip     = address.zip     ?? '';
    this.deliveryPhone   = address.phone   ?? '';
    this.saveToBook = false;
    this.addressSaved = false;
    this.editingDeliveryAddress = true;
  }

  formatAddressSummary(addr: SavedDeliveryAddress): string {
    const parts = [
      addr.name,
      addr.street,
      [addr.city, addr.country, addr.zip].filter(Boolean).join(', '),
      addr.phone,
    ].filter(Boolean);
    return parts.join('\n') || '—';
  }

  deleteAddress(address: SavedDeliveryAddress): void {
    if (!confirm(`Delete "${address.label || address.name || 'this address'}"?`)) return;
    this.eventService.deleteSavedDeliveryAddress(address.id).subscribe({
      next: () => {
        this.savedAddresses = this.savedAddresses.filter(a => a.id !== address.id);
        if (this.selectedSavedAddressId === address.id) {
          this.selectedSavedAddressId = null;
        }
      },
      error: () => {}
    });
  }

  // ─── Orders Table ────────────────────────────────────────────────────────

  get totalOrderQty(): (order: WristbandOrder) => number {
    return (order) => (order.items ?? []).reduce((s, i) => s + i.quantity, 0);
  }

  orderPrice(order: WristbandOrder): number {
    return ((order.items ?? []).reduce((s, i) => s + i.quantity, 0) / 10) * this.PRICE_PER_10;
  }

  colorsSummary(order: WristbandOrder): string {
    return (order.items ?? [])
      .filter(i => i.quantity > 0)
      .map(i => `${i.color?.label ?? '?'} ×${i.quantity}`)
      .join(', ');
  }

  get mobileOrdersTotalQty(): number {
    return this.orders.reduce((s, o) => s + (o.items ?? []).reduce((si, i) => si + i.quantity, 0), 0);
  }

  get mobileOrdersTotalPrice(): number {
    return this.orders.reduce((s, o) => s + this.orderPrice(o), 0);
  }

  toggleOrderMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuOrderId = this.activeMenuOrderId === id ? null : id;
  }

  canEdit(order: WristbandOrder): boolean {
    return order.status === 'draft' || order.status === 'rejected';
  }

  canDelete(order: WristbandOrder): boolean {
    return order.status === 'draft';
  }


  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      draft: 'status-warning',
      placed: 'status-info',
      rejected: 'status-danger',
      confirmed: 'status-success'
    };
    return `status-badge ${map[status] ?? 'status-secondary'}`;
  }

  // ─── Order Form ──────────────────────────────────────────────────────────

  private resetFormColors(): void {
    this.formColors = this.wristbandColors.map(c => ({ ...c, quantity: 0 }));
  }

  openNewOrder(): void {
    this.resetFormColors();
    this.formDesignFile = null;
    this.formDesignFileName = '';
    this.formDesignDataUrl = null;
    this.formDesignIsImage = false;
    this.formDesignError = null;
    this.saveOrderError = null;
    this.editingOrderId = null;
    this.formOpen = true;
    setTimeout(() => {
      document.querySelector('.order-new-form, .mc-new-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  openEditOrder(order: WristbandOrder): void {
    this.resetFormColors();
    (order.items ?? []).forEach(item => {
      const row = this.formColors.find(c => c.id === item.wristband_color_id);
      if (row) row.quantity = item.quantity;
    });
    this.formDesignFile = null;
    this.formDesignFileName = order.design_url ? 'existing-design.png' : '';
    this.formDesignDataUrl = order.design_url ?? null;
    this.formDesignIsImage = !!order.design_url;
    this.formDesignError = null;
    this.saveOrderError = null;
    this.editingOrderId = order.id;
    this.formOpen = true;
    const firstWithQty = this.formColors.find(c => c.quantity > 0);
    this.previewColorSlug = firstWithQty ? firstWithQty.slug : '';
    if (order.design_url) {
      if (order.design_x != null && order.design_y != null && order.design_width != null && order.design_height != null) {
        // Restore saved canvas position/size
        this.designPos = { x: order.design_x, y: order.design_y, width: order.design_width, height: order.design_height };
      } else {
        // No saved position yet — compute defaults after canvas renders
        setTimeout(() => this.resetDesignPos(), 0);
      }
    }
  }

  cancelForm(): void {
    this.formOpen = false;
    this.editingOrderId = null;
  }

  get formTotalQuantity(): number {
    return this.formColors.reduce((s, c) => s + c.quantity, 0);
  }

  get formTotalPrice(): number {
    return (this.formTotalQuantity / 10) * this.PRICE_PER_10;
  }

  get formColorBreakdown(): { label: string; quantity: number; price: number }[] {
    return this.formColors
      .filter(c => c.quantity > 0)
      .map(c => ({ label: c.label, quantity: c.quantity, price: (c.quantity / 10) * this.PRICE_PER_10 }));
  }

  get placedOrders(): WristbandOrder[] {
    return this.orders.filter(o => o.status === 'confirmed');
  }

  get allOrdersTotalQty(): number {
    return this.placedOrders.reduce((s, o) => s + this.totalOrderQty(o), 0);
  }

  get allOrdersTotalPrice(): number {
    return this.placedOrders.reduce((s, o) => s + this.orderPrice(o), 0);
  }

  get hasPlacedOrders(): boolean {
    return this.orders.some(o => o.status !== 'draft');
  }

  get showSummaryBar(): boolean {
    return this.formOpen || this.hasPlacedOrConfirmedOrders;
  }

  decreaseQuantity(color: WristbandColorRow): void {
    if (color.quantity >= 10) {
      color.quantity -= 10;
      // If this color lost its quantity and was the preview, shift to first still-available
      if (color.quantity === 0 && this.previewColorSlug === color.slug) {
        const next = this.formColorsWithQuantity[0];
        this.previewColorSlug = next ? next.slug : '';
      }
    }
  }

  increaseQuantity(color: WristbandColorRow): void {
    color.quantity += 10;
    // Auto-select this color if nothing valid is currently previewed
    if (!this.formColorsWithQuantity.find(c => c.slug === this.previewColorSlug)) {
      this.previewColorSlug = color.slug;
    }
  }

  saveAsDraft(): void {
    this.submitOrder('draft');
  }

  placeOrder(): void {
    this.dialogCheck1 = false;
    this.dialogCheck2 = false;
    this.showDisclaimerDialog = true;
  }

  cancelDisclaimerDialog(): void {
    this.showDisclaimerDialog = false;
  }

  confirmPlaceOrder(): void {
    this.showDisclaimerDialog = false;
    this.submitOrder('placed');
  }

  private async submitOrder(status: 'draft' | 'placed'): Promise<void> {
    if (!this.eventId) return;
    this.savingOrder = true;
    this.saveOrderError = null;

    try {
      const formData = new FormData();
      formData.append('status', status);
      formData.append('disclaimer_acknowledged', status === 'placed' ? 'true' : 'false');

      const items = this.formColors
        .filter(c => c.quantity > 0)
        .map(c => ({ wristband_color_id: c.id, quantity: c.quantity }));
      formData.append('items', JSON.stringify(items));

      // If we have a processed image file to send (from file input)
      if (this.formDesignFile && this.formDesignDataUrl) {
        const blob = await this.dataUrlToBlob(this.formDesignDataUrl);
        formData.append('design', blob, 'design.png');
      }

      // Always persist canvas position/size when a design is present
      if (this.formDesignIsImage) {
        const bounds = this.getPreviewBounds();
        formData.append('design_x',      String(this.designPos.x));
        formData.append('design_y',      String(this.designPos.y));
        formData.append('design_width',  String(this.designPos.width));
        formData.append('design_height', String(this.designPos.height));
        formData.append('canvas_width',  String(bounds.width));
      }

      const obs = this.editingOrderId
        ? this.eventService.updateWristbandOrder(this.editingOrderId, formData)
        : this.eventService.createWristbandOrder(this.eventId, formData);

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
          if (status === 'placed') {
            this.showOrderPlacedModal = true;
          }
        },
        error: (err) => {
          this.savingOrder = false;
          this.saveOrderError = err.message || 'Failed to save order.';
        }
      });
    } catch (err: any) {
      this.savingOrder = false;
      this.saveOrderError = err.message || 'Failed to prepare order.';
    }
  }

  deleteOrder(order: WristbandOrder): void {
    this.orderPendingDelete = order;
    this.showDeleteOrderDialog = true;
  }

  confirmDeleteOrder(): void {
    if (!this.orderPendingDelete) return;
    const id = this.orderPendingDelete.id;
    this.showDeleteOrderDialog = false;
    this.orderPendingDelete = null;
    this.eventService.deleteWristbandOrder(id).subscribe({
      next: () => { this.orders = this.orders.filter(o => o.id !== id); },
      error: () => {}
    });
  }

  cancelDeleteOrder(): void {
    this.showDeleteOrderDialog = false;
    this.orderPendingDelete = null;
  }

  private dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return fetch(dataUrl).then(r => r.blob());
  }

  // ─── Preview color ────────────────────────────────────────────────────────

  get formColorsWithQuantity(): WristbandColorRow[] {
    return this.formColors.filter(c => c.quantity > 0);
  }

  get previewColor(): WristbandColorRow | undefined {
    const available = this.formColorsWithQuantity;
    if (available.length === 0) return this.wristbandColors[0];
    return available.find(c => c.slug === this.previewColorSlug) ?? available[0];
  }

  selectPreviewColor(slug: string): void {
    this.previewColorSlug = slug;
  }

  // ─── Design file ──────────────────────────────────────────────────────────

  onDesignFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.formDesignFile = file;
    this.formDesignFileName = file.name;
    this.formDesignIsImage = file.type.startsWith('image/');
    this.formDesignError = null;

    if (this.formDesignIsImage) {
      this.formDesignProcessing = true;
      this.formDesignDataUrl = null;
      const reader = new FileReader();
      reader.onload = (e) => {
        const originalDataUrl = e.target?.result as string;
        this.processDesignImage(originalDataUrl)
          .then(processed => {
            this.formDesignDataUrl = processed;
            this.formDesignProcessing = false;
            this.resetDesignPos();
          })
          .catch(err => {
            this.formDesignFile = null;
            this.formDesignDataUrl = null;
            this.formDesignProcessing = false;
            this.formDesignError = err.message;
          });
      };
      reader.readAsDataURL(file);
    } else {
      this.formDesignDataUrl = null;
      this.resetDesignPos();
    }

    input.value = '';
  }

  removeDesignFile(): void {
    this.formDesignFile = null;
    this.formDesignFileName = '';
    this.formDesignDataUrl = null;
    this.formDesignIsImage = false;
    this.formDesignError = null;
  }

  private processDesignImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.naturalWidth;
        const H = img.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, W, H);
        const data = imageData.data;

        // Check if already compliant
        {
          let hasTransparentPixels = false;
          let hasNonBlackOpaquePixels = false;
          const BLACK_TOLERANCE = 40;

          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 128) {
              hasTransparentPixels = true;
            } else {
              const brightness = data[i] + data[i + 1] + data[i + 2];
              if (brightness > BLACK_TOLERANCE * 3) {
                hasNonBlackOpaquePixels = true;
              }
            }
            if (hasTransparentPixels && hasNonBlackOpaquePixels) break;
          }

          if (hasTransparentPixels && !hasNonBlackOpaquePixels) {
            resolve(canvas.toDataURL('image/png'));
            return;
          }
        }

        const patchSize = Math.min(5, Math.floor(Math.min(W, H) / 4));
        const samples: [number, number, number][] = [];
        for (let py = 0; py < patchSize; py++) {
          for (let px = 0; px < patchSize; px++) {
            const corners = [
              [px, py], [W - 1 - px, py],
              [px, H - 1 - py], [W - 1 - px, H - 1 - py],
            ];
            for (const [cx, cy] of corners) {
              const i = (cy * W + cx) * 4;
              samples.push([data[i], data[i + 1], data[i + 2]]);
            }
          }
        }

        const avgBg: [number, number, number] = [
          samples.reduce((s, c) => s + c[0], 0) / samples.length,
          samples.reduce((s, c) => s + c[1], 0) / samples.length,
          samples.reduce((s, c) => s + c[2], 0) / samples.length,
        ];

        const cornerVariance = samples.reduce((s, c) => {
          return s + Math.abs(c[0] - avgBg[0]) + Math.abs(c[1] - avgBg[1]) + Math.abs(c[2] - avgBg[2]);
        }, 0) / samples.length;

        if (cornerVariance > 80) {
          reject(new Error(
            'This image is not suitable for automatic processing. ' +
            'Please use a plain (solid-colour) background with solid black artwork.'
          ));
          return;
        }

        const TOLERANCE = 45;
        let opaquePixels = 0;
        const total = W * H;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a === 0) continue;
          const dist = Math.sqrt(
            (r - avgBg[0]) ** 2 + (g - avgBg[1]) ** 2 + (b - avgBg[2]) ** 2
          );
          if (dist <= TOLERANCE) {
            data[i + 3] = 0;
          } else {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
            opaquePixels++;
          }
        }

        if (opaquePixels / total < 0.005) {
          reject(new Error(
            'This image is not suitable for automatic processing. ' +
            'Please use a plain (solid-colour) background with solid black artwork.'
          ));
          return;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Could not load the image file.'));
      img.src = dataUrl;
    });
  }

  private resetDesignPos(): void {
    const b = this.getPreviewBounds();
    const bandLeft   = b.width  * (this.TMPL_L + this.TMPL_W * this.BAND_L);
    const bandRight  = b.width  * (this.TMPL_L + this.TMPL_W * this.BAND_R);
    const bandTop    = b.height * (this.TMPL_T + this.TMPL_H * this.BAND_T);
    const bandBottom = b.height * (this.TMPL_T + this.TMPL_H * this.BAND_B);
    const bw = bandRight  - bandLeft;
    const bh = bandBottom - bandTop;
    this.designPos = {
      x:      Math.round(bandLeft + bw * 0.05),
      y:      Math.round(bandTop  + bh * 0.1),
      width:  Math.round(bw * 0.55),
      height: Math.round(bh * 0.8)
    };
  }

  // ─── Drag & Resize ────────────────────────────────────────────────────────

  startDrag(event: MouseEvent): void {
    if (this._resizing) return;
    this._dragging = true;
    this._dragStartX = event.clientX;
    this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault();
  }

  startDragTouch(event: TouchEvent): void {
    if (this._resizing) return;
    const touch = event.touches[0];
    this._dragging = true;
    this._dragStartX = touch.clientX;
    this._dragStartY = touch.clientY;
    this._startPos = { ...this.designPos };
  }

  startResize(event: MouseEvent, handle: string): void {
    this._resizing = true;
    this._resizeHandle = handle;
    this._dragStartX = event.clientX;
    this._dragStartY = event.clientY;
    this._startPos = { ...this.designPos };
    event.preventDefault();
    event.stopPropagation();
  }

  startResizeTouch(event: TouchEvent, handle: string): void {
    const touch = event.touches[0];
    this._resizing = true;
    this._resizeHandle = handle;
    this._dragStartX = touch.clientX;
    this._dragStartY = touch.clientY;
    this._startPos = { ...this.designPos };
    event.stopPropagation();
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this._dragging && !this._resizing) return;
    const touch = event.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
  }

  @HostListener('document:touchend')
  onTouchEnd(): void {
    this._dragging = false;
    this._resizing = false;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this._dragging && !this._resizing) return;

    const dx = event.clientX - this._dragStartX;
    const dy = event.clientY - this._dragStartY;
    const b  = this.getPreviewBounds();

    if (this._dragging) {
      this.designPos = {
        ...this.designPos,
        x: Math.max(0, Math.min(b.width  - this.designPos.width,  this._startPos.x + dx)),
        y: Math.max(0, Math.min(b.height - this.designPos.height, this._startPos.y + dy))
      };
    }

    if (this._resizing) {
      let { x, y, width, height } = this._startPos;
      const isCorner = this._resizeHandle.length === 2;

      if (isCorner) {
        const aspect = this._startPos.width / this._startPos.height;
        const primaryDx = this._resizeHandle.includes('e') ? dx : -dx;
        const primaryDy = this._resizeHandle.includes('s') ? dy : -dy;
        const delta = Math.abs(primaryDx) >= Math.abs(primaryDy) ? primaryDx : primaryDy * aspect;
        const newW = Math.max(this.MIN_SIZE, width + delta);
        const newH = newW / aspect;
        if (this._resizeHandle.includes('w')) x = Math.max(0, x + width  - newW);
        if (this._resizeHandle.includes('n')) y = Math.max(0, y + height - newH);
        width  = newW;
        height = newH;
      } else {
        if (this._resizeHandle === 'e') width = Math.max(this.MIN_SIZE, width + dx);
        if (this._resizeHandle === 's') height = Math.max(this.MIN_SIZE, height + dy);
        if (this._resizeHandle === 'w') {
          const right = x + width;
          const newW  = Math.max(this.MIN_SIZE, width - dx);
          x     = Math.max(0, right - newW);
          width = right - x;
        }
        if (this._resizeHandle === 'n') {
          const bottom = y + height;
          const newH   = Math.max(this.MIN_SIZE, height - dy);
          y      = Math.max(0, bottom - newH);
          height = bottom - y;
        }
      }

      this.designPos = { x, y, width, height };
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this._dragging = false;
    this._resizing = false;
  }

  private getPreviewBounds(): { width: number; height: number } {
    if (this.previewContainer?.nativeElement) {
      const el = this.previewContainer.nativeElement;
      return { width: el.clientWidth, height: el.clientHeight };
    }
    return { width: 700, height: 115 };
  }

  get isDraggingOrResizing(): boolean {
    return this._dragging || this._resizing;
  }
}
