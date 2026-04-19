import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="flex h-screen bg-black">
      <!-- Sidebar -->
      <aside class="hidden md:flex flex-col w-52 bg-black border-r-2 border-white/15 flex-shrink-0">
        <!-- Logo -->
        <div class="flex items-center h-12 px-5 border-b-2 border-white/15">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6">
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-0.5">
          <a routerLink="/app/dashboard" routerLinkActive="bg-yellow-400 !text-black"
             [routerLinkActiveOptions]="{exact: true}"
             class="flex items-center gap-3 px-3 py-2 text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"/>
            </svg>
            Dashboard
          </a>
          <a routerLink="/app/events" routerLinkActive="bg-yellow-400 !text-black"
             class="flex items-center gap-3 px-3 py-2 text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Events
          </a>
        </nav>

        <!-- User -->
        <div class="p-3 border-t border-white/10">
          <div class="flex items-center gap-3 px-3 py-2">
            <div class="w-7 h-7 bg-yellow-400 flex items-center justify-center flex-shrink-0">
              <span class="text-black text-xs font-black">{{ userInitial() }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono text-white/40 truncate">{{ userName() }}</p>
            </div>
            <button (click)="logout()" class="text-white/25 hover:text-white transition-colors flex-shrink-0" title="Logout">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Mobile topbar -->
        <header class="md:hidden flex items-center h-12 px-4 bg-black border-b-2 border-white/15">
          <button (click)="mobileMenuOpen.set(!mobileMenuOpen())" class="p-1 text-white/40 hover:text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6 ml-3">
        </header>

        <!-- Mobile slide-over -->
        @if (mobileMenuOpen()) {
          <div class="md:hidden fixed inset-0 z-50 flex">
            <div class="fixed inset-0 bg-black/80" (click)="mobileMenuOpen.set(false)"></div>
            <aside class="relative w-52 bg-black border-r-2 border-white/15 flex flex-col">
              <div class="flex items-center justify-between h-12 px-5 border-b-2 border-white/15">
                <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-6">
                <button (click)="mobileMenuOpen.set(false)" class="text-white/40 hover:text-white">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <nav class="flex-1 px-3 py-4 space-y-0.5">
                <a routerLink="/app/dashboard" (click)="mobileMenuOpen.set(false)"
                   routerLinkActive="bg-yellow-400 !text-black"
                   [routerLinkActiveOptions]="{exact: true}"
                   class="flex items-center gap-3 px-3 py-2 text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest">Dashboard</a>
                <a routerLink="/app/events" (click)="mobileMenuOpen.set(false)"
                   routerLinkActive="bg-yellow-400 !text-black"
                   class="flex items-center gap-3 px-3 py-2 text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest">Events</a>
              </nav>
            </aside>
          </div>
        }

        <main class="flex-1 overflow-y-auto bg-zinc-50">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class ShellComponent {
  mobileMenuOpen = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  userName = () => {
    const u = this.auth.getCurrentUser();
    return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u?.email || 'User';
  };

  userInitial = () => {
    const u = this.auth.getCurrentUser();
    return (u?.first_name?.[0] || u?.email?.[0] || 'U').toUpperCase();
  };

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/app/login']);
  }
}
