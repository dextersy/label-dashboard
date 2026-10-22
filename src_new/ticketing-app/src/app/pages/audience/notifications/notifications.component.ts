import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';
import { AudienceSocialService } from '../../../services/audience-social.service';
import { AudienceNotification } from '../../../models/audience-notification';

@Component({
  selector: 'app-audience-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, AudienceHeaderComponent],
  template: `
    <div class="min-h-screen bg-black text-white">
      <app-audience-header></app-audience-header>

      <main class="max-w-2xl mx-auto px-4 py-10 pt-20">

        <div class="mb-8 flex items-end justify-between">
          <div>
            <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-1">— account —</p>
            <h1 class="text-2xl font-black uppercase text-white">Notifications</h1>
          </div>
          @if (notifications().length > 0 && unreadCount() > 0) {
            <button type="button" (click)="markAllRead()"
              class="text-xs font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
              Mark all read
            </button>
          }
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else if (notifications().length === 0) {
          <div class="border border-white/10 px-6 py-10 text-center">
            <p class="text-sm font-mono text-white/30">No notifications yet.</p>
          </div>
        } @else {
          <div class="space-y-1">
            @for (notif of notifications(); track notif.id) {
              <div
                class="flex items-start gap-4 px-4 py-3 border transition-colors cursor-pointer"
                [class.border-white/10]="notif.is_read"
                [class.border-yellow-400/20]="!notif.is_read"
                [class.bg-yellow-400/5]="!notif.is_read"
                (click)="onNotifClick(notif)">

                <!-- Actor avatar -->
                @if (notif.actor?.profile_photo_url) {
                  <img [src]="notif.actor!.profile_photo_url" [alt]="notif.actor!.first_name"
                    class="w-9 h-9 object-cover border border-white/20 flex-shrink-0 mt-0.5">
                } @else if (notif.actor) {
                  <div class="w-9 h-9 bg-white flex items-center justify-center border border-white/20 flex-shrink-0 mt-0.5">
                    <span class="text-black text-xs font-black">{{ notif.actor.first_name.charAt(0).toUpperCase() }}</span>
                  </div>
                } @else {
                  <div class="w-9 h-9 bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                  </div>
                }

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-mono text-white leading-snug" [class.font-black]="!notif.is_read">
                    {{ notif.title }}
                  </p>
                  @if (notif.message) {
                    <p class="text-xs font-mono text-white/40 mt-0.5">{{ notif.message }}</p>
                  }
                  <p class="text-[10px] font-mono text-white/20 mt-1">{{ formatTime(notif.created_at) }}</p>
                </div>

                @if (!notif.is_read) {
                  <div class="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mt-2"></div>
                }
              </div>
            }
          </div>
        }

        <div class="mt-8 flex flex-col gap-2">
          <a routerLink="/my-email-preferences"
            class="text-xs font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
            Manage email notifications
          </a>
          <a routerLink="/my-profile"
            class="text-xs font-mono text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
            &larr; Back to profile
          </a>
        </div>

      </main>
    </div>
  `,
})
export class AudienceNotificationsComponent implements OnInit {
  loading = signal(true);
  notifications = signal<AudienceNotification[]>([]);
  unreadCount = signal(0);

  constructor(private socialService: AudienceSocialService) {}

  ngOnInit(): void {
    this.socialService.getNotifications().subscribe({
      next: (res) => {
        this.notifications.set(res.notifications);
        this.unreadCount.set(res.notifications.filter((n) => !n.is_read).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onNotifClick(notif: AudienceNotification): void {
    if (!notif.is_read) {
      notif.is_read = true;
      this.unreadCount.update((c) => Math.max(0, c - 1));
      this.socialService.markRead(notif.id).subscribe({ error: () => {} });
    }
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, is_read: true })));
    this.unreadCount.set(0);
    this.socialService.markAllRead().subscribe({ error: () => {} });
  }

  formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
