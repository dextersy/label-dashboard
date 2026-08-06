import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChildBrand } from '../../../../services/admin.service';
import { AdminService } from '../../../../services/admin.service';
import { ReleaseService, Release } from '../../../../services/release.service';
import { NotificationService } from '../../../../services/notification.service';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-sublabel-add-earning-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './sublabel-add-earning-modal.component.html'
})
export class SublabelAddEarningModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() childBrand: ChildBrand | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() earningAdded = new EventEmitter<void>();

  releases: Release[] = [];
  loading: boolean = false;
  submitting: boolean = false;

  form = {
    release_id: '',
    type: 'Streaming',
    amount: null as number | null,
    description: '',
    date_recorded: new Date().toISOString().split('T')[0],
    calculate_royalties: true
  };

  constructor(
    private adminService: AdminService,
    private releaseService: ReleaseService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.childBrand) {
      this.loadReleases();
      this.resetForm();
    }
  }

  private loadReleases(): void {
    if (!this.childBrand) return;
    this.loading = true;
    this.releaseService.getReleasesByChildBrand(this.childBrand.brand_id).subscribe({
      next: (response) => {
        this.releases = response.releases;
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load releases');
        this.loading = false;
      }
    });
  }

  private resetForm(): void {
    this.form = {
      release_id: '',
      type: 'Streaming',
      amount: null,
      description: '',
      date_recorded: new Date().toISOString().split('T')[0],
      calculate_royalties: true
    };
  }

  onSubmit(): void {
    if (!this.form.release_id || !this.form.amount || !this.form.date_recorded) {
      this.notificationService.showError('Release, amount, and date are required');
      return;
    }

    this.submitting = true;
    this.adminService.createEarning({
      release_id: parseInt(this.form.release_id),
      type: this.form.type,
      amount: this.form.amount,
      description: this.form.description,
      date_recorded: this.form.date_recorded,
      calculate_royalties: this.form.calculate_royalties
    }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Earning added successfully');
        this.submitting = false;
        this.earningAdded.emit();
        this.onClose();
      },
      error: (error) => {
        this.notificationService.showError(error.error?.error || 'Failed to add earning');
        this.submitting = false;
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  formatReleaseOption(release: Release): string {
    return `${release.catalog_no} : ${release.title}`;
  }
}
