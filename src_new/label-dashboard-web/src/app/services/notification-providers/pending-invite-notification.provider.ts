import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, NotificationProvider, NotificationAction } from '../../models/notification.model';
import { ApiService } from '../api.service';
import { ArtistStateService } from '../artist-state.service';

export interface PendingInvite {
  artist_id: number;
  artist_name: string;
  invite_hash: string;
  can_view_payments: boolean;
  can_view_royalties: boolean;
  can_edit_artist_profile: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PendingInviteNotificationProvider implements NotificationProvider {
  private pendingInvites: PendingInvite[] = [];

  constructor(
    private apiService: ApiService,
    private router: Router,
    private artistStateService: ArtistStateService
  ) {}

  async getNotifications(): Promise<AppNotification[]> {
    try {
      const response = await this.apiService.getPendingInvites().toPromise();
      this.pendingInvites = response.invites || [];

      if (this.pendingInvites.length === 0) {
        return [];
      }

      // Create notification with actions for each pending invite
      const actions = this.pendingInvites.map(invite => ({
        label: invite.artist_name,
        data: invite
      }));

      const notification: AppNotification = {
        id: 'pending-invites',
        type: 'invite',
        style: 'gradient-purple',
        icon: 'fa-user-plus',
        title: `You have ${this.pendingInvites.length} pending team ${this.pendingInvites.length === 1 ? 'invite' : 'invites'}!`,
        actions,
        dismissible: true,
        priority: 100 // High priority
      };

      return [notification];
    } catch (error) {
      console.error('[PendingInviteNotificationProvider] Error fetching invites:', error);
      return [];
    }
  }

  async handleAction(notificationId: string, action: NotificationAction): Promise<void> {
    if (notificationId !== 'pending-invites') {
      throw new Error('Not my notification');
    }

    const invite = action.data as PendingInvite;
    if (!invite || !invite.invite_hash) {
      throw new Error('Invalid invite data');
    }

    try {
      // Process the invite
      const response = await this.apiService.processInvite(invite.invite_hash).toPromise();

      if (response.action === 'redirect_to_artist') {
        // Trigger artist refresh and selection
        this.artistStateService.triggerArtistsRefresh(response.artist_id);

        // Navigate to artist page (artist-selection component will handle setting the correct artist)
        await this.router.navigate(['/artist']);
      } else if (response.action === 'redirect_to_setup') {
        // Redirect to profile setup
        await this.router.navigate(['/set-profile'], {
          queryParams: { hash: invite.invite_hash }
        });
      }
    } catch (error) {
      console.error('[PendingInviteNotificationProvider] Error processing invite:', error);
      // Fallback: redirect to set-profile
      await this.router.navigate(['/set-profile'], {
        queryParams: { hash: invite.invite_hash }
      });
    }
  }
}
