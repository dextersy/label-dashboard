import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BrandService } from '../../services/brand.service';
import { AuthService } from '../../services/auth.service';
import { WorkspaceService } from '../../services/workspace.service';

@Component({
    selector: 'app-login',
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  @ViewChild('passwordField', { static: false }) passwordField!: ElementRef<HTMLInputElement>;
  
  loginField: string = '';
  password: string = '';
  loading: boolean = false;
  errorMessage: string = '';
  errorType: string = '';
  redirectUrl: string = '';
  showResetSuccess: boolean = false;
  lockTimeMinutes: number = 0;

  // Password visibility toggle
  showPassword: boolean = false;
  
  // Brand settings (matching original PHP defaults)
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';
  brandId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private brandService: BrandService,
    private authService: AuthService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    // Check for query parameters
    this.route.queryParams.subscribe(params => {
      // Handle reset password success
      if (params['resetpass'] === '1') {
        this.showResetSuccess = true;
      }

      // Handle redirect URL
      if (params['url']) {
        this.redirectUrl = params['url'];
      }
    });

    // Check if user is already logged in (similar to original PHP check)
    const loggedInUser = localStorage.getItem('auth_token');
    if (loggedInUser) {
      this.router.navigate([this.getDefaultPageForWorkspace()]);
    }

    this.loadBrandSettings();
    this.setupLoadingOverlay();
  }

  loadBrandSettings(): void {
    // First check if brand settings are already loaded (from app component)
    const currentBrandSettings = this.brandService.getCurrentBrandSettings();
    if (currentBrandSettings) {
      this.setBrandSettings(currentBrandSettings);
      return;
    }

    // Subscribe to brand settings changes (will be triggered when app component loads brand)
    this.brandService.brandSettings$.subscribe(brandSettings => {
      if (brandSettings) {
        this.setBrandSettings(brandSettings);
      }
    });
  }

  private setBrandSettings(brandSettings: any): void {
    this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
    this.brandName = brandSettings.name;
    this.brandColor = brandSettings.brand_color;
    this.brandId = brandSettings.id;
    
    // Apply brand styling to the page
    document.documentElement.style.setProperty('--brand-color', this.brandColor);
    document.title = `${this.brandName} - Login`;
  }

  private setupLoadingOverlay(): void {
    // Set up beforeunload event (matching original JavaScript)
    window.addEventListener('beforeunload', () => {
      this.showLoadingOverlay();
    });
  }

  private showLoadingOverlay(): void {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
  }

  private hideLoadingOverlay(): void {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }

  onSubmit(): void {
    if (!this.loginField || !this.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    if (this.brandId === null) {
      this.errorMessage = 'Brand information not loaded. Please refresh the page.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.errorType = '';

    // Show loading overlay (matching original behavior)
    this.showLoadingOverlay();

    this.authService.login(this.loginField, this.password, this.brandId).subscribe({
      next: (response) => {
        this.loading = false;
        this.hideLoadingOverlay();

        // Check if profile is incomplete
        if (response.status === 'profile_incomplete') {
          // Redirect to set-profile page (reused for profile completion)
          this.router.navigate(['/set-profile']);
          return;
        }

        // Normal login - redirect to workspace default page or specified URL
        if (response.token) {
          const redirectTo = this.redirectUrl || this.getDefaultPageForWorkspace();
          this.router.navigate([redirectTo]);
        }
      },
      error: (error) => {
        this.loading = false;
        this.hideLoadingOverlay();

        // Handle authentication errors with generic messaging to prevent user enumeration
        if (error.status === 401) {
          // Use backend error message or fallback to generic message
          this.errorMessage = error.error?.error || 'Invalid username or password';
          this.errorType = ''; // Clear any specific error type

          // Clear password field and focus it for authentication failure
          this.password = '';
          setTimeout(() => {
            if (this.passwordField) {
              this.passwordField.nativeElement.focus();
            }
          }, 100);
        } else if (error.status === 423) {
          // Account locked - this is safe to be specific about
          this.errorType = 'lock';
          // Extract lock time from backend error message if available
          const lockTimeMatch = error.error?.error?.match(/(\d+)\s+minutes?/);
          this.lockTimeMinutes = lockTimeMatch ? parseInt(lockTimeMatch[1]) : 2;
        } else {
          // Generic error for other cases
          this.errorMessage = error.error?.error || 'Login failed. Please try again.';
          this.errorType = '';
        }
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private getDefaultPageForWorkspace(): string {
    const workspace = this.workspaceService.currentWorkspace;
    switch (workspace) {
      case 'music':
        return '/dashboard';
      case 'campaigns':
        return '/campaigns/events/details';
      case 'admin':
        return '/admin/settings';
      default:
        return '/dashboard';
    }
  }
}
