import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtistComponent } from './pages/artist/artist.component';
import { FinancialComponent } from './pages/financial/financial.component';
import { EventsComponent } from './pages/events/events.component';
import { AdminComponent } from './pages/admin/admin.component';
import { DomainNotFoundComponent } from './pages/domain-not-found/domain-not-found.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SetProfileComponent } from './pages/set-profile/set-profile.component';
import { InviteComponent } from './pages/invite/invite.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { TicketBuyComponent } from './pages/public/ticket-buy.component';
import { TicketSuccessComponent } from './pages/public/ticket-success.component';
import { TicketVerifyComponent } from './pages/public/ticket-verify.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'set-profile', component: SetProfileComponent }, // No auth guard - standalone
  { path: 'invite/accept', component: InviteComponent }, // No auth guard - standalone
  
  // Public Routes (no authentication required)
  { path: 'public/tickets/buy/:id', component: TicketBuyComponent },
  { path: 'public/tickets/success/:id', component: TicketSuccessComponent },
  { path: 'public/tickets/verify/:id', component: TicketVerifyComponent },
  
  // Protected Routes
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { 
    path: 'artist', 
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'profile', component: ArtistComponent, data: { tab: 'profile' } },
      { path: 'gallery', component: ArtistComponent, data: { tab: 'gallery' } },
      { path: 'releases', component: ArtistComponent, data: { tab: 'releases' } },
      { path: 'team', component: ArtistComponent, data: { tab: 'team' } },
      { path: 'new-release', component: ArtistComponent, canActivate: [adminGuard], data: { tab: 'new-release' } },
      { path: 'submit-release', component: ArtistComponent, data: { tab: 'submit-release' } }
    ]
  },
  { path: 'financial', component: FinancialComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'events', component: EventsComponent, canActivate: [adminGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] }, // Admin only
  { path: 'domain-not-found', component: DomainNotFoundComponent },
  { path: '**', redirectTo: '/login' }
];
