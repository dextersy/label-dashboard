import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudienceSocialService } from '../../services/audience-social.service';
import { ConnectionMeta } from '../../models/audience-connection';

@Component({
  selector: 'app-connect-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (connection()) {
      @if (connection()!.status === 'accepted') {
        <button type="button" (click)="disconnect()"
          [disabled]="loading()"
          class="px-3 py-1.5 border border-white/20 text-[10px] font-mono text-white/40 uppercase tracking-wider hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50">
          {{ loading() ? '...' : 'Connected' }}
        </button>
      } @else if (connection()!.status === 'pending' && connection()!.i_am_requester) {
        <button type="button" (click)="cancelRequest()"
          [disabled]="loading()"
          class="px-3 py-1.5 border border-white/20 text-[10px] font-mono text-white/30 uppercase tracking-wider hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50">
          {{ loading() ? '...' : 'Pending' }}
        </button>
      } @else if (connection()!.status === 'pending' && !connection()!.i_am_requester) {
        <div class="flex gap-1.5">
          <button type="button" (click)="accept()"
            [disabled]="loading()"
            class="px-3 py-1.5 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider hover:bg-yellow-300 transition-colors disabled:opacity-50">
            {{ loading() ? '...' : 'Accept' }}
          </button>
          <button type="button" (click)="decline()"
            [disabled]="loading()"
            class="px-3 py-1.5 border border-white/20 text-[10px] font-mono text-white/40 uppercase tracking-wider hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50">
            Decline
          </button>
        </div>
      }
    } @else {
      <button type="button" (click)="sendRequest()"
        [disabled]="loading()"
        class="px-3 py-1.5 border border-white/20 text-[10px] font-mono text-white/60 uppercase tracking-wider hover:border-yellow-400/50 hover:text-yellow-400 transition-colors disabled:opacity-50">
        {{ loading() ? '...' : '+ Connect' }}
      </button>
    }
  `,
})
export class ConnectButtonComponent {
  @Input() userId!: number;
  @Input() set connectionMeta(value: ConnectionMeta | null) {
    this.connection.set(value);
  }
  @Output() connectionChanged = new EventEmitter<ConnectionMeta | null>();

  connection = signal<ConnectionMeta | null>(null);
  loading = signal(false);

  constructor(private socialService: AudienceSocialService) {}

  sendRequest(): void {
    this.loading.set(true);
    this.socialService.sendRequest(this.userId).subscribe({
      next: (res) => {
        const meta: ConnectionMeta = { connection_id: res.connection_id, status: 'pending', i_am_requester: true };
        this.connection.set(meta);
        this.connectionChanged.emit(meta);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  accept(): void {
    const conn = this.connection();
    if (!conn) return;
    this.loading.set(true);
    this.socialService.acceptRequest(conn.connection_id).subscribe({
      next: () => {
        const meta: ConnectionMeta = { ...conn, status: 'accepted' };
        this.connection.set(meta);
        this.connectionChanged.emit(meta);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  decline(): void {
    const conn = this.connection();
    if (!conn) return;
    this.loading.set(true);
    this.socialService.declineRequest(conn.connection_id).subscribe({
      next: () => {
        this.connection.set(null);
        this.connectionChanged.emit(null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  cancelRequest(): void {
    const conn = this.connection();
    if (!conn) return;
    this.loading.set(true);
    this.socialService.declineRequest(conn.connection_id).subscribe({
      next: () => {
        this.connection.set(null);
        this.connectionChanged.emit(null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  disconnect(): void {
    const conn = this.connection();
    if (!conn) return;
    this.loading.set(true);
    this.socialService.removeConnection(conn.connection_id).subscribe({
      next: () => {
        this.connection.set(null);
        this.connectionChanged.emit(null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
