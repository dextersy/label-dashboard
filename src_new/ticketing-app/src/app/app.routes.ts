import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { audienceAuthGuard } from './guards/audience-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./pages/events/event-view/event-view.component').then(m => m.EventViewComponent)
  },
  {
    // Root-level reset-password so the email link (generated without /app/ prefix) works
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    data: { view: 'reset-password' }
  },
  {
    path: 'app',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'signup',
        loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
        data: { view: 'signup' }
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
        data: { view: 'forgot-password' }
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
        data: { view: 'reset-password' }
      },
      {
        path: 'complete-profile',
        loadComponent: () => import('./pages/auth/complete-profile/complete-profile.component').then(m => m.CompleteProfileComponent)
      },
      {
        path: 'google-callback',
        loadComponent: () => import('./pages/auth/google-callback/google-callback.component').then(m => m.GoogleCallbackComponent)
      },
      {
        path: 'terms',
        loadComponent: () => import('./pages/legal/terms.component').then(m => m.TermsComponent)
      },
      {
        path: '',
        loadComponent: () => import('./components/shell/shell.component').then(m => m.ShellComponent),
        canActivate: [authGuard],
        children: [
          { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
          { path: 'events', loadComponent: () => import('./pages/events/events-list/events-list.component').then(m => m.EventsListComponent) },
          { path: 'events/new', loadComponent: () => import('./pages/events/event-form/event-form.component').then(m => m.EventFormComponent) },
          { path: 'events/:id/edit', loadComponent: () => import('./pages/events/event-form/event-form.component').then(m => m.EventFormComponent) },
          { path: 'events/:id', loadComponent: () => import('./pages/events/event-detail/event-detail.component').then(m => m.EventDetailComponent) },
          { path: 'payouts', loadComponent: () => import('./pages/payouts/payouts.component').then(m => m.PayoutsComponent) },
          { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
        ]
      }
    ]
  },
  // Audience-facing routes (top-level, no /app/ prefix for clean URLs)
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  {
    path: 'connect',
    loadComponent: () => import('./pages/auth/connect/connect.component').then(m => m.ConnectComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    data: { view: 'signup' }
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    data: { view: 'forgot-password' }
  },
  {
    path: 'my-shows',
    canActivate: [audienceAuthGuard],
    loadComponent: () => import('./pages/audience/my-shows/my-shows.component').then(m => m.MyShowsComponent)
  },
  {
    path: 'my-shows/:eventId',
    canActivate: [audienceAuthGuard],
    loadComponent: () => import('./pages/audience/show-detail/show-detail.component').then(m => m.ShowDetailComponent)
  },
  { path: '**', redirectTo: '/' }
];
