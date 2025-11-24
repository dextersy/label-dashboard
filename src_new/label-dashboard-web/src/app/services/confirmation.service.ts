import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface ConfirmationDialogState {
  isVisible: boolean;
  data: ConfirmationDialogData | null;
  resolve: ((value: boolean) => void) | null;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private dialogStateSubject = new BehaviorSubject<ConfirmationDialogState>({
    isVisible: false,
    data: null,
    resolve: null
  });

  public dialogState$ = this.dialogStateSubject.asObservable();

  /**
   * Show a confirmation dialog and return a promise that resolves to true/false
   */
  confirm(data: ConfirmationDialogData): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogStateSubject.next({
        isVisible: true,
        data: {
          confirmText: 'Yes',
          cancelText: 'No',
          type: 'warning',
          ...data
        },
        resolve
      });
    });
  }

  /**
   * Handle user confirmation
   */
  handleConfirm(): void {
    const state = this.dialogStateSubject.value;
    if (state.resolve) {
      state.resolve(true);
    }
    this.close();
  }

  /**
   * Handle user cancellation
   */
  handleCancel(): void {
    const state = this.dialogStateSubject.value;
    if (state.resolve) {
      state.resolve(false);
    }
    this.close();
  }

  /**
   * Close the dialog
   */
  private close(): void {
    this.dialogStateSubject.next({
      isVisible: false,
      data: null,
      resolve: null
    });
  }
}
