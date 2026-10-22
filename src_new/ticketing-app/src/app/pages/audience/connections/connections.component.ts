import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';
import { ConnectButtonComponent } from '../../../components/connect-button/connect-button.component';
import { AudienceSocialService } from '../../../services/audience-social.service';
import { AudienceConnectionItem } from '../../../models/audience-connection';
import { ConnectionMeta } from '../../../models/audience-connection';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, RouterLink, AudienceHeaderComponent, ConnectButtonComponent],
  template: `
    <div class="min-h-screen bg-black text-white">
      <app-audience-header></app-audience-header>

      <main class="max-w-2xl mx-auto px-4 py-10 pt-20">

        <div class="mb-8">
          <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— social —</p>
          <h1 class="text-2xl font-black uppercase text-white">Connections</h1>
          <p class="text-xs font-mono text-white/30 mt-1">People you've connected with on Your Scene.</p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else {

          <!-- Pending requests -->
          @if (pending().length > 0) {
            <div class="mb-8">
              <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">
                Pending requests
                <span class="ml-2 px-1.5 py-0.5 bg-yellow-400 text-black text-[10px] font-black rounded-sm">{{ pending().length }}</span>
              </p>
              <div class="space-y-2">
                @for (item of pending(); track item.connection_id) {
                  <div class="flex items-center gap-4 border border-white/10 px-4 py-3">
                    <ng-container *ngTemplateOutlet="avatar; context: { $implicit: item.user }"></ng-container>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-black text-white uppercase truncate">
                        {{ item.user.first_name }} {{ item.user.last_name_initial }}
                      </p>
                      <p class="text-xs font-mono text-white/30 truncate">
                        {{ item.user.city || item.user.membership_tier }}
                      </p>
                    </div>
                    <app-connect-button
                      [userId]="item.user.id"
                      [connectionMeta]="{ connection_id: item.connection_id, status: 'pending', i_am_requester: false }"
                      (connectionChanged)="onPendingChanged(item.connection_id, $event)">
                    </app-connect-button>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Connected friends -->
          <div>
            <p class="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">
              Connected · {{ connections().length }}
            </p>
            @if (connections().length === 0) {
              <div class="border border-white/10 px-6 py-10 text-center">
                <p class="text-sm font-mono text-white/30">No connections yet.</p>
                <p class="text-xs font-mono text-white/20 mt-1">
                  Connect with people at events or
                  <a routerLink="/my-profile" class="text-yellow-400/60 hover:text-yellow-400 underline underline-offset-2 transition-colors">invite friends</a>.
                </p>
              </div>
            } @else {
              <div class="space-y-2">
                @for (item of connections(); track item.connection_id) {
                  <div class="flex items-center gap-4 border border-white/10 px-4 py-3">
                    <ng-container *ngTemplateOutlet="avatar; context: { $implicit: item.user }"></ng-container>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-black text-white uppercase truncate">
                        {{ item.user.first_name }} {{ item.user.last_name_initial }}
                      </p>
                      <p class="text-xs font-mono text-white/30 truncate">
                        {{ item.user.city ? item.user.city + ' · ' : '' }}{{ item.user.membership_tier }}
                      </p>
                      @if (item.user.music_genres.length > 0) {
                        <p class="text-[10px] font-mono text-white/20 truncate mt-0.5">
                          {{ item.user.music_genres.slice(0, 3).join(', ') }}
                        </p>
                      }
                    </div>
                    <app-connect-button
                      [userId]="item.user.id"
                      [connectionMeta]="{ connection_id: item.connection_id, status: 'accepted', i_am_requester: true }"
                      (connectionChanged)="onConnectionChanged(item.connection_id, $event)">
                    </app-connect-button>
                  </div>
                }
              </div>
            }
          </div>

        }

        <div class="mt-8">
          <a routerLink="/my-profile"
            class="text-xs font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
            &larr; Back to profile
          </a>
        </div>

      </main>
    </div>

    <ng-template #avatar let-user>
      @if (user.profile_photo_url) {
        <img [src]="user.profile_photo_url" [alt]="user.first_name"
          class="w-10 h-10 object-cover border border-white/20 flex-shrink-0">
      } @else {
        <div class="w-10 h-10 bg-white flex items-center justify-center border border-white/20 flex-shrink-0">
          <span class="text-black text-sm font-black">{{ user.first_name.charAt(0).toUpperCase() }}</span>
        </div>
      }
    </ng-template>
  `,
})
export class ConnectionsComponent implements OnInit {
  loading = signal(true);
  connections = signal<AudienceConnectionItem[]>([]);
  pending = signal<AudienceConnectionItem[]>([]);

  constructor(private socialService: AudienceSocialService) {}

  ngOnInit(): void {
    this.socialService.getConnections().subscribe({
      next: (res) => {
        this.connections.set(res.connections);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.socialService.getPendingRequests().subscribe({
      next: (res) => this.pending.set(res.pending),
      error: () => {},
    });
  }

  onConnectionChanged(connectionId: number, meta: ConnectionMeta | null): void {
    if (!meta) {
      this.connections.update((list) => list.filter((c) => c.connection_id !== connectionId));
    }
  }

  onPendingChanged(connectionId: number, meta: ConnectionMeta | null): void {
    this.pending.update((list) => list.filter((c) => c.connection_id !== connectionId));
    if (meta?.status === 'accepted') {
      // Refresh connections list to include the newly accepted one
      this.socialService.getConnections().subscribe({
        next: (res) => this.connections.set(res.connections),
        error: () => {},
      });
    }
  }
}
