import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicService } from '../../../services/public.service';
import { BrandService, BrandSettings } from '../../../services/brand.service';

// Angular Material imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

// QR Code scanner
import { Html5Qrcode, Html5QrcodeResult } from 'html5-qrcode';

@Component({
    selector: 'app-ticket-verify',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatDividerModule
    ],
    templateUrl: './ticket-verify.component.html',
    styleUrls: ['./ticket-verify.component.scss']
})
export class TicketVerifyComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private html5QrCode?: Html5Qrcode;
  
  // Form states
  pinForm: FormGroup;
  ticketForm: FormGroup;
  checkInForm: FormGroup;
  
  // Component state
  currentBrand: BrandSettings | null = null;
  eventId: number | null = null;
  scannerToken: string = '';
  isPinValidated = false;
  isLoading = false;
  isScanning = false;
  
  // Event and ticket data
  currentEvent: any = null;
  currentTicket: any = null;
  lastCheckInEntries: number = 0;
  
  // UI state
  alertType: 'success' | 'error' | 'info' | 'warning' = 'info';
  alertMessage = '';
  showAlert = false;
  
  // Workflow states
  showInputForm = true;
  showCheckInForm = false;
  showPersistentAlert = false;
  persistentAlertType: 'success' | 'error' = 'success';
  persistentAlertMessage = '';

  private alertTimeout?: any;

  // Scanner state
  scannerSupported = false;
  cameraPermissionGranted = false;

  // Walk-in state
  activeMode: 'scan' | 'walk-in' = 'scan';
  walkInEnabled = false;
  walkInTypes: any[] = [];
  walkInPaymentMethods: { cash: boolean; gcash: boolean; card: boolean } = { cash: false, gcash: false, card: false };
  walkInSelections: Map<number, number> = new Map(); // type_id -> quantity
  walkInPaymentMethod: string = '';
  walkInPaymentReference: string = '';
  walkInMaxCount: number = 0; // 0 = unlimited
  walkInTotalSoldCount: number = 0;
  walkInLoading = false;
  walkInRegistered = false;
  walkInRegisteredMessage = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private publicService: PublicService,
    private brandService: BrandService
  ) {
    this.pinForm = this.fb.group({
      pin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    this.ticketForm = this.fb.group({
      ticketCode: ['', [Validators.required]]
    });

    this.checkInForm = this.fb.group({
      entriesToClaim: [1, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.brandService.brandSettings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(brand => {
        this.currentBrand = brand;
      });

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.eventId = params['id'] ? parseInt(params['id'], 10) : null;
        if (this.eventId) {
          this.loadEventInfo();
          this.tryRestoreSession();
        }
      });

    // Check if scanner is supported
    this.checkScannerSupport();
  }

  ngAfterViewInit(): void {
    // Initialize scanner after PIN validation
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopScanner();
    // Clear any pending alert timeout
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
  }

  private checkScannerSupport(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      this.scannerSupported = true;
    }
  }

  private loadEventInfo(): void {
    if (!this.eventId) {
      return;
    }

    this.publicService.getPublicEventInfo(this.eventId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentEvent = response.event;
        },
        error: (error) => {
          console.error('Failed to load event info:', error);
          this.currentEvent = { title: 'Event' }; // Fallback
        }
      });
  }

  private tryRestoreSession(): void {
    if (!this.eventId) return;

    const storedToken = localStorage.getItem(`scanner_token_${this.eventId}`);
    if (!storedToken) return;

    // Validate token by making a lightweight API call
    this.publicService.scannerGetWalkInTypes(storedToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Token is valid - restore session
          this.scannerToken = storedToken;
          this.isPinValidated = true;
          this.walkInEnabled = true;
          this.walkInTypes = response.walkInTypes;
          this.walkInPaymentMethods = response.payment_methods;
          this.walkInMaxCount = response.walk_in_max_count || 0;
          this.walkInTotalSoldCount = response.total_sold_count || 0;
          if (this.walkInPaymentMethods.cash) this.walkInPaymentMethod = 'cash';
          else if (this.walkInPaymentMethods.gcash) this.walkInPaymentMethod = 'gcash';
          else if (this.walkInPaymentMethods.card) this.walkInPaymentMethod = 'card';
        },
        error: (err) => {
          if (err.status === 400) {
            // Walk-in not enabled, but token itself is valid (domain/event check passed in middleware)
            this.scannerToken = storedToken;
            this.isPinValidated = true;
            this.walkInEnabled = false;
          } else {
            // Token invalid/expired - clear it
            this.clearSession();
          }
        }
      });
  }

  logoutScanner(): void {
    this.clearSession();
    this.resetUIState();
    this.activeMode = 'scan';
    this.walkInEnabled = false;
    this.walkInTypes = [];
    this.walkInSelections.clear();
    this.pinForm.reset();
  }

  private clearSession(): void {
    if (this.eventId) {
      localStorage.removeItem(`scanner_token_${this.eventId}`);
    }
    this.scannerToken = '';
    this.isPinValidated = false;
  }

  private handleScannerError(error: any): void {
    if (error.status === 401 || error.status === 403) {
      this.clearSession();
      this.showError('Session expired. Please enter PIN again.');
    }
  }

  private checkWalkInStatus(): void {
    if (!this.scannerToken) return;

    this.publicService.scannerGetWalkInTypes(this.scannerToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.walkInEnabled = true;
          this.walkInTypes = response.walkInTypes;
          this.walkInPaymentMethods = response.payment_methods;
          this.walkInMaxCount = response.walk_in_max_count || 0;
          this.walkInTotalSoldCount = response.total_sold_count || 0;
          if (this.walkInPaymentMethods.cash) this.walkInPaymentMethod = 'cash';
          else if (this.walkInPaymentMethods.gcash) this.walkInPaymentMethod = 'gcash';
          else if (this.walkInPaymentMethods.card) this.walkInPaymentMethod = 'card';
        },
        error: (err: any) => {
          if (err.status === 401 || err.status === 403) {
            this.handleScannerError(err);
          } else {
            // Walk-in not enabled for this event - that's fine
            this.walkInEnabled = false;
          }
        }
      });
  }

  validatePin(): void {
    if (!this.pinForm.valid || !this.eventId) {
      return;
    }

    const pin = this.pinForm.get('pin')?.value;
    this.isLoading = true;

    this.publicService.scannerLogin(this.eventId, pin)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isPinValidated = true;
          this.scannerToken = response.token;
          this.currentEvent = response.event;
          // Persist token in localStorage
          localStorage.setItem(`scanner_token_${this.eventId}`, response.token);
          this.showSuccess("You're in! You can now scan tickets below.");
          // Check walk-in status
          this.checkWalkInStatus();
          this.isLoading = false;
        },
        error: (error) => {
          this.showError(error.error?.error || 'Failed to validate PIN. Please try again.');
          this.isLoading = false;
        }
      });
  }

  private initializeScanner(): void {
    if (!this.scannerSupported) {
      return;
    }

    this.html5QrCode = new Html5Qrcode("qr-reader");
    
    this.html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText: string, decodedResult: Html5QrcodeResult) => {
        this.onScanSuccess(decodedText);
      },
      (errorMessage: string) => {
        // Don't do anything
      }
    ).catch((err) => {
      console.error('QR Scanner start failed:', err);
    });
  }

  private onScanSuccess(decodedText: string): void {
    // Extract ticket code from QR code (assuming QR contains just the ticket code)
    const ticketCode = decodedText.trim().toUpperCase();
    
    this.ticketForm.patchValue({ ticketCode: ticketCode });
    this.stopScanner(); // Hide scanner immediately after successful scan
    this.playBeep();
    
    // Auto-lookup after scanning (validation will happen in lookupTicket method)
    this.lookupTicket();
  }

  private playBeep(): void {
    try {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAfBC2Szfbc';
      audio.play().catch(() => {
        // Ignore audio play errors (browser permissions)
      });
    } catch (error) {
      // Ignore audio errors
    }
  }

  toggleScanner(): void {
    if (!this.isPinValidated) {
      this.showError('Please validate PIN first before using the scanner.');
      return;
    }

    this.isScanning = !this.isScanning;
    
    if (this.isScanning) {
      this.initializeScanner();
    } else {
      this.stopScanner();
    }
  }

  stopScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop().catch(err => {
        console.error('Failed to stop scanner', err);
      });
      this.html5QrCode = undefined;
    }
    this.isScanning = false;
  }

  lookupTicket(): void {
    if (!this.ticketForm.valid || !this.eventId || !this.scannerToken) {
      return;
    }

    const ticketCode = this.ticketForm.get('ticketCode')?.value.toUpperCase().trim();

    // Validate ticket code format
    if (!ticketCode.match(/^[A-Z0-9]{5}$/)) {
      this.showPersistentError('Ticket not found.');
      return;
    }

    this.isLoading = true;
    this.resetUIState();

    this.publicService.scannerGetTicket(this.scannerToken, ticketCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentTicket = response.ticket;

          // Scenario 1: Ticket found with remaining entries - show check-in form
          if (response.ticket.remaining_entries > 0) {
            this.showInputForm = false;
            this.showCheckInForm = true;
            this.checkInForm.patchValue({
              entriesToClaim: Math.min(1, response.ticket.remaining_entries)
            });
            this.checkInForm.get('entriesToClaim')?.setValidators([
              Validators.required,
              Validators.min(1),
              Validators.max(response.ticket.remaining_entries)
            ]);
            setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
          } else {
            // Scenario 3: Ticket found but no remaining entries
            this.showPersistentError('All entries for this ticket have been claimed.');
          }

          this.isLoading = false;
        },
        error: (error) => {
          if (error.status === 401 || error.status === 403) {
            this.handleScannerError(error);
          } else {
            // Scenario 2: Ticket not found
            this.showPersistentError('Ticket not found.');
          }
          this.isLoading = false;
        }
      });
  }

  checkInTicket(): void {
    if (!this.checkInForm.valid || !this.currentTicket || !this.scannerToken) {
      return;
    }

    const entriesToClaim = this.checkInForm.get('entriesToClaim')?.value;
    this.isLoading = true;

    this.publicService.scannerCheckIn(this.scannerToken, this.currentTicket.ticket_code, entriesToClaim)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentTicket = response.ticket;
          this.lastCheckInEntries = entriesToClaim;
          this.showPersistentSuccess(response.message);
          this.checkInForm.patchValue({ entriesToClaim: 1 });
          this.isLoading = false;
        },
        error: (error) => {
          if (error.status === 401 || error.status === 403) {
            this.handleScannerError(error);
          } else {
            this.showError(error.error?.error || 'Failed to check in ticket.');
          }
          this.isLoading = false;
        }
      });
  }

  claimAllEntries(): void {
    if (!this.currentTicket || !this.scannerToken) {
      return;
    }

    const allRemainingEntries = this.currentTicket.remaining_entries;
    if (allRemainingEntries <= 0) {
      return;
    }

    this.isLoading = true;

    this.publicService.scannerCheckIn(this.scannerToken, this.currentTicket.ticket_code, allRemainingEntries)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentTicket = response.ticket;
          this.lastCheckInEntries = allRemainingEntries;
          this.showPersistentSuccess(response.message);
          this.checkInForm.patchValue({ entriesToClaim: 1 });
          this.isLoading = false;
        },
        error: (error) => {
          if (error.status === 401 || error.status === 403) {
            this.handleScannerError(error);
          } else {
            this.showError(error.error?.error || 'Failed to claim all entries.');
          }
          this.isLoading = false;
        }
      });
  }

  resetTicketLookup(): void {
    this.resetUIState();
    this.ticketForm.reset();
    this.checkInForm.patchValue({ entriesToClaim: 1 });
    this.lastCheckInEntries = 0;
  }

  private showSuccess(message: string): void {
    this.alertType = 'success';
    this.alertMessage = message;
    this.showAlert = true;
    this.hideAlertAfterDelay();
  }

  private showError(message: string): void {
    this.alertType = 'error';
    this.alertMessage = message;
    this.showAlert = true;
    this.hideAlertAfterDelay();
  }

  private showInfo(message: string): void {
    this.alertType = 'info';
    this.alertMessage = message;
    this.showAlert = true;
    this.hideAlertAfterDelay();
  }

  private showPersistentError(message: string): void {
    this.showInputForm = false;
    this.showCheckInForm = false;
    this.showPersistentAlert = true;
    this.persistentAlertType = 'error';
    this.persistentAlertMessage = message;
    this.ticketForm.reset();
  }

  private showPersistentSuccess(message: string): void {
    this.showInputForm = false;
    this.showCheckInForm = false;
    this.showPersistentAlert = true;
    this.persistentAlertType = 'success';
    this.persistentAlertMessage = message;
    this.ticketForm.reset();
  }

  private resetUIState(): void {
    this.currentTicket = null;
    this.showPersistentAlert = false;
    this.showInputForm = true;
    this.showCheckInForm = false;
    this.hideAlert();
  }

  hideAlert(): void {
    this.showAlert = false;
    // Clear timeout when manually hiding alert
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
      this.alertTimeout = undefined;
    }
  }

  private hideAlertAfterDelay(): void {
    if (!this.showPersistentSuccess) {
      // Clear any existing timeout to prevent overlapping timers
      if (this.alertTimeout) {
        clearTimeout(this.alertTimeout);
      }
      
      this.alertTimeout = setTimeout(() => {
        this.hideAlert();
        this.alertTimeout = undefined;
      }, 3000);
    }
  }

  getBrandColor(): string {
    return this.currentBrand?.brand_color || this.currentEvent?.brand?.color || '#6f42c1';
  }

  // Walk-In Methods
  switchMode(mode: 'scan' | 'walk-in'): void {
    this.activeMode = mode;
    if (mode === 'walk-in' && this.walkInTypes.length === 0) {
      this.loadWalkInTypes();
    }
  }

  private loadWalkInTypes(): void {
    if (!this.scannerToken) return;

    this.walkInLoading = true;
    this.publicService.scannerGetWalkInTypes(this.scannerToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.walkInTypes = response.walkInTypes;
          this.walkInPaymentMethods = response.payment_methods;
          this.walkInMaxCount = response.walk_in_max_count || 0;
          this.walkInTotalSoldCount = response.total_sold_count || 0;
          // Auto-select first available payment method
          if (this.walkInPaymentMethods.cash) this.walkInPaymentMethod = 'cash';
          else if (this.walkInPaymentMethods.gcash) this.walkInPaymentMethod = 'gcash';
          else if (this.walkInPaymentMethods.card) this.walkInPaymentMethod = 'card';
          this.walkInLoading = false;
        },
        error: (error: any) => {
          if (error.status === 401 || error.status === 403) {
            this.handleScannerError(error);
          } else {
            this.showError('Failed to load walk-in types.');
          }
          this.walkInLoading = false;
        }
      });
  }

  onWalkInTypeTap(type: any): void {
    const currentQty = this.walkInSelections.get(type.id) || 0;
    if (type.remaining_slots !== null && type.remaining_slots !== undefined && currentQty + 1 > type.remaining_slots) return;
    if (this.isWalkInMaxReached()) return;
    this.walkInSelections.set(type.id, currentQty + 1);
  }

  incrementWalkIn(typeId: number, event: MouseEvent): void {
    event.stopPropagation();
    const type = this.walkInTypes.find(t => t.id === typeId);
    const current = this.walkInSelections.get(typeId) || 0;
    if (type && type.remaining_slots !== null && type.remaining_slots !== undefined && current + 1 > type.remaining_slots) return;
    if (this.isWalkInMaxReached()) return;
    this.walkInSelections.set(typeId, current + 1);
  }

  decrementWalkIn(typeId: number, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.walkInSelections.get(typeId) || 0;
    if (current <= 1) {
      this.walkInSelections.delete(typeId);
    } else {
      this.walkInSelections.set(typeId, current - 1);
    }
  }

  getWalkInQty(typeId: number): number {
    return this.walkInSelections.get(typeId) || 0;
  }

  getWalkInTotal(): number {
    let total = 0;
    for (const [typeId, qty] of this.walkInSelections) {
      const type = this.walkInTypes.find(t => t.id === typeId);
      if (type) {
        total += type.price * qty;
      }
    }
    return total;
  }

  hasWalkInSelections(): boolean {
    return this.walkInSelections.size > 0;
  }

  /** Total quantity currently selected in this transaction */
  getWalkInSelectedTotal(): number {
    let total = 0;
    for (const qty of this.walkInSelections.values()) {
      total += qty;
    }
    return total;
  }

  /** Whether the general max count has been reached (considering sold + currently selected) */
  isWalkInMaxReached(): boolean {
    if (this.walkInMaxCount <= 0) return false;
    return (this.walkInTotalSoldCount + this.getWalkInSelectedTotal()) >= this.walkInMaxCount;
  }

  getWalkInRemainingCount(): number | null {
    if (this.walkInMaxCount <= 0) return null;
    return Math.max(0, this.walkInMaxCount - this.walkInTotalSoldCount);
  }

  registerWalkIn(): void {
    if (!this.scannerToken || !this.walkInPaymentMethod || !this.hasWalkInSelections()) return;

    const items: Array<{ walk_in_type_id: number; quantity: number }> = [];
    for (const [typeId, qty] of this.walkInSelections) {
      items.push({ walk_in_type_id: typeId, quantity: qty });
    }

    this.walkInLoading = true;
    this.publicService.scannerRegisterWalkIn(this.scannerToken, {
      payment_method: this.walkInPaymentMethod,
      payment_reference: this.walkInPaymentReference || undefined,
      items
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.walkInLoading = false;
        this.walkInRegistered = true;
        this.walkInRegisteredMessage = response.message;
        // Reset selections
        this.walkInSelections.clear();
        this.walkInPaymentReference = '';
        // Refresh types to update remaining counts
        this.loadWalkInTypes();
      },
      error: (error) => {
        if (error.status === 401 || error.status === 403) {
          this.handleScannerError(error);
        } else {
          this.showError(error.error?.error || 'Failed to register walk-in.');
        }
        this.walkInLoading = false;
      }
    });
  }

  resetWalkIn(): void {
    this.walkInRegistered = false;
    this.walkInRegisteredMessage = '';
    this.walkInSelections.clear();
    this.walkInPaymentReference = '';
  }

  formatWalkInPrice(price: number): string {
    if (!price || price === 0) return 'FREE';
    return '₱' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}