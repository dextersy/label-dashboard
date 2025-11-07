import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-invite',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invite.component.html',
  styleUrl: './invite.component.scss'
})
export class InviteComponent implements OnInit {
  loading: boolean = true;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  inviteHash: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // First logout any existing session (matching setprofile.php behavior)
    this.authService.logout();
    
    // Get invite hash from query parameters (matching original PHP invite flow)
    this.route.queryParams.subscribe(params => {
      this.inviteHash = params['hash'];
      if (!this.inviteHash) {
        this.showMessage('Invalid or expired invitation link', 'error');
        return;
      }
      this.processInvite();
    });
  }

  private processInvite(): void {
    this.loading = true;
    this.apiService.processInvite(this.inviteHash).subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.action === 'redirect_to_setup') {
          // User needs to set up profile (no password set)
          this.router.navigate(['/set-profile'], { queryParams: { hash: this.inviteHash } });
        } else if (response.action === 'redirect_to_artist') {
          // User already exists with password, mark as accepted and redirect
          if (response.token) {
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
          }
          // Redirect to artist page with selected artist
          this.router.navigate(['/artist'], { queryParams: { artist_id: response.artist_id } });
        } else {
          this.showMessage('Unknown response from server', 'error');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error processing invite:', error);

        // Use backend error message for all invite errors
        const errorMessage = error.error?.error || 'Invalid or expired invitation';
        this.showMessage(errorMessage, 'error');
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }
}