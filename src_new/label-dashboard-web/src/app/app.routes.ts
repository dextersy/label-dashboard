import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtistComponent } from './pages/artist/artist.component';
import { AddNewArtistComponent } from './components/artist/add-new-artist/add-new-artist.component';
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
      { path: 'releases/new', component: ArtistComponent, canActivate: [adminGuard], data: { tab: 'new-release' } },
      { path: 'releases/submit', component: ArtistComponent, data: { tab: 'submit-release' } },
      { path: 'team', component: ArtistComponent, data: { tab: 'team' } },
      { path: 'new', component: AddNewArtistComponent, canActivate: [adminGuard] }
    ]
  },
  { 
    path: 'financial', 
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'summary', component: FinancialComponent, data: { tab: 'summary' } },
      { path: 'documents', component: FinancialComponent, data: { tab: 'documents' } },
      { path: 'earnings', component: FinancialComponent, data: { tab: 'earnings' } },
      { path: 'earnings/new', component: FinancialComponent, canActivate: [adminGuard], data: { tab: 'new-earning' } },
      { path: 'royalties', component: FinancialComponent, data: { tab: 'royalties' } },
      { path: 'royalties/new', component: FinancialComponent, canActivate: [adminGuard], data: { tab: 'new-royalty' } },
      { path: 'payments', component: FinancialComponent, data: { tab: 'payments' } },
      { path: 'payments/new', component: FinancialComponent, canActivate: [adminGuard], data: { tab: 'new-payment' } },
      { path: 'release', component: FinancialComponent, data: { tab: 'release' } }
    ]
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'events', component: EventsComponent, canActivate: [adminGuard] },
  { 
    path: 'admin', 
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'brand', pathMatch: 'full' },
      { path: 'brand', component: AdminComponent, data: { tab: 'brand' } },
      { path: 'summary', component: AdminComponent, data: { tab: 'summary' } },
      { path: 'balance', component: AdminComponent, data: { tab: 'balance' } },
      { path: 'bulk-add-earnings', component: AdminComponent, data: { tab: 'bulk-add-earnings' } },
      { path: 'users', component: AdminComponent, data: { tab: 'users' } },
      { path: 'child-brands', component: AdminComponent, data: { tab: 'child-brands' } },
      { path: 'tools', component: AdminComponent, data: { tab: 'tools' } }
    ]
  },
  { path: 'domain-not-found', component: DomainNotFoundComponent },
  { path: '**', redirectTo: '/login' }
];
