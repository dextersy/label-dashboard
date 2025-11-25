import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, User, LoginAttempt } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService } from '../../../services/confirmation.service';
import { PaginatedTableComponent, PaginationInfo, TableColumn, SearchFilters, SortInfo } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
    selector: 'app-users-tab',
    imports: [CommonModule, FormsModule, PaginatedTableComponent],
    templateUrl: './users-tab.component.html'
})
export class UsersTabComponent implements OnInit {
  // Users
  displayUsers: any[] = []; // Transformed users for display
  usersPagination: PaginationInfo | null = null;
  usersLoading: boolean = false;
  usersFilters: any = {};
  usersSort: SortInfo | null = null;
  
  // Login attempts
  loginAttempts: LoginAttempt[] = [];
  loginAttemptsPagination: PaginationInfo | null = null;
  loginAttemptsLoading: boolean = false;
  loginAttemptsFilters: any = {};
  loginAttemptsSort: SortInfo | null = null;

  // Admin invite modal
  showInviteModal: boolean = false;
  inviteForm = {
    email_address: '',
    first_name: '',
    last_name: ''
  };
  inviteLoading: boolean = false;

  // Table column definitions
  usersColumns: TableColumn[] = [
    { key: 'username', label: 'Username', type: 'text', searchable: true, sortable: true },
    { key: 'first_name', label: 'First Name', type: 'text', searchable: true, sortable: true },
    { key: 'last_name', label: 'Last Name', type: 'text', searchable: true, sortable: true },
    { key: 'email_address', label: 'Email address', type: 'text', searchable: true, sortable: true },
    { key: 'last_logged_in', label: 'Last logged in', type: 'date', searchable: false, sortable: true },
    { key: 'is_admin', label: 'Is administrator', type: 'text', searchable: false, sortable: true }
  ];

  loginAttemptsColumns: TableColumn[] = [
    { key: 'username', label: 'Username', type: 'text', searchable: true, sortable: true },
    { key: 'name', label: 'Name', type: 'text', searchable: true, sortable: true },
    { key: 'date_and_time', label: 'Time', type: 'date', searchable: true, sortable: true },
    { key: 'result', label: 'Result', type: 'text', searchable: true, sortable: true },
    { key: 'remote_ip', label: 'Remote IP', type: 'text', searchable: true, sortable: true }
  ];

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadUsers(1, this.usersFilters, this.usersSort);
    this.loadLoginAttempts(1, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  // Transform users data for display (called once when data is loaded)
  private transformUsersForDisplay(users: User[]): any[] {
    return users.map(user => ({
      ...user,
      username: user.has_pending_invite ? '(Pending Invite)' : user.username,
      first_name: user.has_pending_invite ? '-' : (user.first_name || ''),
      last_name: user.has_pending_invite ? '-' : (user.last_name || '')
    }));
  }

  loadUsers(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.usersLoading = true;
    
    this.adminService.getUsers(page, 15, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.displayUsers = this.transformUsersForDisplay(response.data);
        this.usersPagination = response.pagination;
        this.usersLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading users');
        this.usersLoading = false;
      }
    });
  }

  loadLoginAttempts(page: number, filters: any = {}, sort: SortInfo | null = null): void {
    this.loginAttemptsLoading = true;
    
    this.adminService.getLoginAttempts(page, 20, filters, sort?.column, sort?.direction).subscribe({
      next: (response) => {
        this.loginAttempts = response.data;
        this.loginAttemptsPagination = response.pagination;
        this.loginAttemptsLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error loading login attempts');
        this.loginAttemptsLoading = false;
      }
    });
  }

  toggleAdminStatus(userId: number): void {
    this.adminService.toggleAdminStatus(userId).subscribe({
      next: () => {
        this.loadUsers(this.usersPagination?.current_page || 1);
        this.notificationService.showSuccess('Admin status updated successfully');
      },
      error: (error) => {
        this.notificationService.showError('Error updating admin status');
      }
    });
  }

  // Users table pagination handlers
  onUsersPageChange(page: number): void {
    this.loadUsers(page, this.usersFilters, this.usersSort);
  }

  onUsersFiltersChange(filters: SearchFilters): void {
    this.usersFilters = filters;
    this.loadUsers(1, this.usersFilters, this.usersSort);
  }

  onUsersSortChange(sort: SortInfo | null): void {
    this.usersSort = sort;
    this.loadUsers(this.usersPagination?.current_page || 1, this.usersFilters, this.usersSort);
  }

  // Login attempts table pagination handlers
  onLoginAttemptsPageChange(page: number): void {
    this.loadLoginAttempts(page, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  onLoginAttemptsFiltersChange(filters: SearchFilters): void {
    this.loginAttemptsFilters = filters;
    this.loadLoginAttempts(1, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  onLoginAttemptsSortChange(sort: SortInfo | null): void {
    this.loginAttemptsSort = sort;
    this.loadLoginAttempts(this.loginAttemptsPagination?.current_page || 1, this.loginAttemptsFilters, this.loginAttemptsSort);
  }

  // Admin invite functions
  openInviteModal(): void {
    this.showInviteModal = true;
    this.inviteForm = {
      email_address: '',
      first_name: '',
      last_name: ''
    };
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
    this.inviteForm = {
      email_address: '',
      first_name: '',
      last_name: ''
    };
  }

  sendInvite(): void {
    if (!this.inviteForm.email_address.trim()) {
      this.notificationService.showError('Email address is required');
      return;
    }

    this.inviteLoading = true;
    this.adminService.inviteAdmin(this.inviteForm).subscribe({
      next: () => {
        this.notificationService.showSuccess('Admin invitation sent successfully');
        this.closeInviteModal();
        this.loadUsers(this.usersPagination?.current_page || 1);
        this.inviteLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(error.error?.error || 'Failed to send invitation');
        this.inviteLoading = false;
      }
    });
  }

  resendInvite(userId: number): void {
    this.adminService.resendAdminInvite(userId).subscribe({
      next: () => {
        this.notificationService.showSuccess('Admin invitation resent successfully');
      },
      error: (error) => {
        this.notificationService.showError(error.error?.error || 'Failed to resend invitation');
      }
    });
  }

  async cancelInvite(userId: number): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Cancel Admin Invitation',
      message: 'Are you sure you want to cancel this admin invitation?',
      confirmText: 'Cancel Invitation',
      cancelText: 'Keep Invitation',
      type: 'warning'
    });

    if (!confirmed) return;

    this.adminService.cancelAdminInvite(userId).subscribe({
      next: () => {
        this.notificationService.showSuccess('Admin invitation cancelled successfully');
        this.loadUsers(this.usersPagination?.current_page || 1);
      },
      error: (error) => {
        this.notificationService.showError(error.error?.error || 'Failed to cancel invitation');
      }
    });
  }
}