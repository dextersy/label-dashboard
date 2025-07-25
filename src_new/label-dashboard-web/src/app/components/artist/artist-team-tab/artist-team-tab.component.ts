import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Artist } from '../artist-selection/artist-selection.component';
import { environment } from 'environments/environment';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  status: 'Pending' | 'Accepted';
  invited_date: string;
}

@Component({
  selector: 'app-artist-team-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './artist-team-tab.component.html',
  styleUrl: './artist-team-tab.component.scss'
})
export class ArtistTeamTabComponent {
  @Input() artist: Artist | null = null;
  @Output() alertMessage = new EventEmitter<{type: 'success' | 'error', message: string}>();

  teamMembers: TeamMember[] = [];
  loading = false;
  inviteEmail = '';
  sendingInvite = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.artist) {
      this.loadTeamMembers();
    }
  }

  ngOnChanges(): void {
    if (this.artist) {
      this.loadTeamMembers();
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadTeamMembers(): void {
    if (!this.artist) return;

    this.loading = true;
    
    this.http.get<{teamMembers: TeamMember[]}>(`${environment.apiUrl}/artists/${this.artist.id}/team`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.teamMembers = data.teamMembers;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading team members:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'Failed to load team members.'
        });
        this.loading = false;
      }
    });
  }

  sendInvite(): void {
    if (!this.artist || !this.inviteEmail.trim()) {
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.inviteEmail.trim())) {
      this.alertMessage.emit({
        type: 'error',
        message: 'Please enter a valid email address.'
      });
      return;
    }

    this.sendingInvite = true;

    this.http.post<{success: boolean, message: string, teamMember?: TeamMember}>(
      `${environment.apiUrl}/artists/${this.artist.id}/team/invite`,
      { email: this.inviteEmail.trim() },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          if (response.teamMember) {
            this.teamMembers.push(response.teamMember);
          }
          this.alertMessage.emit({
            type: 'success',
            message: response.message || 'Team member invited successfully!'
          });
          this.inviteEmail = '';
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to send invitation.'
          });
        }
        this.sendingInvite = false;
      },
      error: (error) => {
        console.error('Error sending invite:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while sending the invitation.'
        });
        this.sendingInvite = false;
      }
    });
  }

  resendInvite(member: TeamMember): void {
    if (!this.artist) return;

    this.http.post<{success: boolean, message: string}>(
      `${environment.apiUrl}/artists/${this.artist.id}/team/${member.id}/resend`,
      {},
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.alertMessage.emit({
            type: 'success',
            message: response.message || 'Invitation resent successfully!'
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to resend invitation.'
          });
        }
      },
      error: (error) => {
        console.error('Error resending invite:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while resending the invitation.'
        });
      }
    });
  }

  removeMember(member: TeamMember): void {
    if (!this.artist) return;

    if (!confirm(`Are you sure you want to remove ${member.name} from the team?`)) {
      return;
    }

    this.http.delete<{success: boolean, message: string}>(
      `${environment.apiUrl}/artists/${this.artist.id}/team/${member.id}`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.teamMembers = this.teamMembers.filter(m => m.id !== member.id);
          this.alertMessage.emit({
            type: 'success',
            message: response.message || 'Team member removed successfully!'
          });
        } else {
          this.alertMessage.emit({
            type: 'error',
            message: response.message || 'Failed to remove team member.'
          });
        }
      },
      error: (error) => {
        console.error('Error removing team member:', error);
        this.alertMessage.emit({
          type: 'error',
          message: 'An error occurred while removing the team member.'
        });
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    return status === 'Accepted' ? 'badge-success' : 'badge-warning';
  }

  getStatusIcon(status: string): string {
    return status === 'Accepted' ? 'fa-check-circle' : 'fa-clock-o';
  }
}