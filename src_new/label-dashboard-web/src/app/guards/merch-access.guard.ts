import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BrandService } from '../services/brand.service';

export const merchAccessGuard: CanActivateFn = (_route, _state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const brandService = inject(BrandService);
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

      if (!user.is_admin) {
        router.navigate(['/dashboard']);
        return false;
      }

      const settings = brandService.getCurrentBrandSettings();
      if (settings?.feature_merch_workspace === false) {
        router.navigate(['/dashboard']);
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
