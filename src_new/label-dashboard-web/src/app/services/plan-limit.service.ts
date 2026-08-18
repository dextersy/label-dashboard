import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { SubscriptionService } from './subscription.service';
import { AuthService } from './auth.service';

export interface UpgradeModalContext {
  limit_type: string;
}

@Injectable({ providedIn: 'root' })
export class PlanLimitService {
  private _modal$ = new BehaviorSubject<UpgradeModalContext | null>(null);
  readonly upgradeModal$ = this._modal$.asObservable();

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
  ) {}

  /**
   * Checks a specific limit before the user enters a creation flow.
   * Fetches current usage from the API, shows the upgrade modal if the limit is reached,
   * and returns true if the action is blocked.
   *
   * @param limitType  The quota to check.
   * @param artistId   Required when limitType is 'releases_per_artist'.
   */
  async checkLimit(limitType: 'artists' | 'releases_per_artist' | 'admin_users' | 'press_campaigns' | 'sync_pitches', artistId?: number): Promise<boolean> {
    if (!this.authService.isAdmin()) return false;
    try {
      const data = await firstValueFrom(this.subscriptionService.getUsage());

      if (!data.limits) return false; // No plan configured — no restrictions

      if (limitType === 'artists') {
        const limit = data.limits.limit_artists;
        if (limit !== null && data.usage.artists >= limit) {
          this.showUpgradeModal({ limit_type: 'artists' });
          return true;
        }
      }

      if (limitType === 'releases_per_artist' && artistId != null) {
        const limit = data.limits.limit_releases_per_artist;
        const count = data.usage.releases_per_artist[artistId] ?? 0;
        if (limit !== null && count >= limit) {
          this.showUpgradeModal({ limit_type: 'releases_per_artist' });
          return true;
        }
      }

      if (limitType === 'admin_users') {
        const limit = data.limits.limit_admin_users;
        if (limit !== null && data.usage.admin_users >= limit) {
          this.showUpgradeModal({ limit_type: 'admin_users' });
          return true;
        }
      }

      if (limitType === 'press_campaigns') {
        const limit = data.limits.limit_press_campaigns_per_month;
        if (limit !== null && data.usage.press_campaigns_this_month >= limit) {
          this.showUpgradeModal({ limit_type: 'press_campaigns' });
          return true;
        }
      }

      if (limitType === 'sync_pitches') {
        const limit = data.limits.limit_sync_pitches_per_month;
        if (limit !== null && data.usage.sync_pitches_this_month >= limit) {
          this.showUpgradeModal({ limit_type: 'sync_pitches' });
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('PlanLimitService.checkLimit failed:', err);
      return false;
    }
  }

  showUpgradeModal(context: UpgradeModalContext): void {
    this._modal$.next(context);
  }

  /**
   * Checks an HTTP error and opens the upgrade modal if it's a plan limit error.
   * Returns true if the error was a limit error (so callers can skip generic error handling).
   */
  handleLimitError(error: any): boolean {
    if (error?.status === 402 && error?.error?.error === 'LIMIT_REACHED' && this.authService.isAdmin()) {
      this.showUpgradeModal({
        limit_type: error.error.limit_type,
      });
      return true;
    }
    return false;
  }

  closeModal(): void {
    this._modal$.next(null);
  }
}
