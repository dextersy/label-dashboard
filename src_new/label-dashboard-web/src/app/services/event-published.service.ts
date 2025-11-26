import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface EventPublishedModalData {
  eventTitle: string;
  buyLink: string;
}

export interface EventPublishedModalState {
  isVisible: boolean;
  data: EventPublishedModalData | null;
}

@Injectable({
  providedIn: 'root'
})
export class EventPublishedService {
  private modalStateSubject = new BehaviorSubject<EventPublishedModalState>({
    isVisible: false,
    data: null
  });

  public modalState$ = this.modalStateSubject.asObservable();

  /**
   * Show the event published modal
   */
  show(data: EventPublishedModalData): void {
    this.modalStateSubject.next({
      isVisible: true,
      data
    });
  }

  /**
   * Close the modal
   */
  close(): void {
    this.modalStateSubject.next({
      isVisible: false,
      data: null
    });
  }
}
