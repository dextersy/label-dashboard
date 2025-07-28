import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // Verify token and admin status with backend
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return http.get(`${environment.apiUrl}/auth/me`, { headers }).pipe(
    map((response: any) => {
      if (response.user && response.user.is_admin) {
        // Update localStorage with current user data
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return true;
      } else {
        // User is not admin, redirect to dashboard
        router.navigate(['/dashboard']);
        return false;
      }
    }),
    catchError(() => {
      // Token is invalid, clear storage and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('currentUser');
      router.navigate(['/login']);
      return of(false);
    })
  );
};