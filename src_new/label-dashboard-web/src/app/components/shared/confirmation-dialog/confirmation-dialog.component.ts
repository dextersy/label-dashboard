import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ConfirmationService, ConfirmationDialogData } from '../../../services/confirmation.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [CommonModule, IconComponent],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private previouslyFocusedElement: HTMLElement | null = null;

  @ViewChild('confirmButton') confirmButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLDivElement>;

  isVisible = false;
  data: ConfirmationDialogData | null = null;

  constructor(private confirmationService: ConfirmationService) {}

  ngOnInit(): void {
    this.confirmationService.dialogState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const wasVisible = this.isVisible;
        this.isVisible = state.isVisible;
        this.data = state.data;

        // Prevent body scrolling when dialog is open
        if (state.isVisible) {
          // Store the currently focused element before opening dialog
          this.previouslyFocusedElement = document.activeElement as HTMLElement;
          document.body.classList.add('modal-open');

          // Focus the confirm button after the view updates
          setTimeout(() => {
            this.confirmButton?.nativeElement.focus();
          }, 0);
        } else {
          document.body.classList.remove('modal-open');

          // Restore focus to the previously focused element
          if (this.previouslyFocusedElement && !wasVisible) {
            setTimeout(() => {
              this.previouslyFocusedElement?.focus();
              this.previouslyFocusedElement = null;
            }, 0);
          }
        }
      });
  }

  ngOnDestroy(): void {
    // Ensure modal-open class is removed on component destroy
    document.body.classList.remove('modal-open');
    this.destroy$.next();
    this.destroy$.complete();
  }

  onConfirm(): void {
    this.confirmationService.handleConfirm();
  }

  onCancel(): void {
    this.confirmationService.handleCancel();
  }

  getConfirmClass(): string {
    switch (this.data?.type) {
      case 'danger':  return 'cd-btn-danger';
      case 'warning': return 'cd-btn-warning';
      default:        return 'cd-btn-info';
    }
  }

  getCancelPrimaryClass(): string {
    return this.getConfirmClass();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close if the click was directly on the backdrop element
    // This prevents unexpected closures from event propagation
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  /**
   * Handle Escape key to close the modal
   */
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.isVisible && event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
    }
  }

  /**
   * Handle keyboard events for focus trap
   */
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isVisible) return;

    // Implement focus trap on Tab key
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /**
   * Trap focus within the modal dialog
   */
  private trapFocus(event: KeyboardEvent): void {
    if (!this.modalDialog) return;

    const focusableElements = this.modalDialog.nativeElement.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }
}
