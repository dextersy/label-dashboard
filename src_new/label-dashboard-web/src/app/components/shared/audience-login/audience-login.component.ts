import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudienceAuthService, AudienceUser } from '../../../services/audience-auth.service';
import { IconComponent } from '../icon/icon.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-audience-login',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './audience-login.component.html',
  styleUrls: ['./audience-login.component.scss']
})
export class AudienceLoginComponent implements OnInit, OnDestroy {
  @Output() loggedIn = new EventEmitter<AudienceUser>();

  dismissed = false;
  claimedCount = 0;

  private static readonly DISMISS_KEY = 'ys_banner_dismissed_until';
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private popup: Window | null = null;
  private popupPoll: ReturnType<typeof setInterval> | null = null;

  get isBannerVisible(): boolean {
    if (this.dismissed) return false;
    const until = localStorage.getItem(AudienceLoginComponent.DISMISS_KEY);
    if (until && Date.now() < parseInt(until, 10)) return false;
    return true;
  }

  dismiss(): void {
    this.dismissed = true;
    const until = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    localStorage.setItem(AudienceLoginComponent.DISMISS_KEY, String(until));
  }

  get audienceUser(): AudienceUser | null {
    return this.audienceAuthService.getUser();
  }

  get isLoggedIn(): boolean {
    return this.audienceAuthService.isLoggedIn();
  }

  constructor(private audienceAuthService: AudienceAuthService) {}

  ngOnInit(): void {
    // Handle Google OAuth code returned directly to the buy page.
    // This happens when the connect popup redirected the opener (main window) to Google
    // instead of navigating the popup — avoids COOP entirely.
    const params = new URLSearchParams(window.location.search);
    const audienceCode = params.get('audience_code');
    if (audienceCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete('audience_code');
      window.history.replaceState(null, '', url.toString());
      this.audienceAuthService.exchangeGoogleCode(audienceCode).subscribe({
        next: (res) => {
          this.claimedCount = res.claimed_tickets_count || 0;
          this.loggedIn.emit(res.user);
        },
        error: () => {}
      });
      return;
    }

    // Fragment fallback: connect page (no opener) redirected here with auth in the URL hash.
    const result = this.audienceAuthService.consumeAuthFragment();
    if (result) {
      this.claimedCount = result.claimed_tickets_count || 0;
      this.loggedIn.emit(result.user);
    }
  }

  openConnectPopup(): void {
    const connectUrl = `${environment.ticketingAppUrl}/connect?return_to=${encodeURIComponent(window.location.href)}`;
    this.popup = window.open(connectUrl, 'ys_connect', 'width=480,height=660,left=200,top=80');

    // Normal flow: connect page postMessages back when opener is intact.
    this.messageHandler = (event: MessageEvent) => {
      if (event.origin !== new URL(environment.ticketingAppUrl).origin) return;
      if (event.data?.type !== 'ys_auth') return;
      this.cleanupPopup();
      this.audienceAuthService.storeSession(event.data.token, event.data.user);
      this.claimedCount = event.data.claimed_tickets_count || 0;
      this.loggedIn.emit(event.data.user);
    };
    window.addEventListener('message', this.messageHandler);

    // COOP fallback: Google severs window.opener, so the popup ends up loading this page
    // with auth data in the fragment, stores the session in localStorage, then closes itself.
    // Poll for closure and pick up the session from shared localStorage.
    this.popupPoll = setInterval(() => {
      if (this.popup?.closed) {
        this.cleanupPopup();
        if (this.audienceAuthService.isLoggedIn()) {
          this.loggedIn.emit(this.audienceAuthService.getUser()!);
        }
      }
    }, 500);
  }

  private cleanupPopup(): void {
    window.removeEventListener('message', this.messageHandler!);
    this.messageHandler = null;
    if (this.popupPoll) {
      clearInterval(this.popupPoll);
      this.popupPoll = null;
    }
    this.popup = null;
  }

  logout(): void {
    this.audienceAuthService.logout();
  }

  ngOnDestroy(): void {
    this.cleanupPopup();
  }
}
