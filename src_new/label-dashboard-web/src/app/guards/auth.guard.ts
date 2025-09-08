import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // Verify token with backend
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return http.get(`${environment.apiUrl}/auth/me`, { headers }).pipe(
    map((response: any) => {
      if (response.user) {
        // Update localStorage with current user data
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return true;
      } else {
        // Token is invalid, redirect to login
        router.navigate(['/login']);
        return false;
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Only logout on actual authentication/authorization errors
      if (error.status === 401 || error.status === 403) {
        // Token is invalid or expired - clear storage and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        router.navigate(['/login']);
        return of(false);
      }
      
      // For all other errors (network, server, etc.), allow access and let other systems handle it
      return of(true);
    })
  );
};
