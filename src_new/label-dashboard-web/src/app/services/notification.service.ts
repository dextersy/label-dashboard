import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  clickable?: boolean;
  clickAction?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<NotificationMessage | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  showSuccess(message: string, clickAction?: () => void, duration?: number): void {
    this.notificationSubject.next({
      type: 'success',
      message,
      duration,
      clickable: !!clickAction,
      clickAction
    });
  }

  showError(message: string, clickAction?: () => void, duration?: number): void {
    this.notificationSubject.next({
      type: 'error',
      message,
      duration,
      clickable: !!clickAction,
      clickAction
    });
  }

  showInfo(message: string, clickAction?: () => void, duration?: number): void {
    this.notificationSubject.next({
      type: 'info',
      message,
      duration,
      clickable: !!clickAction,
      clickAction
    });
  }

  showWarning(message: string, clickAction?: () => void, duration?: number): void {
    this.notificationSubject.next({
      type: 'warning',
      message,
      duration,
      clickable: !!clickAction,
      clickAction
    });
  }

  clear(): void {
    this.notificationSubject.next(null);
  }
}