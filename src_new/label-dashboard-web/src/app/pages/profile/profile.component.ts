import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService, UserProfile, UpdateProfileRequest, ChangePasswordRequest } from '../../services/profile.service';
import { NotificationService } from '../../services/notification.service';
import { validatePassword } from '../../utils/password-utils';

@Component({
    selector: 'app-profile',
    imports: [CommonModule, FormsModule],
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  loading: boolean = false;
  saving: boolean = false;
  changingPassword: boolean = false;
  
  // Profile form data
  profileForm = {
    username: '',
    email: '',
    first_name: '',
    last_name: ''
  };
  
  // Password form data
  passwordForm = {
    current_password: '',
    new_password: '',
    confirm_password: ''
  };
  
  // UI state
  showPasswordChange: boolean = false;
  errors: any = {};

  // Password visibility toggles
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  constructor(
    private profileService: ProfileService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }
  
  loadProfile(): void {
    this.loading = true;
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.profileForm = {
          username: profile.username || '',
          email: profile.email_address || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        };
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.notificationService.showError('Error loading profile');
        console.error('Error loading profile:', error);
      }
    });
  }
  
  onSubmitProfile(): void {
    this.clearErrors();
    
    if (!this.validateProfileForm()) {
      return;
    }
    
    this.saving = true;
    
    const updateData: UpdateProfileRequest = {
      first_name: this.profileForm.first_name,
      last_name: this.profileForm.last_name
    };
    
    this.profileService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.saving = false;
        this.notificationService.showSuccess('Profile updated successfully');
        
        // Update local storage with new profile data
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        currentUser.first_name = this.profileForm.first_name;
        currentUser.last_name = this.profileForm.last_name;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Reload profile to get updated data
        this.loadProfile();
      },
      error: (error) => {
        this.saving = false;
        if (error.status === 400 && error.error.errors) {
          this.errors = error.error.errors;
        } else {
          this.notificationService.showError(error.error?.message || 'Error updating profile');
        }
      }
    });
  }
  
  onSubmitPassword(): void {
    this.clearErrors();
    
    if (!this.validatePasswordForm()) {
      return;
    }
    
    this.changingPassword = true;
    
    const passwordData: ChangePasswordRequest = {
      current_password: this.passwordForm.current_password,
      new_password: this.passwordForm.new_password
    };
    
    this.profileService.changePassword(passwordData).subscribe({
      next: (response) => {
        this.changingPassword = false;
        this.notificationService.showSuccess('Password changed successfully');
        
        // Reset password form and hide change password section
        this.passwordForm = {
          current_password: '',
          new_password: '',
          confirm_password: ''
        };
        this.showPasswordChange = false;
      },
      error: (error) => {
        this.changingPassword = false;
        // Handle detailed validation errors from backend
        if (error.status === 400 && error.error?.details && Array.isArray(error.error.details)) {
          const errorMessage = error.error.details.join('. ');
          this.notificationService.showError(errorMessage);
          this.errors.new_password = errorMessage;
        } else {
          this.notificationService.showError(error.error?.error || error.error?.message || 'Error changing password');
        }
      }
    });
  }
  
  togglePasswordChange(): void {
    this.showPasswordChange = !this.showPasswordChange;
    if (!this.showPasswordChange) {
      // Reset password form when hiding
      this.passwordForm = {
        current_password: '',
        new_password: '',
        confirm_password: ''
      };
      this.clearErrors();
    }
  }
  
  private validateProfileForm(): boolean {
    const errors: any = {};
    
    if (!this.profileForm.first_name?.trim()) {
      errors.first_name = 'First name is required';
    }
    
    if (!this.profileForm.last_name?.trim()) {
      errors.last_name = 'Last name is required';
    }
    
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }
  
  private validatePasswordForm(): boolean {
    const errors: any = {};

    if (!this.passwordForm.current_password?.trim()) {
      errors.current_password = 'Current password is required';
    }

    if (!this.passwordForm.new_password?.trim()) {
      errors.new_password = 'New password is required';
    } else {
      // Validate new password against security requirements
      const validation = validatePassword(this.passwordForm.new_password);
      if (!validation.isValid) {
        errors.new_password = validation.errors.join('. ');
      }
    }

    if (!this.passwordForm.confirm_password?.trim()) {
      errors.confirm_password = 'Please confirm your new password';
    }

    if (this.passwordForm.new_password && this.passwordForm.confirm_password &&
        this.passwordForm.new_password !== this.passwordForm.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }
  
  private clearErrors(): void {
    this.errors = {};
  }
  
  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  formatLastLogin(lastLogin: string | undefined): string {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
  }
}