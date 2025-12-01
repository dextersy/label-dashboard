import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { ConnectionMonitorService } from '../services/connection-monitor.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private connectionMonitor: ConnectionMonitorService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add Authorization header for authenticated requests
    let authReq = req;
    const token = this.authService.getToken();
    
    // Only add auth header if token exists and is not null/undefined
    // Also skip auth for public endpoints
    if (token && token !== 'null' && token !== 'undefined' && !req.url.includes('/public/')) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(authReq).pipe(
      tap((response: any) => {
        // Success response - when disconnected, ignore all non-health responses for connection status
        if (!req.url.includes('/health') && !this.connectionMonitor.isCurrentlyConnected()) {
          // Only the health check should restore connection status
          return;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Handle rate limit errors (429 Too Many Requests)
        if (error.status === 429) {
          this.notificationService.showError('Too many requests. Please try again later.');
          // Don't trigger connection error handling for rate limits
          return throwError(() => error);
        }

        // Check if this is a connection/timeout error (skip health check requests)
        if (!req.url.includes('/health') && this.connectionMonitor.isConnectionError(error)) {
          this.connectionMonitor.handleConnectionError();
          return throwError(() => error);
        }

        // Handle 401 Unauthorized and 403 Forbidden errors for protected endpoints only
        // Don't handle auth errors for public API calls or login attempts - let components handle them
        if ((error.status === 401 || error.status === 403) && 
            !req.url.includes('/public/') && 
            !req.url.includes('/auth/login')) {
          // Force logout and clear the user session
          this.authService.forceLogout();
          
          // Show session timeout notification
          this.notificationService.showError('Your session has timed out. Please log in again.');
          
          // Small delay to ensure notification shows before navigation
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 100);
          
          return throwError(() => error);
        }

        // For all other errors, just pass them through
        return throwError(() => error);
      })
    );
  }
}