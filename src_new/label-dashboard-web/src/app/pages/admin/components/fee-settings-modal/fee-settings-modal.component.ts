import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, FeeSettings, FeeSettingsSection, FeePlan } from '../../../../services/admin.service';
import { NotificationService } from '../../../../services/notification.service';
import { AuthService } from '../../../../services/auth.service';
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

  // Whether to use a brand-level override for each fee category.
  overrideMusic: boolean = false;
  overrideEvent: boolean = false;
  overrideFundraiser: boolean = false;
  overrideMerch: boolean = false;

  // Whether each section is collapsed
  collapsedMusic: boolean = true;
  collapsedEvent: boolean = true;
  collapsedFundraiser: boolean = true;
  collapsedMerch: boolean = true;

  // Plan info for the brand
  planInfo: FeePlan | null = null;

  // Plan defaults shown as placeholder when override is disabled
  musicPlanDefault: FeeSettingsSection | null = null;
  eventPlanDefault: FeeSettingsSection | null = null;
  fundraiserPlanDefault: FeeSettingsSection | null = null;

  get isSuperAdmin(): boolean {
    return this.authService.currentUserValue?.is_superadmin ?? false;
  }

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private authService: AuthService
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
      }),
      merch: this.fb.group({
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
        this.planInfo = settings.plan ?? null;
        this.musicPlanDefault = settings.music.plan_default ?? null;
        this.eventPlanDefault = settings.event.plan_default ?? null;
        this.fundraiserPlanDefault = settings.fundraiser.plan_default ?? null;

        this.overrideMusic = settings.music.override !== null && settings.music.override !== undefined;
        this.overrideEvent = settings.event.override !== null && settings.event.override !== undefined;
        this.overrideFundraiser = settings.fundraiser.override !== null && settings.fundraiser.override !== undefined;
        this.overrideMerch = settings.merch?.override !== null && settings.merch?.override !== undefined;

        this.feeForm.patchValue({
          music: {
            transaction_fixed_fee: settings.music.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.music.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.music.fee_revenue_type ?? 'net'
          },
          event: {
            transaction_fixed_fee: settings.event.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.event.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.event.fee_revenue_type ?? 'net'
          },
          fundraiser: {
            transaction_fixed_fee: settings.fundraiser.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.fundraiser.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.fundraiser.fee_revenue_type ?? 'net'
          },
          merch: {
            transaction_fixed_fee: settings.merch?.transaction_fixed_fee ?? 0,
            revenue_percentage_fee: settings.merch?.revenue_percentage_fee ?? 0,
            fee_revenue_type: settings.merch?.fee_revenue_type ?? 'net'
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
          fundraiser: { transaction_fixed_fee: 0, revenue_percentage_fee: 0, fee_revenue_type: 'net' },
          merch: { transaction_fixed_fee: 0, revenue_percentage_fee: 0, fee_revenue_type: 'net' }
        });
      }
    });
  }

  getSectionSummary(category: 'music' | 'event' | 'fundraiser' | 'merch'): string {
    const override = category === 'music' ? this.overrideMusic
      : category === 'event' ? this.overrideEvent
      : category === 'fundraiser' ? this.overrideFundraiser
      : this.overrideMerch;

    if (!override) return 'Using plan default';

    const val = this.feeForm.get(category)?.value;
    if (!val) return 'Override active';

    const parts: string[] = [];
    if (val.transaction_fixed_fee > 0) parts.push(`₱${Number(val.transaction_fixed_fee).toFixed(2)} fixed`);
    if (val.revenue_percentage_fee > 0) parts.push(`${val.revenue_percentage_fee}% of ${val.fee_revenue_type}`);
    return parts.length > 0 ? parts.join(' + ') : 'Override active (no fees set)';
  }

  showPreview(): boolean {
    return this.showMusicPreview() || this.showEventPreview() || this.showFundraiserPreview() || this.showMerchPreview();
  }

  showMusicPreview(): boolean {
    if (!this.overrideMusic) return false;
    const music = this.feeForm.get('music')?.value;
    return music && (music.transaction_fixed_fee > 0 || music.revenue_percentage_fee > 0);
  }

  showEventPreview(): boolean {
    if (!this.overrideEvent) return false;
    const event = this.feeForm.get('event')?.value;
    return event && (event.transaction_fixed_fee > 0 || event.revenue_percentage_fee > 0);
  }

  showFundraiserPreview(): boolean {
    if (!this.overrideFundraiser) return false;
    const fundraiser = this.feeForm.get('fundraiser')?.value;
    return fundraiser && (fundraiser.transaction_fixed_fee > 0 || fundraiser.revenue_percentage_fee > 0);
  }

  showMerchPreview(): boolean {
    if (!this.overrideMerch) return false;
    const merch = this.feeForm.get('merch')?.value;
    return merch && (merch.transaction_fixed_fee > 0 || merch.revenue_percentage_fee > 0);
  }

  onSubmit(): void {
    if (this.feeForm.invalid || !this.brandId) {
      this.feeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const feeSettings = {
      music: this.overrideMusic ? this.feeForm.get('music')?.value : null,
      event: this.overrideEvent ? this.feeForm.get('event')?.value : null,
      fundraiser: this.overrideFundraiser ? this.feeForm.get('fundraiser')?.value : null,
      merch: this.overrideMerch ? this.feeForm.get('merch')?.value : null,
    };

    this.adminService.updateFeeSettings(this.brandId, feeSettings).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Fee settings updated successfully');
        this.saved.emit(response.feeSettings || {
          id: this.brandId!,
          plan: this.planInfo,
          music: feeSettings.music,
          event: feeSettings.event,
          fundraiser: feeSettings.fundraiser,
          merch: feeSettings.merch
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
