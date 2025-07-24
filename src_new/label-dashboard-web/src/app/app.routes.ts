import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtistComponent } from './pages/artist/artist.component';
import { FinancialComponent } from './pages/financial/financial.component';
import { EventsComponent } from './pages/events/events.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'artist', component: ArtistComponent, canActivate: [authGuard] },
  { path: 'financial', component: FinancialComponent, canActivate: [authGuard] },
  { path: 'events', component: EventsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];
