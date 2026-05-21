import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BrandService } from '../../services/brand.service';
import { validatePassword } from '../../utils/password-utils';
import { IconComponent } from '../../components/shared/icon/icon.component';

@Component({
    selector: 'app-reset-password',
    imports: [CommonModule, FormsModule, IconComponent],
    templateUrl: './reset-password.component.html',
    styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  password: string = '';
  validation: string = '';
  resetCode: string = '';
  loading: boolean = false;
  error: boolean = false;
  errorMessage: string = '';

  // Password visibility toggles
  showPassword: boolean = false;
  showValidation: boolean = false;

  // Brand settings
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';
  brandId: number | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    // Get reset code from URL
    this.route.queryParams.subscribe(params => {
      this.resetCode = params['code'];

      // Handle mismatch error from URL
      if (params['err'] === 'mismatch') {
        this.errorMessage = 'The passwords you input were mismatched. Please try again.';
      }

      // Load brand first to get brandId, then validate the hash with it
      this.loadBrandSettings();
    });
  }

  validateResetHash(): void {
    this.apiService.validateResetHash(this.resetCode, this.brandId ?? undefined).subscribe({
      next: () => {
        this.error = false;
      },
      error: (error) => {
        this.error = true;
        this.errorMessage = error.error?.error || 'Invalid or expired reset link';
      }
    });
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.brand_color;
        this.brandId = brandSettings.id;
        
        // Apply brand styling to the page
        BrandService.setCssVars(this.brandColor);
        document.title = `${this.brandName} - Reset Password`;

        // Now that we have brandId, validate the reset hash
        if (this.resetCode) {
          this.validateResetHash();
        } else {
          this.error = true;
          this.errorMessage = 'Invalid or expired reset link';
        }
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

  onSubmit(): void {
    if (!this.password || !this.validation) {
      this.errorMessage = 'Please fill in both password fields';
      return;
    }

    if (this.password !== this.validation) {
      this.errorMessage = 'The passwords you input were mismatched. Please try again.';
      return;
    }

    // Validate password against security requirements
    const validation = validatePassword(this.password);
    if (!validation.isValid) {
      this.errorMessage = validation.errors.join('. ');
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.apiService.resetPassword(this.resetCode, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        // Redirect to login with success message
        this.router.navigate(['/login'], {
          queryParams: { resetpass: '1' }
        });
      },
      error: (error) => {
        this.loading = false;
        if (error.status === 400) {
          // Handle detailed validation errors from backend
          if (error.error?.details && Array.isArray(error.error.details)) {
            this.errorMessage = error.error.details.join('. ');
          } else {
            this.errorMessage = error.error?.error || 'Invalid or expired reset token';
          }
          this.error = true;
        } else {
          this.errorMessage = error.error?.error || 'An error occurred. Please try again.';
        }
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleValidationVisibility(): void {
    this.showValidation = !this.showValidation;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}