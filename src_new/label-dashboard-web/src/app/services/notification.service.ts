import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<NotificationMessage | null>(null);
  public notification$ = this.notificationSubject.asObservable();

  showSuccess(message: string): void {
    this.notificationSubject.next({ type: 'success', message });
  }

  showError(message: string): void {
    this.notificationSubject.next({ type: 'error', message });
  }

  showInfo(message: string): void {
    this.notificationSubject.next({ type: 'info', message });
  }

  showWarning(message: string): void {
    this.notificationSubject.next({ type: 'warning', message });
  }

  clear(): void {
    this.notificationSubject.next(null);
  }
}