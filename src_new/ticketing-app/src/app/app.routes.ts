import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/auth/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
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
    ]
  },
  { path: '**', redirectTo: '/login' }
];
