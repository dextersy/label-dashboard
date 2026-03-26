import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { ConfirmationService } from '../services/confirmation.service';

export interface HasUnsavedChanges {
  isFormDirty(): boolean;
}

export const canDeactivateUnsavedChanges: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (component.isFormDirty()) {
    const confirmationService = inject(ConfirmationService);
    return confirmationService.confirm({
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to leave?',
      confirmText: 'Leave',
      cancelText: 'Stay',
      type: 'warning',
      primaryAction: 'cancel'
    });
  }
  return true;
};
