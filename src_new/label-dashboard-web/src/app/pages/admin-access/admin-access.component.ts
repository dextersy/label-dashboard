import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-access',
  imports: [CommonModule],
  template: `
    <div class="tw-min-h-screen tw-bg-gray-50 tw-flex tw-items-center tw-justify-center">
      <p class="tw-text-sm tw-text-gray-400">{{ message }}</p>
    </div>
  `
})
export class AdminAccessComponent implements OnInit, OnDestroy {
  message = 'Signing you in...';

  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    if (!window.opener) {
      this.fail('No access context found. Redirecting...');
      return;
    }

    this.messageHandler = (event: MessageEvent) => {
      const code = event.data?.adminAccessCode;
      if (typeof code !== 'string' || !code) return;

      this.cleanup();
      this.exchange(code);
    };

    window.addEventListener('message', this.messageHandler);
    window.opener.postMessage('admin-access-ready', '*');

    this.timeout = setTimeout(() => this.fail('Access timed out. Redirecting...'), 15_000);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private exchange(code: string): void {
    this.auth.exchangeAdminAccessCode(code).subscribe({
      next: () => this.router.navigate(['/admin/users'], { replaceUrl: true }),
      error: () => this.fail('Access code is invalid or expired. Redirecting...')
    });
  }

  private cleanup(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private fail(msg: string): void {
    this.message = msg;
    this.cleanup();
    setTimeout(() => this.router.navigate(['/login'], { replaceUrl: true }), 2000);
  }
}
