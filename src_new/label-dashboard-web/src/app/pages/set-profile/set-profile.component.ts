import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { BrandService } from '../../services/brand.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { validatePassword } from '../../utils/password-utils';

export interface UserProfile {
  id: number;
  username: string;
  email_address: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  brand_id: number;
  last_login?: Date;
  created_at?: Date;
}

@Component({
    selector: 'app-set-profile',
    imports: [CommonModule, FormsModule],
    templateUrl: './set-profile.component.html',
    styleUrl: './set-profile.component.scss'
})
export class SetProfileComponent implements OnInit, OnDestroy {
  profile: UserProfile | null = null;
  loading: boolean = false;
  saving: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  
  // Password fields (matching setprofile.php)
  password: string = '';
  confirmPassword: string = '';

  // Password visibility toggles
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  // Form validation (matching setprofile.php validation)
  errors: any = {};
  
  // Username validation
  usernameExists: boolean = false;
  usernameInvalid: boolean = false;
  usernameValid: boolean = false;
  
  // Real-time validation (matching setprofile.php)
  private usernameSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  // Track if username can be changed (matching setprofile.php logic)
  canChangeUsername: boolean = true;
  
  // Invite handling
  inviteHash: string = '';
  artistAccessId: number | null = null;

  // Profile completion mode (when user has password but no username)
  isProfileCompletionMode: boolean = false;
  passwordAlreadySet: boolean = false;

  // Brand settings (matching original PHP defaults)
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
    // Check if user is already fully authenticated (has full auth token, not just temp)
    const fullAuthToken = localStorage.getItem('auth_token');
    if (fullAuthToken && fullAuthToken !== 'null' && fullAuthToken !== 'undefined') {
      // User is already authenticated - shouldn't be on this page
      // This can happen during route transitions
      return;
    }

    // Check if this is profile completion mode (temp token exists) or invite mode (hash exists)
    const tempUserData = this.authService.getTempUserData();

