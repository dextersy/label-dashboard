import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionMonitorService } from '../../services/connection-monitor.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-connection-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!(isConnected$ | async)" class="connection-overlay">
      <div class="connection-message">
        <div class="spinner-border text-light mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <h4 class="text-white mb-2">Lost your connection</h4>
        <p class="text-white-50 mb-0">Please check your internet connection.<br>This page will automatically refresh once we get a connection.</p>
      </div>
    </div>
  `,
  styles: [`
    .connection-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .connection-message {
      text-align: center;
      padding: 2rem;
      background-color: rgba(0, 0, 0, 0.9);
      border-radius: 10px;
      border: 2px solid rgba(255, 255, 255, 0.1);
    }

    .spinner-border {
      width: 3rem;
      height: 3rem;
    }

    h4 {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    p {
      font-size: 1rem;
      margin-bottom: 0;
    }
  `]
})
export class ConnectionOverlayComponent {
  isConnected$: Observable<boolean>;

  constructor(private connectionMonitor: ConnectionMonitorService) {
    this.isConnected$ = this.connectionMonitor.isConnected$;
  }
}