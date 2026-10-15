import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Allows access to the campaigns workspace for:
 * - Admin users (full access)
 * - Non-admin users who have EventAccess records (limited to events section only)
 */
export const campaignsAccessGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const token = localStorage.getItem('auth_token');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

  return http.get(`${environment.apiUrl}/auth/me`, { headers }).pipe(
    map((response: any) => {
      const user = response.user;
      if (!user) {
        router.navigate(['/login']);
        return false;
      }

      localStorage.setItem('currentUser', JSON.stringify(user));
      authService.updateUserData(user);

      if (user.is_admin) return true;

      // Non-admin: allow only if they have event access AND are on an events sub-route
      const hasEventAccess = user.event_access?.length > 0;
      if (!hasEventAccess) {
        router.navigate(['/dashboard']);
        return false;
      }

      // Restrict non-admins to the events sub-routes only (not fundraisers, press, sync)
      const url = state.url;
      const eventsRoutes = ['/campaigns/events', '/campaigns/dashboard'];
      const isEventsRoute = eventsRoutes.some(r => url.startsWith(r));
      if (!isEventsRoute) {
        router.navigate(['/campaigns/events/tickets']);
        return false;
      }

      return true;
    }),
    catchError((err) => {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        router.navigate(['/login']);
      }
      return of(false);
    })
  );
};
