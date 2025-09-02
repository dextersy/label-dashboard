import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized and 403 Forbidden errors (session timeout/unauthorized)
        if (error.status === 401 || error.status === 403) {
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