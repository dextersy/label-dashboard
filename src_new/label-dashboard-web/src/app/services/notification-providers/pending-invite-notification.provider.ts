import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppNotification, NotificationProvider, NotificationAction } from '../../models/notification.model';
import { ApiService } from '../api.service';
import { ArtistStateService } from '../artist-state.service';
import { AuthService } from '../auth.service';

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
    private artistStateService: ArtistStateService,
    private authService: AuthService
  ) {}

  async getNotifications(): Promise<AppNotification[]> {
    try {
      const response = await firstValueFrom(this.apiService.getPendingInvites());
      this.pendingInvites = response.invites || [];

      if (this.pendingInvites.length === 0) {
        return [];
      }

      // Create a separate notification for each pending invite
      const notifications: AppNotification[] = this.pendingInvites.map(invite => ({
        id: `pending-invite-${invite.invite_hash}`,
        type: 'invite' as const,
        style: 'gradient-purple' as const,
        icon: 'fa-user-plus',
        title: `You have a pending invite to join ${invite.artist_name}'s team!`,
        actions: [{
          label: 'Accept',
          data: invite
        }],
        dismissible: true,
        priority: 100 // High priority
      }));

      return notifications;
    } catch (error) {
      console.error('[PendingInviteNotificationProvider] Error fetching invites:', error);
      return [];
    }
  }

  async handleAction(notificationId: string, action: NotificationAction): Promise<void> {
    if (!notificationId.startsWith('pending-invite-')) {
      throw new Error('Not my notification');
    }

    const invite = action.data as PendingInvite;
    if (!invite || !invite.invite_hash) {
      throw new Error('Invalid invite data');
    }

    try {
      // Process the invite
      const response = await firstValueFrom(this.apiService.processInvite(invite.invite_hash));

      if (response.action === 'redirect_to_artist') {
        // Validate artist_id is present
        if (!response.artist_id) {
          throw new Error('Artist ID missing from response');
        }

        // Store authentication token and update auth state if provided
        if (response.token) {
          localStorage.setItem('auth_token', response.token);
          this.authService.updateUserData(response.user);
        }

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
