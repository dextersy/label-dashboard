import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ReleaseSubmittedService, ReleaseSubmittedModalData, ReleaseSubmittedModalState } from '../../../services/release-submitted.service';

@Component({
  selector: 'app-release-submitted-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './release-submitted-modal.component.html',
  styleUrls: ['./release-submitted-modal.component.scss']
})
export class ReleaseSubmittedModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isVisible = false;
  data: ReleaseSubmittedModalData | null = null;

  constructor(private releaseSubmittedService: ReleaseSubmittedService) {}

  ngOnInit() {
    this.releaseSubmittedService.modalState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: ReleaseSubmittedModalState) => {
        this.isVisible = state.isVisible;
        this.data = state.data;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.releaseSubmittedService.close();
  }
}