import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

export interface AdminProfile {
  id: number;
  username: string;
  email_address: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  brand_id: number;
}

export interface BrandInfo {
  id: number;
  name: string;
  primary_color: string;
}

@Component({
  selector: 'app-admin-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-setup.component.html',
  styleUrl: './admin-setup.component.scss'
})
export class AdminSetupComponent implements OnInit, OnDestroy {
  profile: AdminProfile | null = null;
  brand: BrandInfo | null = null;
  loading: boolean = false;
  saving: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  
  // Password fields
  password: string = '';
  confirmPassword: string = '';

  // Form validation
  errors: any = {};
  
  // Username validation
  usernameExists: boolean = false;
  usernameInvalid: boolean = false;
  usernameValid: boolean = false;
  
  // Real-time validation
  private usernameSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  // Track if username can be changed
  canChangeUsername: boolean = true;
  
  // Invite handling
  inviteToken: string = '';

  // Brand settings
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    // First logout any existing session
    this.authService.logout();
    
    // Get invite token from query parameters
    this.route.queryParams.subscribe(params => {
      this.inviteToken = params['token'];
      if (!this.inviteToken) {
        this.showMessage('Invalid or expired invitation link', 'error');
        return;
      }
      this.loadInviteData();
    });
    this.setupUsernameValidation();
    this.loadBrandSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.brand_color;
        
        // Apply brand styling to the page
        document.documentElement.style.setProperty('--brand-color', this.brandColor);
        document.title = `${this.brandName} - Admin Setup`;
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        const currentUrl = window.location.href;
        this.router.navigate(['/domain-not-found'], { 
          queryParams: { returnUrl: currentUrl } 
        });
      }
    });
  }

  private setupUsernameValidation(): void {
    // Real-time username validation
    this.usernameSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(username => {
      this.validateUsername(username);
    });
  }

  loadInviteData(): void {
    this.loading = true;
    this.apiService.getAdminInviteData(this.inviteToken).subscribe({
      next: (data) => {
        this.profile = data.user;
        this.brand = data.brand;
        // Check if username can be changed
        this.canChangeUsername = !this.profile?.username || this.profile.username === '';
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Error loading admin invite data:', error);
        // Use backend error message for all admin invite errors
        const errorMessage = error.error?.error || 'Invalid or expired invitation';
        this.showMessage(errorMessage, 'error');
      }
    });
  }

  onUsernameChange(username: string): void {
    this.usernameSubject.next(username);
  }

  private validateUsername(username: string): void {
    if (!username || !this.canChangeUsername) return;

    // Reset validation states
    this.usernameExists = false;
    this.usernameInvalid = false;
    this.usernameValid = false;

    // Check username pattern
    const pattern = /^[A-Za-z0-9_]+$/;
    if (!pattern.test(username)) {
      this.usernameInvalid = true;
      return;
    }

    // Check if username exists
    this.apiService.checkUsernameExists(username, this.profile?.brand_id).subscribe({
      next: (response) => {
        if (response.result === 'true') {
          this.usernameExists = true;
        } else {
          this.usernameValid = true;
        }
      },
      error: (error) => {
        console.error('Error checking username:', error);
      }
    });
  }

  onSubmit(): void {
    if (!this.profile) return;

    this.clearErrors();
    
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    this.message = '';

    const setupData = {
      invite_hash: this.inviteToken,
      username: this.canChangeUsername ? this.profile.username : undefined,
      first_name: this.profile.first_name,
      last_name: this.profile.last_name,
      password: this.password
    };

    this.apiService.setupAdminProfile(setupData).subscribe({
      next: (response) => {
        this.saving = false;
        // Store auth token and redirect to admin dashboard
        if (response.token) {
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          this.router.navigate(['/admin']);
        }
      },
      error: (error) => {
        this.saving = false;
        if (error.status === 400 && error.error.errors) {
          this.errors = error.error.errors;
        } else {
          this.showMessage(error.error?.error || 'Error setting up profile', 'error');
        }
      }
    });
  }

  private validateForm(): boolean {
    const errors: any = {};

    // Username validation
    if (this.canChangeUsername) {
      if (!this.profile?.username?.trim()) {
        errors.username = 'Username is required';
      } else if (this.usernameInvalid) {
        errors.username = 'Only alphanumeric characters [A-Z, a-z, 0-9] and underscores are allowed';
      } else if (this.usernameExists) {
        errors.username = 'Sorry, this username is already in use. Please choose another';
      }
    }

    // Required fields
    if (!this.profile?.first_name?.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!this.profile?.last_name?.trim()) {
      errors.last_name = 'Last name is required';
    }

    // Password validation
    if (!this.password?.trim()) {
      errors.password = 'Password is required';
    }

    if (!this.confirmPassword?.trim()) {
      errors.confirmPassword = 'Please confirm your chosen password';
    }

    if (this.password && this.confirmPassword && this.password !== this.confirmPassword) {
      errors.passwordMismatch = 'Oops, the passwords did not match. Please check your password again';
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  private clearErrors(): void {
    this.errors = {};
    this.message = '';
    this.usernameExists = false;
    this.usernameInvalid = false;
    this.usernameValid = false;
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}