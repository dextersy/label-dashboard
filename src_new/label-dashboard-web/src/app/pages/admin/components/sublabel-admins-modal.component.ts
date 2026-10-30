import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService } from '../../../services/confirmation.service';
import { IconComponent } from '../../../components/shared/icon/icon.component';

interface SublabelAdminUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email_address: string;
  is_admin: boolean;
  last_logged_in: string | null;
  has_pending_invite: boolean;
}

@Component({
  selector: 'app-sublabel-admins-modal',
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="modal fade show" style="display: block" tabindex="-1" role="dialog" (click)="onBackdropClick($event)" *ngIf="show">
      <div class="modal-dialog modal-dialog-centered modal-lg" role="document" (click)="$event.stopPropagation()">
        <div class="modal-content">

          <div class="modal-header tw-items-start">
            <div>
              <h5 class="modal-title tw-mb-0">Manage Admins</h5>
              <p class="tw-text-sm tw-text-muted tw-mb-0 tw-mt-0.5">{{ sublabelName }}</p>
            </div>
            <button type="button" class="btn-close tw-mt-1" (click)="onClose()"></button>
          </div>

          <div class="modal-body tw-flex tw-flex-col tw-gap-4 tw-pb-2">

            <!-- Loading state -->
            <div *ngIf="loading && admins.length === 0" class="tw-flex tw-justify-center tw-py-8">
              <div class="spinner-border text-secondary spinner-border-sm" role="status"></div>
            </div>

            <!-- Admins list -->
            <div *ngIf="!loading || admins.length > 0">
              <div *ngIf="admins.length === 0" class="tw-text-center tw-text-muted tw-py-6 tw-text-sm">
                No admins found for this sublabel.
              </div>

              <div *ngFor="let admin of admins" class="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-py-2.5 tw-border-b tw-border-gray-100 last:tw-border-0">
                <div class="tw-flex tw-items-center tw-gap-3 tw-min-w-0">
                  <span class="tw-inline-flex tw-items-center tw-justify-center tw-w-8 tw-h-8 tw-rounded-full tw-text-white tw-text-xs tw-font-bold tw-shrink-0"
                        [style.background]="getAvatarColor(getDisplayName(admin))">
                    {{ getInitials(getDisplayName(admin)) }}
                  </span>
                  <div class="tw-min-w-0">
                    <div class="tw-text-sm tw-font-medium tw-truncate">
                      <span *ngIf="admin.has_pending_invite" class="tw-text-muted tw-italic">(Pending Invite)</span>
                      <span *ngIf="!admin.has_pending_invite">{{ getDisplayName(admin) }}</span>
                    </div>
                    <div class="tw-text-xs tw-text-muted tw-truncate">{{ admin.email_address }}</div>
                  </div>
                </div>
                <div class="tw-flex tw-items-center tw-gap-2 tw-shrink-0">
                  <span *ngIf="admin.has_pending_invite" class="status-badge status-warning">Pending</span>
                  <span *ngIf="!admin.has_pending_invite" class="status-badge status-success">Admin</span>
                  <button *ngIf="admin.has_pending_invite"
                          type="button"
                          class="btn btn-sm btn-outline-secondary tw-py-0.5"
                          title="Resend invitation"
                          [disabled]="actionLoading === admin.id"
                          (click)="resendInvite(admin)">
                    <app-icon *ngIf="actionLoading === admin.id" name="spinner" />
                    <app-icon *ngIf="actionLoading !== admin.id" name="envelope" />
                  </button>
                  <button type="button"
                          class="btn btn-sm btn-outline-danger tw-py-0.5"
                          [title]="admin.has_pending_invite ? 'Cancel invitation' : 'Remove admin rights'"
                          [disabled]="actionLoading === admin.id"
                          (click)="removeAdmin(admin)">
                    <app-icon *ngIf="actionLoading === admin.id" name="spinner" />
                    <app-icon *ngIf="actionLoading !== admin.id" name="ban" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Invite form -->
            <div class="tw-border-t tw-border-gray-100 tw-pt-4 tw-mt-2" *ngIf="!showInviteForm">
              <button type="button" class="btn btn-primary btn-sm" (click)="showInviteForm = true">
                <app-icon name="user-plus" class="tw-mr-1" /> Invite Admin
              </button>
            </div>

            <div class="tw-border tw-border-gray-200 tw-rounded-lg tw-p-4 tw-bg-gray-50" *ngIf="showInviteForm">
              <h6 class="tw-font-semibold tw-text-sm tw-mb-3">Invite New Admin</h6>
              <div class="tw-flex tw-flex-col tw-gap-3">
                <div>
                  <label class="form-label tw-text-sm">Email Address <span class="tw-text-danger">*</span></label>
                  <input type="email" class="form-control form-control-sm" placeholder="admin@example.com" [(ngModel)]="inviteForm.email_address" />
                </div>
                <div class="tw-grid tw-grid-cols-2 tw-gap-3">
                  <div>
                    <label class="form-label tw-text-sm">First Name</label>
                    <input type="text" class="form-control form-control-sm" placeholder="Optional" [(ngModel)]="inviteForm.first_name" />
                  </div>
                  <div>
                    <label class="form-label tw-text-sm">Last Name</label>
                    <input type="text" class="form-control form-control-sm" placeholder="Optional" [(ngModel)]="inviteForm.last_name" />
                  </div>
                </div>
                <div class="tw-flex tw-gap-2">
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="inviteLoading" (click)="sendInvite()">
                    <app-icon *ngIf="inviteLoading" name="spinner" class="tw-mr-1" />
                    {{ inviteLoading ? 'Sending...' : 'Send Invitation' }}
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" [disabled]="inviteLoading" (click)="cancelInviteForm()">Cancel</button>
                </div>
              </div>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="onClose()">Close</button>
          </div>

        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" *ngIf="show" (click)="onClose()"></div>
  `
})
export class SublabelAdminsModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() sublabelId: number | null = null;
  @Input() sublabelName: string = '';
  @Output() close = new EventEmitter<void>();

  admins: SublabelAdminUser[] = [];
  loading: boolean = false;
  actionLoading: number | null = null;

  showInviteForm: boolean = false;
  inviteLoading: boolean = false;
  inviteForm = { email_address: '', first_name: '', last_name: '' };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.sublabelId) {
      this.loadAdmins();
    }
    if (changes['show'] && !this.show) {
      this.admins = [];
      this.showInviteForm = false;
      this.inviteForm = { email_address: '', first_name: '', last_name: '' };
    }
  }

  async loadAdmins(): Promise<void> {
    if (!this.sublabelId) return;
    this.loading = true;
    try {
      const response = await firstValueFrom(this.adminService.getSublabelAdmins(this.sublabelId));
      const users = response?.data ?? response ?? [];
      this.admins = users.map((u: any) => ({
        ...u,
        has_pending_invite: u.has_pending_invite ?? (!u.username || u.username === '(Pending Invite)')
      }));
    } catch {
      this.notificationService.showError('Failed to load admins');
    } finally {
      this.loading = false;
    }
  }

  async resendInvite(admin: SublabelAdminUser): Promise<void> {
    if (!this.sublabelId) return;
    this.actionLoading = admin.id;
    try {
      await firstValueFrom(this.adminService.resendSublabelAdminInvite(this.sublabelId, admin.id));
      this.notificationService.showSuccess('Invitation resent');
    } catch (err: any) {
      this.notificationService.showError(err?.error?.error || 'Failed to resend invitation');
    } finally {
      this.actionLoading = null;
    }
  }

  async removeAdmin(admin: SublabelAdminUser): Promise<void> {
    if (!this.sublabelId) return;
    const confirmed = await this.confirmationService.confirm({
      title: admin.has_pending_invite ? 'Cancel Invitation' : 'Remove Admin Rights',
      message: admin.has_pending_invite
        ? `Cancel the invitation for ${admin.email_address}?`
        : `Remove admin rights for ${this.getDisplayName(admin)} (${admin.email_address})?`,
      confirmText: admin.has_pending_invite ? 'Cancel Invitation' : 'Remove Admin',
      cancelText: 'Keep',
      type: 'danger'
    });
    if (!confirmed) return;

    this.actionLoading = admin.id;
    try {
      if (admin.has_pending_invite) {
        await firstValueFrom(this.adminService.cancelSublabelAdminInvite(this.sublabelId, admin.id));
        this.notificationService.showSuccess('Invitation cancelled');
        this.admins = this.admins.filter(a => a.id !== admin.id);
      } else {
        await firstValueFrom(this.adminService.removeSublabelAdmin(this.sublabelId, admin.id));
        this.notificationService.showSuccess('Admin rights removed');
        await this.loadAdmins();
      }
    } catch (err: any) {
      this.notificationService.showError(err?.error?.error || 'Failed to remove admin');
    } finally {
      this.actionLoading = null;
    }
  }

  sendInvite(): void {
    if (!this.inviteForm.email_address.trim()) {
      this.notificationService.showError('Email address is required');
      return;
    }
    if (!this.sublabelId) return;

    this.inviteLoading = true;
    this.adminService.inviteSublabelAdmin(this.sublabelId, this.inviteForm).subscribe({
      next: () => {
        this.notificationService.showSuccess('Admin invitation sent successfully');
        this.cancelInviteForm();
        this.loadAdmins();
        this.inviteLoading = false;
      },
      error: (err) => {
        this.inviteLoading = false;
        this.notificationService.showError(err?.error?.error || 'Failed to send invitation');
      }
    });
  }

  cancelInviteForm(): void {
    this.showInviteForm = false;
    this.inviteForm = { email_address: '', first_name: '', last_name: '' };
  }

  getDisplayName(admin: SublabelAdminUser): string {
    const parts = [admin.first_name, admin.last_name].filter(p => !!p);
    return parts.length ? parts.join(' ') : (admin.username || admin.email_address);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColorIndex(name: string): number {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 8;
  }

  getAvatarColor(name: string): string {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];
    return colors[this.getAvatarColorIndex(name)];
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) this.onClose();
  }
}
