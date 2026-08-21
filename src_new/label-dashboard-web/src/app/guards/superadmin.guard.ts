import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const superadminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const token = localStorage.getItem('auth_token');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

  return http.get(`${environment.apiUrl}/auth/me`, { headers }).pipe(
    map((response: any) => {
      if (response.user?.is_superadmin) {
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    }),
    catchError(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('currentUser');
      router.navigate(['/login']);
      return of(false);
    })
  );
};
