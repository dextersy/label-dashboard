import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConnectionMonitorService {
  private isConnected = new BehaviorSubject<boolean>(true);
  private isRetrying = new BehaviorSubject<boolean>(false);
  private retryInterval: any;
  private isRefreshing = false; // Prevent multiple refreshes
  private readonly healthCheckUrl = `${environment.apiUrl}/health`;

  public isConnected$ = this.isConnected.asObservable();
  public isRetrying$ = this.isRetrying.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  // Called when a timeout or connection error occurs
  handleConnectionError(): void {
    if (this.isConnected.value) {
      this.isConnected.next(false);
      this.startHealthChecks();
    }
  }

  // Called when a successful API response is received
  handleConnectionSuccess(): void {
    if (!this.isConnected.value && !this.isRefreshing) {
      this.isConnected.next(true);
      this.stopHealthChecks();
      this.isRefreshing = true; // Prevent multiple refreshes
      // Small delay to allow UI to update before refresh
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  private startHealthChecks(): void {
    if (this.retryInterval) {
      return; // Already checking
    }

    this.isRetrying.next(true);
    
    // Check immediately, then every 3 seconds
    this.checkHealth().subscribe();
    
    this.retryInterval = interval(3000).pipe(
      switchMap(() => this.checkHealth())
    ).subscribe();
  }

  private stopHealthChecks(): void {
    if (this.retryInterval) {
      this.retryInterval.unsubscribe();
      this.retryInterval = null;
    }
    this.isRetrying.next(false);
  }

  private checkHealth(): Observable<any> {
    return this.http.get(this.healthCheckUrl).pipe(
      tap(() => {
        // Health check successful
        if (!this.isConnected.value) {
          this.handleConnectionSuccess();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Health check failed, continue retrying
        return of(null);
      })
    );
  }

  // Check if an error is a connection/timeout error
  isConnectionError(error: HttpErrorResponse): boolean {
    return error.status === 0 || // Network error
           error.status === 408 || // Request timeout
           error.status >= 500 || // Server errors
           (error as any).name === 'TimeoutError' ||
           error.message?.includes('timeout');
  }

  // Get current connection status synchronously
  isCurrentlyConnected(): boolean {
    return this.isConnected.value;
  }
}