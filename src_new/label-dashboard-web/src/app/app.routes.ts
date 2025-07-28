import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtistComponent } from './pages/artist/artist.component';
import { FinancialComponent } from './pages/financial/financial.component';
import { EventsComponent } from './pages/events/events.component';
import { DomainNotFoundComponent } from './pages/domain-not-found/domain-not-found.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SetProfileComponent } from './pages/set-profile/set-profile.component';
import { InviteComponent } from './pages/invite/invite.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'set-profile', component: SetProfileComponent }, // No auth guard - standalone
  { path: 'invite/accept', component: InviteComponent }, // No auth guard - standalone
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'artist', component: ArtistComponent, canActivate: [authGuard] },
  { path: 'financial', component: FinancialComponent, canActivate: [authGuard] },
  { path: 'events', component: EventsComponent, canActivate: [adminGuard] }, // Admin only
  { path: 'domain-not-found', component: DomainNotFoundComponent },
  { path: '**', redirectTo: '/login' }
];
