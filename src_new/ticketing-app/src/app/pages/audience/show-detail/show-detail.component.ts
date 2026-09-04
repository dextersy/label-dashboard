import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

@Component({
  selector: 'app-show-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">

      <app-audience-header></app-audience-header>

      <!-- Loading -->
      <div *ngIf="loading()" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin"></div>
      </div>

      <!-- Error -->
      <div *ngIf="error()" class="max-w-lg mx-auto px-4 py-10">
        <div class="border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono p-4">
          Failed to load show details.
        </div>
      </div>

      <main *ngIf="!loading() && !error() && event()" class="max-w-lg mx-auto px-4 pt-20 pb-10">

        <!-- Event poster -->
        <div *ngIf="event()?.poster_url" class="mb-6 rounded overflow-hidden">
          <img [src]="event()?.poster_url" [alt]="event()?.title" class="w-full max-h-72 object-cover object-center">
        </div>

        <!-- Event info -->
        <div class="mb-8">
          <a *ngIf="event()?.brand?.name" [routerLink]="['/organizers', event()?.brand?.id]"
            class="text-xs font-mono text-white/30 uppercase tracking-widest mb-1 hover:text-white/60 transition-colors inline-block">{{ event()?.brand?.name }}</a>
          <h1 class="text-2xl font-black uppercase leading-tight mb-3">{{ event()?.title }}</h1>
          <div class="space-y-1 text-sm text-white/50 font-mono">
            <p>{{ formatDate(event()?.date_and_time) }}</p>
            <p>{{ event()?.venue }}</p>
          </div>
        </div>

        <!-- Tickets -->
        <div>
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-4">— your tickets —</p>
          <div class="space-y-3">
            <div *ngFor="let ticket of tickets()" class="ticket-stub">
              <div class="flex items-stretch">
                <!-- Main section -->
                <div class="flex-1 px-5 py-3 min-w-0">
                  <p class="font-mono font-black tracking-widest text-yellow-400 text-base leading-none">{{ ticket.ticket_code }}</p>
                  <p class="text-xs text-white/40 mt-1.5 truncate">{{ ticket.ticketType?.name || 'Regular' }} &middot; {{ ticket.number_of_entries }} entr{{ ticket.number_of_entries !== 1 ? 'ies' : 'y' }}</p>
                  <span class="inline-block mt-2 text-xs font-mono uppercase tracking-wider px-2 py-0.5"
                    [class]="getStatusClass(ticket.status)">{{ ticket.status }}</span>
                </div>
                <!-- Tear line -->
                <div class="ticket-tear"></div>
                <!-- Stub section: download -->
                <div class="flex items-center justify-center px-4 py-3">
                  <button type="button" (click)="downloadPDF(ticket)"
                    class="text-xs font-mono text-white/35 hover:text-yellow-400 uppercase tracking-[0.15em] transition-colors"
                    style="writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);">
                    PDF ↓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  `,
  styles: [`
    .ticket-stub {
      position: relative;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
    }

    /* Vertical tear line with top/bottom notch cutouts */
    .ticket-tear {
      position: relative;
      width: 1px;
      background: repeating-linear-gradient(
        to bottom,
        rgba(255,255,255,0.15) 0,
        rgba(255,255,255,0.15) 4px,
        transparent 4px,
        transparent 8px
      );
      margin: 10px 0;
    }
    .ticket-tear::before,
    .ticket-tear::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: black;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .ticket-tear::before { left: -8px; }
    .ticket-tear::after  { right: -8px; }
  `]
})
export class ShowDetailComponent implements OnInit {
  loading = signal(true);
  error = signal(false);
  event = signal<any>(null);
  tickets = signal<any[]>([]);
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private audienceAuthService: AudienceAuthService
  ) {}

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (!eventId) {
      this.router.navigate(['/my-shows']);
      return;
    }
    this.loadShowDetail(parseInt(eventId, 10));
  }

  loadShowDetail(eventId: number): void {
    this.audienceAuthService.getTickets().subscribe({
      next: (res) => {
        const eventTickets = res.tickets.filter((t: any) => t.event_id === eventId);
        if (eventTickets.length > 0) {
          this.event.set(eventTickets[0].event);
          this.tickets.set(eventTickets);
        } else {
          this.error.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Payment Confirmed':
      case 'Ticket sent.':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'Canceled':
      case 'Refunded':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-white/10 text-white/40 border border-white/10';
    }
  }

  downloadPDF(ticket: any): void {
    this.audienceAuthService.downloadTicketPDF(ticket.ticket_code).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-${ticket.ticket_code}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => { /* silently ignore — user can retry */ }
    });
  }

}