    if (tempUserData) {
      // Profile completion mode - user has password but no username
      this.isProfileCompletionMode = true;
      this.passwordAlreadySet = true;
      this.profile = {
        id: tempUserData.id,
        username: '',
        email_address: tempUserData.email_address,
        first_name: tempUserData.first_name || '',
        last_name: tempUserData.last_name || '',
        is_admin: false,
        brand_id: tempUserData.brand_id
      };
      this.canChangeUsername = true;
      this.setupUsernameValidation();
      this.loadBrandSettings();
    } else {
      // Original invite flow - logout and check for invite hash
      this.authService.logout();
      // Clear any stale temp auth data from previous incomplete profile attempts
      this.authService.clearTempAuthData();

      // Get invite hash from query parameters (matching invite email links)
      this.route.queryParams.subscribe(params => {
        this.inviteHash = params['hash'];
        if (!this.inviteHash) {
          this.showMessage('Invalid or expired invitation link', 'error');
          return;
        }
        this.loadInviteData();
      });
      this.setupUsernameValidation();
      this.loadBrandSettings();
    }
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
        document.title = `${this.brandName} - Login`;
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
    // Real-time username validation (matching setprofile.php)
    this.usernameSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(username => {
      this.validateUsername(username);
    });
  }

  loadInviteData(): void {
    this.loading = true;
    this.apiService.getInviteData(this.inviteHash).subscribe({
      next: (data) => {
        this.profile = data.user;
        this.artistAccessId = data.artist_access_id;
        // Check if username can be changed (matching setprofile.php logic)
        this.canChangeUsername = !this.profile?.username || this.profile.username === '';
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Error loading invite data:', error);
        // Use backend error message for all invite errors
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

    // Check username pattern (matching backend validation in authController.ts)
    const pattern = /^[a-zA-Z0-9_-]{3,30}$/;
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

    if (this.isProfileCompletionMode) {
      // Profile completion mode - call completeProfile API
      this.authService.completeProfile(
        this.profile.username,
        this.profile.first_name || undefined,
        this.profile.last_name || undefined
      ).subscribe({
        next: (response) => {
          this.showMessage('Profile completed successfully!', 'success');
          // Token already stored by authService.completeProfile
          // Keep saving = true to prevent duplicate submissions during navigation delay
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000);
        },
        error: (error) => {
          this.saving = false;
          // Handle validation errors - DO NOT clear temp auth data so user can retry
          if (error.status === 409) {
            this.errors.username = 'This username is already taken. Please choose another.';
          } else if (error.status === 400) {
            this.showMessage(error.error?.error || 'Please check your input and try again', 'error');
          } else if (error.status === 401) {
            // Session expired - clear temp auth data and redirect to login
            this.showMessage('Your session has expired. Please log in again.', 'error');
            this.authService.clearTempAuthData();
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 2000);
          } else {
            // Other errors - DO NOT clear temp auth data so user can retry
            this.showMessage(error.error?.error || 'Error completing profile', 'error');
          }
        }
      });
    } else {
      // Original invite flow - call setupUserProfile API
      const setupData = {
        id: this.profile.id,
        username: this.canChangeUsername ? this.profile.username : undefined,
        first_name: this.profile.first_name,
        last_name: this.profile.last_name,
        password: this.password,
        brand_id: this.profile.brand_id,
        is_admin: this.profile.is_admin,
        invite_hash: this.inviteHash,
        artist_access_id: this.artistAccessId
      };

      this.apiService.setupUserProfile(setupData).subscribe({
        next: (response) => {
          // Store auth token and redirect to dashboard
          if (response.token) {
            // Update auth service state before navigation
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));

            // Notify AuthService of the new user (updates currentUserSubject)
            this.authService.setCurrentUser(response.user);

            // Navigate to dashboard - auth guard should now pass
            this.router.navigate(['/dashboard']);
          }
        },
        error: (error) => {
          this.saving = false;
          if (error.status === 400) {
            if (error.error.errors) {
              this.errors = error.error.errors;
            } else if (error.error.details && Array.isArray(error.error.details)) {
              // Handle detailed validation errors from backend
              this.errors.password = error.error.details.join('. ');
            } else {
              this.showMessage(error.error?.error || error.error?.message || 'Error setting up profile', 'error');
            }
          } else {
            this.showMessage(error.error?.message || 'Error setting up profile', 'error');
          }
        }
      });
    }
  }


  private validateForm(): boolean {
    const errors: any = {};

    // Username validation (matching setprofile.php)
    if (this.canChangeUsername) {
      if (!this.profile?.username?.trim()) {
        errors.username = 'Username is required';
      } else if (this.usernameInvalid) {
        errors.username = 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens';
      } else if (this.usernameExists) {
        errors.username = 'Sorry, this username is already in use. Please choose another';
      }
    }

    // In profile completion mode, first/last name are optional
    // In invite mode, they are required
    if (!this.isProfileCompletionMode) {
      if (!this.profile?.first_name?.trim()) {
        errors.first_name = 'First name is required';
      }

      if (!this.profile?.last_name?.trim()) {
        errors.last_name = 'Last name is required';
      }
    }

    // Password validation (skip in profile completion mode - password already set)
    if (!this.isProfileCompletionMode) {
      if (!this.password?.trim()) {
        errors.password = 'Password is required';
      } else {
        // Validate password against security requirements
        const validation = validatePassword(this.password);
        if (!validation.isValid) {
          errors.password = validation.errors.join('. ');
        }
      }

      if (!this.confirmPassword?.trim()) {
        errors.confirmPassword = 'Please confirm your chosen password';
      }

      if (this.password && this.confirmPassword && this.password !== this.confirmPassword) {
        errors.passwordMismatch = 'Oops, the passwords did not match. Please check your password again';
      }
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

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin(): void {
    // Clear temp auth data when user explicitly abandons profile completion flow
    // This prevents stale session data but means user must re-authenticate
    this.authService.clearTempAuthData();
    this.router.navigate(['/login']);
  }
}