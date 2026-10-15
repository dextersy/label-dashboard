import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { IconComponent } from '../../../../components/shared/icon/icon.component';
import { PaginatedTableComponent, TableAction, TableColumn } from '../../../../components/shared/paginated-table/paginated-table.component';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { Event } from '../../../../services/event.service';
import { environment } from '../../../../../environments/environment';

interface Collaborator {
  event_id: number;
  user_id: number | null;
  invite_email: string;
  role: 'viewer' | 'manager';
  status: 'Pending' | 'Invited' | 'Accepted';
  createdAt: string;
  user?: { id: number; first_name: string; last_name: string; email_address: string } | null;
  // flattened for table display
  name: string;
  email: string;
}

@Component({
  selector: 'app-event-access-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginatedTableComponent, IconComponent],
  templateUrl: './event-access-tab.component.html',
  styleUrl: './event-access-tab.component.scss',
})
export class EventAccessTabComponent implements OnChanges {
  @Input() selectedEvent!: Event;

  collaborators: Collaborator[] = [];
  loading = false;
  sendingInvite = false;
  inviteEmail = '';
  inviteRole: 'viewer' | 'manager' = 'viewer';

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private confirmationService: ConfirmationService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedEvent'] && this.selectedEvent) {
      this.loadCollaborators();
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadCollaborators(): void {
    this.loading = true;
    this.http.get<{ collaborators: Collaborator[] }>(
      `${this.apiUrl}/event-access/${this.selectedEvent.id}/collaborators`,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.collaborators = res.collaborators.map(c => ({
          ...c,
          name: c.user
            ? [c.user.first_name, c.user.last_name].filter(Boolean).join(' ') || c.user.email_address
            : c.invite_email,
          email: c.invite_email,
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  sendInvite(): void {
    if (!this.inviteEmail.trim()) return;
    this.sendingInvite = true;
    this.http.post<any>(
      `${this.apiUrl}/event-access/${this.selectedEvent.id}/collaborators`,
      { email: this.inviteEmail.trim(), role: this.inviteRole },
      { headers: this.getHeaders() }
    ).subscribe({
      next: () => {
        this.inviteEmail = '';
        this.inviteRole = 'viewer';
        this.sendingInvite = false;
        this.loadCollaborators();
      },
      error: () => { this.sendingInvite = false; },
    });
  }

  formatDate(date: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColorIndex(name: string): number {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 8;
  }

  getAvatarColor(name: string): string {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];
    return colors[this.getAvatarColorIndex(name)];
  }

  getStatusClass(status: string): string {
    if (status === 'Accepted') return 'status-badge status-success';
    if (status === 'Invited' || status === 'Pending') return 'status-badge status-warning';
    return 'status-badge status-secondary';
  }

  get tableColumns(): TableColumn[] {
    return [
      {
        key: 'name',
        label: 'Name',
        cardHeader: true,
        renderHtml: true,
        formatter: (c: Collaborator) => {
          const idx = this.getAvatarColorIndex(c.name);
          const initials = this.getInitials(c.name);
          return `<span class="avatar-chip"><span class="avatar-chip__circle ac-${idx}">${initials}</span>${c.name}</span>`;
        }
      },
      { key: 'email', label: 'Email' },
      {
        key: 'role',
        label: 'Role',
        searchable: false,
        renderHtml: true,
        formatter: (c: Collaborator) =>
          `<span class="badge ${c.role === 'manager' ? 'bg-primary' : 'bg-secondary'}">${c.role.charAt(0).toUpperCase() + c.role.slice(1)}</span>`
      },
      {
        key: 'status',
        label: 'Status',
        searchable: false,
        renderHtml: true,
        formatter: (c: Collaborator) =>
          `<span class="${this.getStatusClass(c.status)}">${c.status}</span>`
      },
      {
        key: 'createdAt',
        label: 'Invited',
        searchable: false,
        formatter: (c: Collaborator) => this.formatDate(c.createdAt)
      },
    ];
  }

  get tableActions(): TableAction[] {
    return [
      {
        icon: 'trash',
        label: 'Remove',
        type: 'danger',
        handler: (c: Collaborator) => this.removeCollaborator(c),
      }
    ];
  }

  removeCollaborator(c: Collaborator): void {
    this.confirmationService.confirm({
      title: 'Remove team member',
      message: `Remove access for ${c.invite_email}?`,
      confirmText: 'Remove',
      type: 'danger',
    }).then(confirmed => {
      if (!confirmed) return;
      this.http.delete<any>(
        `${this.apiUrl}/event-access/${this.selectedEvent.id}/collaborators`,
        { headers: this.getHeaders(), body: { user_id: c.user_id } }
      ).subscribe({ next: () => this.loadCollaborators() });
    });
  }
}
