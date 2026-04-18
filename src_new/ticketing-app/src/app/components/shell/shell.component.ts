import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="flex h-screen bg-gray-50">
      <!-- Sidebar -->
      <aside class="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 flex-shrink-0">
        <!-- Logo -->
        <div class="flex items-center h-16 px-6 border-b border-gray-200">
          <span class="text-xl font-bold text-primary-600">Your Scene</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a routerLink="/dashboard" routerLinkActive="bg-primary-50 text-primary-600"
             [routerLinkActiveOptions]="{exact: true}"
             class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM13 7a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V7zM3 17a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2zM13 17a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2z"/>
            </svg>
            Dashboard
          </a>
          <a routerLink="/events" routerLinkActive="bg-primary-50 text-primary-600"
             class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Events
          </a>
        </nav>

        <!-- User -->
        <div class="p-3 border-t border-gray-200">
          <div class="flex items-center gap-3 px-3 py-2">
            <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span class="text-primary-600 text-sm font-medium">{{ userInitial() }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ userName() }}</p>
            </div>
            <button (click)="logout()" class="text-gray-400 hover:text-gray-600" title="Logout">
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
        <header class="md:hidden flex items-center h-16 px-4 bg-white border-b border-gray-200">
          <button (click)="mobileMenuOpen.set(!mobileMenuOpen())" class="p-2 text-gray-500">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span class="ml-3 text-lg font-bold text-primary-600">Your Scene</span>
        </header>

        <!-- Mobile slide-over -->
        @if (mobileMenuOpen()) {
          <div class="md:hidden fixed inset-0 z-50 flex">
            <div class="fixed inset-0 bg-black/30" (click)="mobileMenuOpen.set(false)"></div>
            <aside class="relative w-60 bg-white flex flex-col shadow-xl">
              <div class="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                <span class="text-xl font-bold text-primary-600">Your Scene</span>
                <button (click)="mobileMenuOpen.set(false)" class="text-gray-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <nav class="flex-1 px-3 py-4 space-y-1">
                <a routerLink="/dashboard" (click)="mobileMenuOpen.set(false)"
                   routerLinkActive="bg-primary-50 text-primary-600"
                   class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100">Dashboard</a>
                <a routerLink="/events" (click)="mobileMenuOpen.set(false)"
                   routerLinkActive="bg-primary-50 text-primary-600"
                   class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100">Events</a>
              </nav>
            </aside>
          </div>
        }

        <main class="flex-1 overflow-y-auto">
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
    this.router.navigate(['/login']);
  }
}
