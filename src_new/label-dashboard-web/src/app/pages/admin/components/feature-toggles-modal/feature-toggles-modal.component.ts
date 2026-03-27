import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, FeatureToggles } from '../../../../services/admin.service';
import { NotificationService } from '../../../../services/notification.service';
import { ModalToBodyDirective } from '../../../../directives/modal-to-body.directive';

@Component({
  selector: 'app-feature-toggles-modal',
  imports: [CommonModule, ModalToBodyDirective],
  templateUrl: './feature-toggles-modal.component.html',
  styleUrls: ['./feature-toggles-modal.component.scss']
})
export class FeatureTogglesModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() brandId: number | null = null;
  @Input() sublabelName: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<FeatureToggles>();

  loading: boolean = false;
  saving: boolean = false;

  toggles: FeatureToggles = {
    feature_music_workspace: true,
    feature_campaigns_workspace: true,
    feature_sublabels: true
  };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && changes['show'].currentValue && this.brandId) {
      this.loadFeatureToggles();
    }
  }

  private loadFeatureToggles(): void {
    if (!this.brandId) return;

    this.loading = true;
    this.adminService.getFeatureToggles(this.brandId).subscribe({
      next: (toggles) => {
        this.toggles = { ...toggles };
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading feature toggles:', error);
        this.notificationService.showError('Failed to load feature settings');
        this.loading = false;
      }
    });
  }

  toggleFeature(feature: keyof FeatureToggles): void {
    this.toggles = { ...this.toggles, [feature]: !this.toggles[feature] };
  }

  onSave(): void {
    if (!this.brandId) return;

    this.saving = true;
    this.adminService.updateFeatureToggles(this.brandId, this.toggles).subscribe({
      next: () => {
        this.notificationService.showSuccess('Feature settings updated successfully');
        this.saved.emit(this.toggles);
        this.onClose();
        this.saving = false;
      },
      error: (error) => {
        console.error('Error updating feature toggles:', error);
        const errorMessage = error.error?.error || 'Failed to update feature settings';
        this.notificationService.showError(errorMessage);
        this.saving = false;
      }
    });
  }

  onClose(): void {
    if (!this.loading && !this.saving) {
      this.close.emit();
    }
  }
}
