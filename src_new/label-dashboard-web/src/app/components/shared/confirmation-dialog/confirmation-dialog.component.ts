import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ConfirmationService, ConfirmationDialogData } from '../../../services/confirmation.service';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isVisible = false;
  data: ConfirmationDialogData | null = null;

  constructor(private confirmationService: ConfirmationService) {}

  ngOnInit(): void {
    this.confirmationService.dialogState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.isVisible = state.isVisible;
        this.data = state.data;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onConfirm(): void {
    this.confirmationService.handleConfirm();
  }

  onCancel(): void {
    this.confirmationService.handleCancel();
  }

  onBackdropClick(): void {
    // Close dialog when clicking on backdrop
    this.onCancel();
  }
}
