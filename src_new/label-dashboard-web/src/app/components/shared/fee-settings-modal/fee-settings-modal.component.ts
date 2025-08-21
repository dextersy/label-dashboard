import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, FeeSettings, FeeSettingsSection } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-fee-settings-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
      monthly_fee: [{value: 0, disabled: true}, [Validators.min(0)]],
      music: this.fb.group({
        transaction_fixed_fee: [0, [Validators.min(0)]],
        revenue_percentage_fee: [0, [Validators.min(0), Validators.max(100)]],
        fee_revenue_type: ['net', [Validators.required]]
      }),
      event: this.fb.group({
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
        // Set the monthly fee value for disabled control
        this.feeForm.get('monthly_fee')?.setValue(settings.monthly_fee || 0);
        
        this.feeForm.patchValue({
          music: {
            transaction_fixed_fee: settings.music.transaction_fixed_fee || 0,
            revenue_percentage_fee: settings.music.revenue_percentage_fee || 0,
            fee_revenue_type: settings.music.fee_revenue_type || 'net'
          },
          event: {
            transaction_fixed_fee: settings.event.transaction_fixed_fee || 0,
            revenue_percentage_fee: settings.event.revenue_percentage_fee || 0,
            fee_revenue_type: settings.event.fee_revenue_type || 'net'
          }
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading fee settings:', error);
        this.notificationService.showError('Failed to load fee settings');
        this.loading = false;
        // Initialize with default values on error
        this.feeForm.get('monthly_fee')?.setValue(0);
        
        this.feeForm.patchValue({
          music: {
            transaction_fixed_fee: 0,
            revenue_percentage_fee: 0,
            fee_revenue_type: 'net'
          },
          event: {
            transaction_fixed_fee: 0,
            revenue_percentage_fee: 0,
            fee_revenue_type: 'net'
          }
        });
      }
    });
  }

  showPreview(): boolean {
    return this.showMonthlyPreview() || this.showMusicPreview() || this.showEventPreview();
  }

  showMonthlyPreview(): boolean {
    const monthlyFeeControl = this.feeForm.get('monthly_fee');
    const monthlyFee = monthlyFeeControl?.value;
    return monthlyFee > 0;
  }

  showMusicPreview(): boolean {
    const music = this.feeForm.get('music')?.value;
    if (!music) return false;
    return (music.transaction_fixed_fee > 0) || 
           (music.revenue_percentage_fee > 0);
  }

  showEventPreview(): boolean {
    const event = this.feeForm.get('event')?.value;
    if (!event) return false;
    return (event.transaction_fixed_fee > 0) || 
           (event.revenue_percentage_fee > 0);
  }

  onSubmit(): void {
    if (this.feeForm.invalid || !this.brandId) {
      this.feeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const feeSettings = {
      monthly_fee: this.feeForm.get('monthly_fee')?.value || 0,
      music: this.feeForm.get('music')?.value,
      event: this.feeForm.get('event')?.value
    };

    this.adminService.updateFeeSettings(this.brandId, feeSettings).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Fee settings updated successfully');
        this.saved.emit(response.feeSettings || {
          id: this.brandId!,
          monthly_fee: feeSettings.monthly_fee,
          music: feeSettings.music,
          event: feeSettings.event
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