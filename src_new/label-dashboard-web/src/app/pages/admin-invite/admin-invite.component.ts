import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-invite',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-invite.component.html',
  styleUrl: './admin-invite.component.scss'
})
export class AdminInviteComponent implements OnInit {
  loading: boolean = true;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  inviteToken: string = '';

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // First logout any existing session
    this.authService.logout();
    
    // Get invite token from query parameters
    this.route.queryParams.subscribe(params => {
      this.inviteToken = params['token'];
      if (!this.inviteToken) {
        this.router.navigate(['/login'], { queryParams: { err: 'invalid_token' } });
        return;
      }
      this.processAdminInvite();
    });
  }

  private processAdminInvite(): void {
    this.loading = true;
    this.apiService.processAdminInvite(this.inviteToken).subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.action === 'redirect_to_setup') {
          // User needs to set up profile (no password set)
          this.router.navigate(['/admin-setup'], { queryParams: { token: this.inviteToken } });
        } else if (response.action === 'redirect_to_dashboard') {
          // User already exists with password, log them in and redirect
          if (response.token) {
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
          }
          // Redirect to admin dashboard
          this.router.navigate(['/admin']);
        } else {
          this.showMessage('Unknown response from server', 'error');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error processing admin invite:', error);
        
        if (error.status === 404) {
          this.router.navigate(['/login'], { queryParams: { err: 'invalid_token' } });
        } else {
          this.showMessage(error.error?.error || 'Error processing invite', 'error');
        }
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }
}