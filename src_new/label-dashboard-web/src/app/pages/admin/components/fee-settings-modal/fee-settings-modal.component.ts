import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, FeeSettings, FeeSettingsSection } from '../../../../services/admin.service';
import { NotificationService } from '../../../../services/notification.service';
import { ModalToBodyDirective } from '../../../../directives/modal-to-body.directive';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
    selector: 'app-fee-settings-modal',
    imports: [CommonModule, ReactiveFormsModule, ModalToBodyDirective, IconComponent],
    templateUrl: './fee-settings-modal.component.html',
    styleUrls: ['./fee-settings-modal.component.scss']
})
export class FeeSettingsModalComponent implements OnInit, OnChanges {
  @Input() show: boolean = false;
  @Input() brandId: number | null = null;
  @Input() sublabelName: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<FeeSettings>();

  feeForm!: FormGroup;
  loading: boolean = false;

  // Whether to use a brand-level override for event/fundraiser fees.
  // When false, null is sent to the API so the brand follows its plan's defaults.
  overrideEvent: boolean = false;
  overrideFundraiser: boolean = false;

  // Plan defaults shown as placeholder when override is disabled
  eventPlanDefault: FeeSettingsSection | null = null;
  fundraiserPlanDefault: FeeSettingsSection | null = null;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && changes['show'].currentValue && this.brandId) {
      this.loadFeeSettings();
    }
  }

  private initializeForm(): void {
    this.feeForm = this.fb.group({
      music: this.fb.group({
        transaction_fixed_fee: [0, [Validators.min(0)]],
        revenue_percentage_fee: [0, [Validators.min(0), Validators.max(100)]],
        fee_revenue_type: ['net', [Validators.required]]
      }),
      event: this.fb.group({
        transaction_fixed_fee: [0, [Validators.min(0)]],
        revenue_percentage_fee: [0, [Validators.min(0), Validators.max(100)]],
        fee_revenue_type: ['net', [Validators.required]]
      }),
      fundraiser: this.fb.group({
        transaction_fixed_fee: [0, [Validators.min(0)]],
        revenue_percentage_fee: [0, [Validators.min(0), Validators.max(100)]],
        fee_revenue_type: ['net', [Validators.required]]
      })
    });
  }

  private loadFeeSettings(): void {
    if (!this.brandId) return;

    this.loading = true;
    this.adminService.getFeeSettings(this.brandId).subscribe({
      next: (settings) => {
        this.feeForm.patchValue({
          music: {
            transaction_fixed_fee: settings.music.transaction_fixed_fee || 0,
            revenue_percentage_fee: settings.music.revenue_percentage_fee || 0,
            fee_revenue_type: settings.music.fee_revenue_type || 'net'
          }
        });

        // Store plan defaults for display
        this.eventPlanDefault = settings.event.plan_default ?? null;
        this.fundraiserPlanDefault = settings.fundraiser.plan_default ?? null;

        // Override is active when the API returns a non-null override object
        this.overrideEvent = settings.event.override !== null && settings.event.override !== undefined;
        this.overrideFundraiser = settings.fundraiser.override !== null && settings.fundraiser.override !== undefined;

        // Populate override form fields with current effective values (override if set, else plan default)
        this.feeForm.patchValue({
          event: {
            transaction_fixed_fee: settings.event.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.event.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.event.fee_revenue_type ?? 'net'
          },
          fundraiser: {
            transaction_fixed_fee: settings.fundraiser.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.fundraiser.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.fundraiser.fee_revenue_type ?? 'net'
          }
        });

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading fee settings:', error);
        this.notificationService.showError('Failed to load fee settings');
        this.loading = false;
        this.feeForm.patchValue({
          music: { transaction_fixed_fee: 0, revenue_percentage_fee: 0, fee_revenue_type: 'net' },
          event: { transaction_fixed_fee: 0, revenue_percentage_fee: 0, fee_revenue_type: 'net' },
          fundraiser: { transaction_fixed_fee: 0, revenue_percentage_fee: 0, fee_revenue_type: 'net' }
        });
      }
    });
  }

  showPreview(): boolean {
    return this.showMusicPreview() || this.showEventPreview() || this.showFundraiserPreview();
  }

  showMusicPreview(): boolean {
    const music = this.feeForm.get('music')?.value;
    if (!music) return false;
    return music.transaction_fixed_fee > 0 || music.revenue_percentage_fee > 0;
  }

  showEventPreview(): boolean {
    if (!this.overrideEvent) return false;
    const event = this.feeForm.get('event')?.value;
    if (!event) return false;
    return event.transaction_fixed_fee > 0 || event.revenue_percentage_fee > 0;
  }

  showFundraiserPreview(): boolean {
    if (!this.overrideFundraiser) return false;
    const fundraiser = this.feeForm.get('fundraiser')?.value;
    if (!fundraiser) return false;
    return fundraiser.transaction_fixed_fee > 0 || fundraiser.revenue_percentage_fee > 0;
  }

  onSubmit(): void {
    if (this.feeForm.invalid || !this.brandId) {
      this.feeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const feeSettings = {
      music: this.feeForm.get('music')?.value,
      // Send null to clear override (follow plan); send values to set override
      event: this.overrideEvent ? this.feeForm.get('event')?.value : null,
      fundraiser: this.overrideFundraiser ? this.feeForm.get('fundraiser')?.value : null,
    };

    this.adminService.updateFeeSettings(this.brandId, feeSettings).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Fee settings updated successfully');
        this.saved.emit(response.feeSettings || {
          id: this.brandId!,
          music: feeSettings.music,
          event: feeSettings.event,
          fundraiser: feeSettings.fundraiser
        });
        this.onClose();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error updating fee settings:', error);
        const errorMessage = error.error?.error || 'Failed to update fee settings';
        this.notificationService.showError(errorMessage);
        this.loading = false;
      }
    });
  }

  onClose(): void {
    if (!this.loading) {
      this.close.emit();
    }
  }

  resetForm(): void {
    this.initializeForm();
  }
}
