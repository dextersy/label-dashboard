import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-cancel-event-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header tw-border-b tw-border-red-100 tw-bg-red-50">
            <h5 class="modal-title tw-flex tw-items-center tw-gap-2 tw-text-red-700 tw-font-semibold">
              <app-icon name="x-circle" class="tw-text-red-500" />
              Cancel Event
            </h5>
            <button type="button" class="btn-close" (click)="cancelled.emit()"></button>
          </div>
          <div class="modal-body tw-space-y-4">
            <p class="tw-text-sm tw-text-gray-700">
              This will permanently cancel the event. It will be removed from the public
              listing and the ticket page will display a cancellation notice.
              <strong>This action cannot be undone</strong> — the event cannot be uncanceled or edited afterwards.
            </p>

            <ng-container *ngIf="hasRefundableTickets">
              <div class="tw-px-4 tw-py-3 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200 tw-text-sm tw-text-amber-800">
                There are <strong>{{ refundableTicketCount }}</strong> paid ticket(s) totaling
                <strong>₱{{ refundableAmount | number:'1.2-2' }}</strong>.
                Platform fees are non-refundable and will be absorbed by the organizer.
              </div>

              <label class="tw-flex tw-items-center tw-gap-3 tw-cursor-pointer">
                <input type="checkbox" class="form-check-input tw-mt-0" [(ngModel)]="refundTickets" />
                <span class="tw-text-sm tw-text-gray-800">Refund existing tickets via PayMongo</span>
              </label>

              <label class="tw-flex tw-items-center tw-gap-3 tw-cursor-pointer">
                <input type="checkbox" class="form-check-input tw-mt-0" [(ngModel)]="notifyTicketHolders" />
                <span class="tw-text-sm tw-text-gray-800">Notify ticket holders by email</span>
              </label>
            </ng-container>

            <ng-container *ngIf="!hasRefundableTickets">
              <p class="tw-text-sm tw-text-gray-500 tw-italic">There are no paid tickets to refund.</p>
              <label class="tw-flex tw-items-center tw-gap-3 tw-cursor-pointer">
                <input type="checkbox" class="form-check-input tw-mt-0" [(ngModel)]="notifyTicketHolders" />
                <span class="tw-text-sm tw-text-gray-800">Notify ticket holders by email</span>
              </label>
            </ng-container>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" (click)="cancelled.emit()">Cancel</button>
            <button
              type="button"
              class="btn-danger"
              (click)="onConfirm()">
              <app-icon name="x-circle" />
              Cancel Event
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CancelEventDialogComponent {
  @Input() refundableAmount = 0;
  @Input() refundableTicketCount = 0;
  @Input() hasRefundableTickets = false;

  @Output() confirmed = new EventEmitter<{ refundTickets: boolean; notifyTicketHolders: boolean }>();
  @Output() cancelled = new EventEmitter<void>();

  refundTickets = true;
  notifyTicketHolders = true;

  onConfirm(): void {
    this.confirmed.emit({
      refundTickets: this.refundTickets,
      notifyTicketHolders: this.notifyTicketHolders
    });
  }
}
