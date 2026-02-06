import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtistComponent } from './pages/artist/artist.component';
import { SelectArtistComponent } from './pages/select-artist/select-artist.component';
import { AddNewArtistComponent } from './components/artist/add-new-artist/add-new-artist.component';
import { FinancialComponent } from './pages/financial/financial.component';
import { EventsComponent } from './pages/events/events.component';
import { EventsDashboardComponent } from './pages/events-dashboard/events-dashboard.component';
import { EventFormComponent } from './pages/event-form/event-form.component';
import { FundraisersComponent } from './pages/fundraisers/fundraisers.component';
import { FundraiserFormComponent } from './pages/fundraiser-form/fundraiser-form.component';
import { ReleaseSubmissionComponent } from './components/artist/release-submission/release-submission.component';
import { AdminComponent } from './pages/admin/admin.component';
import { LabelFinanceTabComponent } from './pages/admin/components/label-finance-tab.component';
import { LabelsEarningsPageComponent } from './pages/labels/labels-earnings.component';
import { ChildBrandsTabComponent } from './pages/admin/components/child-brands-tab.component';
import { DomainNotFoundComponent } from './pages/domain-not-found/domain-not-found.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SetProfileComponent } from './pages/set-profile/set-profile.component';
import { InviteComponent } from './pages/invite/invite.component';
import { AdminInviteComponent } from './pages/admin-invite/admin-invite.component';
import { AdminSetupComponent } from './pages/admin-setup/admin-setup.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { CustomTicketComponent } from './pages/events/custom-ticket/custom-ticket.component';
import { TicketBuyComponent } from './pages/public/ticket-buy.component';
import { TicketSuccessComponent } from './pages/public/ticket-success.component';
import { TicketVerifyComponent } from './pages/public/ticket-verify.component';
import { PublicEventsComponent } from './pages/public/public-events.component';
import { ArtistEPKComponent } from './pages/public/artist-epk.component';
import { FundraiserComponent } from './pages/public/fundraiser.component';
import { DonationSuccessComponent } from './pages/public/donation-success.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { artistSelectedGuard } from './guards/artist-selected.guard';
import { SyncLicensingComponent } from './pages/sync-licensing/sync-licensing.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'set-profile', component: SetProfileComponent }, // No auth guard - standalone (also used for profile completion)
  { path: 'invite', component: InviteComponent }, // No auth guard - standalone
  { path: 'invite/accept', component: InviteComponent }, // Legacy route - alias for /invite
  { path: 'admin-invite', component: AdminInviteComponent }, // No auth guard - standalone
  { path: 'admin-setup', component: AdminSetupComponent }, // No auth guard - standalone
  
  // Public Routes (no authentication required)
  { path: 'public/events', component: PublicEventsComponent },
  { path: 'public/epk/:artist_id', component: ArtistEPKComponent },
  { path: 'public/tickets/buy/:id', component: TicketBuyComponent },
  { path: 'public/tickets/success', component: TicketSuccessComponent },
  { path: 'public/tickets/verify/:id', component: TicketVerifyComponent },
  { path: 'public/fundraiser/:id', component: FundraiserComponent },
  { path: 'public/donation/success', component: DonationSuccessComponent },

  // EPK Preview (protected)
  { path: 'artist/epk/preview/:artist_id/:template', component: ArtistEPKComponent, canActivate: [authGuard], data: { preview: true } },
  
  // Protected Routes
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'artist', component: SelectArtistComponent, canActivate: [authGuard] },
  {
    path: 'artist',
    canActivate: [authGuard, artistSelectedGuard],
    children: [
      { path: 'profile', component: ArtistComponent, data: { tab: 'profile' } },
      { path: 'gallery', component: ArtistComponent, data: { tab: 'gallery' } },
      { path: 'epk', component: ArtistComponent, data: { tab: 'manage-epk' } },
      { path: 'new', component: AddNewArtistComponent, canActivate: [adminGuard] }
    ]
  },
  {
    path: 'music',
    canActivate: [authGuard, artistSelectedGuard],
    children: [
      { path: '', redirectTo: 'releases', pathMatch: 'full' },
      { path: 'releases', component: ArtistComponent, data: { tab: 'releases' } },
      { path: 'releases/new', component: ReleaseSubmissionComponent },
      { path: 'releases/edit/:id', component: ReleaseSubmissionComponent }
    ]
  },
  // Sync Licensing (admin only, not artist-specific)
  { path: 'music/sync-licensing', component: SyncLicensingComponent, canActivate: [adminGuard] },
  { path: 'team', component: ArtistComponent, canActivate: [authGuard, artistSelectedGuard], data: { tab: 'team' } },
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
      { path: 'payments/new/:amount', component: FinancialComponent, canActivate: [adminGuard], data: { tab: 'new-payment' } },
      { path: 'release', component: FinancialComponent, data: { tab: 'release' } }
    ]
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },

  // Campaigns workspace (Events + Fundraisers)
  {
    path: 'campaigns',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: EventsDashboardComponent },
      // Events
      { path: 'events', redirectTo: 'events/details', pathMatch: 'full' },
      { path: 'events/dashboard', redirectTo: '/campaigns/dashboard', pathMatch: 'full' }, // Legacy redirect
      { path: 'events/new', component: EventFormComponent },
      { path: 'events/details', component: EventFormComponent },
      { path: 'events/tickets', component: EventsComponent, data: { tab: 'tickets' } },
      { path: 'events/abandoned', component: EventsComponent, data: { tab: 'abandoned' } },
      { path: 'events/referrals', component: EventsComponent, data: { tab: 'referrals' } },
      { path: 'events/email', component: EventsComponent, data: { tab: 'email' } },
      { path: 'events/custom-ticket', component: CustomTicketComponent },
      // Fundraisers
      { path: 'fundraisers', redirectTo: 'fundraisers/details', pathMatch: 'full' },
      { path: 'fundraisers/new', component: FundraiserFormComponent },
      { path: 'fundraisers/details', component: FundraiserFormComponent },
      { path: 'fundraisers/donations', component: FundraisersComponent, data: { tab: 'donations' } }
    ]
  },

  // Legacy events routes - redirect to campaigns
  { path: 'events', redirectTo: 'campaigns/events', pathMatch: 'full' },
  { path: 'events/dashboard', redirectTo: 'campaigns/dashboard', pathMatch: 'full' },
  { path: 'events/new', redirectTo: 'campaigns/events/new', pathMatch: 'full' },
  { path: 'events/details', redirectTo: 'campaigns/events/details', pathMatch: 'full' },
  { path: 'events/tickets', redirectTo: 'campaigns/events/tickets', pathMatch: 'full' },
  { path: 'events/abandoned', redirectTo: 'campaigns/events/abandoned', pathMatch: 'full' },
  { path: 'events/referrals', redirectTo: 'campaigns/events/referrals', pathMatch: 'full' },
  { path: 'events/email', redirectTo: 'campaigns/events/email', pathMatch: 'full' },
  { path: 'events/custom-ticket', redirectTo: 'campaigns/events/custom-ticket', pathMatch: 'full' },

  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'settings', component: AdminComponent, data: { tab: 'settings' } },
      { path: 'reports/music-earnings', component: AdminComponent, data: { tab: 'reports-music-earnings' } },
      { path: 'reports/artist-balances', component: AdminComponent, data: { tab: 'reports-artist-balances' } },
      { path: 'tools/email-logs', component: AdminComponent, data: { tab: 'tools-email-logs' } },
      { path: 'tools/bulk-add-earnings', component: AdminComponent, data: { tab: 'tools-bulk-add-earnings' } },
      { path: 'users', component: AdminComponent, data: { tab: 'users' } }
    ]
  },

  // Labels workspace
  {
    path: 'labels',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'earnings', pathMatch: 'full' },
      { path: 'earnings', component: LabelsEarningsPageComponent },
      { path: 'sublabels', component: ChildBrandsTabComponent }
    ]
  },

  { path: 'domain-not-found', component: DomainNotFoundComponent },
  { path: '**', redirectTo: '/login' }
];
