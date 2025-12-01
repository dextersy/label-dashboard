import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ReleaseSubmittedModalData {
  releaseTitle: string;
  message: string;
}

export interface ReleaseSubmittedModalState {
  isVisible: boolean;
  data: ReleaseSubmittedModalData | null;
}

@Injectable({
  providedIn: 'root'
})
export class ReleaseSubmittedService {
  private modalStateSubject = new BehaviorSubject<ReleaseSubmittedModalState>({
    isVisible: false,
    data: null
  });

  public modalState$ = this.modalStateSubject.asObservable();

  /**
   * Show the release submitted modal
   */
  show(data: ReleaseSubmittedModalData): void {
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