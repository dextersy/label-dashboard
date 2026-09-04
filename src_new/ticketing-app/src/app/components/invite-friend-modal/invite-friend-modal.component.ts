import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudienceAuthService } from '../../services/audience-auth.service';

@Component({
  selector: 'app-invite-friend-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div class="fixed inset-0 bg-black/75" (click)="onClose()"></div>
      <div class="relative bg-black border-2 border-white/20 shadow-2xl p-6 w-full max-w-sm">

        <!-- Header -->
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-sm font-black text-white uppercase tracking-widest">Invite a Friend</h2>
          <button (click)="onClose()" class="text-white/40 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <p class="text-[11px] font-mono text-white/35 mb-6">
          They'll get a sign-up link. You earn +10 pts when they verify.
        </p>

        @if (sent()) {
          <div class="border border-green-500/30 bg-green-500/10 px-4 py-4 text-center">
            <svg class="w-6 h-6 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <p class="text-sm font-black text-green-400 uppercase tracking-wider mb-0.5">Invite sent!</p>
            <p class="text-xs font-mono text-green-400/70">{{ sentEmail() }}</p>
          </div>
          <button type="button" (click)="reset()"
            class="mt-4 w-full px-4 py-2.5 border border-white/20 text-xs font-mono text-white/60 uppercase tracking-wider hover:border-white/40 hover:text-white transition-colors">
            Invite another
          </button>
        } @else {
          <form (ngSubmit)="send()" #f="ngForm">
            <label class="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Friend's Email
            </label>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              placeholder="friend@example.com"
              [disabled]="sending()"
              class="w-full px-3 py-2.5 bg-black border border-white/20 text-sm font-mono text-white focus:outline-none focus:border-yellow-400 placeholder-white/20 disabled:opacity-50 mb-3">

            @if (errorMsg()) {
              <p class="text-xs font-mono text-red-400 mb-3">{{ errorMsg() }}</p>
            }

            <button type="submit" [disabled]="sending() || !email.trim()"
              class="w-full px-4 py-3 bg-yellow-400 text-black text-xs font-black uppercase tracking-wider hover:bg-yellow-300 transition-colors disabled:opacity-50">
              {{ sending() ? 'Sending...' : 'Send Invite' }}
            </button>
          </form>
        }

      </div>
    </div>
  `
})
export class InviteFriendModalComponent {
  @Input() referralCode = '';
  @Output() close = new EventEmitter<void>();

  email = '';
  sending = signal(false);
  sent = signal(false);
  sentEmail = signal('');
  errorMsg = signal('');

  constructor(private audienceAuthService: AudienceAuthService) {}

  onClose(): void {
    if (!this.sending()) this.close.emit();
  }

  send(): void {
    const trimmed = this.email.trim();
    if (!trimmed) return;

    this.sending.set(true);
    this.errorMsg.set('');

    this.audienceAuthService.inviteFriend(trimmed).subscribe({
      next: () => {
        this.sentEmail.set(trimmed);
        this.sent.set(true);
        this.sending.set(false);
      },
      error: (err) => {
        this.sending.set(false);
        const msg = err?.error?.error || 'Failed to send invite. Please try again.';
        this.errorMsg.set(msg);
      }
    });
  }

  reset(): void {
    this.email = '';
    this.sent.set(false);
    this.sentEmail.set('');
    this.errorMsg.set('');
  }
}
