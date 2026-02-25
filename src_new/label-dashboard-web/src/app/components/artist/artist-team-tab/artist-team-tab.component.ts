import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Artist } from '../artist-selection/artist-selection.component';
import { environment } from 'environments/environment';
import { ConfirmationService } from '../../../services/confirmation.service';
import { PaginatedTableComponent, TableAction, TableColumn } from '../../shared/paginated-table/paginated-table.component';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  status: 'Pending' | 'Accepted';
  invited_date: string;
}

@Component({
    selector: 'app-artist-team-tab',
    imports: [CommonModule, FormsModule, PaginatedTableComponent],
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

  constructor(
    private http: HttpClient,
    private confirmationService: ConfirmationService
  ) {}

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

  get teamColumns(): TableColumn[] {
    return [
      {
        key: 'name',
        label: 'Name',
        cardHeader: true
      },
      {
        key: 'email',
        label: 'Email'
      },
      {
        key: 'status',
        label: 'Status',
        searchable: false,
        renderHtml: true,
        formatter: (member: TeamMember) => {
          const cls = this.getStatusClass(member.status);
          const icon = this.getStatusIcon(member.status);
          return `<span class="badge ${cls}"><i class="fa ${icon}"></i> ${member.status}</span>`;
        }
      },
      {
        key: 'invited_date',
        label: 'Invited Date',
        searchable: false,
        formatter: (member: TeamMember) => this.formatDate(member.invited_date)
      }
    ];
  }

  get teamActions(): TableAction[] {
    return [
      {
        icon: 'fa-solid fa-paper-plane',
        label: 'Resend Invite',
        handler: (member: TeamMember) => this.resendInvite(member),
        hidden: (member: TeamMember) => member.status !== 'Pending'
      },
      {
        icon: 'fa-solid fa-trash',
        label: 'Remove',
        type: 'danger',
        handler: (member: TeamMember) => this.removeMember(member)
      }
    ];
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

  async removeMember(member: TeamMember): Promise<void> {
    if (!this.artist) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove ${member.name} from the team?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

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
    return status === 'Accepted' ? 'fa-check-circle' : 'fa-clock';
  }
}
