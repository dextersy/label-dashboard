import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BrandService } from '../../services/brand.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  
  // Brand settings
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';

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
      if (!this.resetCode) {
        this.error = true;
        this.errorMessage = 'The link you used is invalid.';
        this.loadBrandSettings();
      } else {
        // Validate reset hash like original PHP
        this.validateResetHash();
      }
      
      // Handle mismatch error from URL
      if (params['err'] === 'mismatch') {
        this.errorMessage = 'The passwords you input were mismatched. Please try again.';
      }
    });
  }

  validateResetHash(): void {
    this.apiService.validateResetHash(this.resetCode).subscribe({
      next: (response) => {
        // Hash is valid, load brand settings and show form
        this.error = false;
        this.loadBrandSettings();
      },
      error: (error) => {
        // Hash is invalid, show error
        this.error = true;
        this.errorMessage = 'The link you used is invalid.';
        this.loadBrandSettings();
      }
    });
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.brand_color;
        
        // Apply brand styling to the page
        document.documentElement.style.setProperty('--brand-color', this.brandColor);
        document.title = `${this.brandName} - Reset Password`;
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        this.router.navigate(['/domain-not-found']);
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

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
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
          this.errorMessage = error.error?.message || 'Invalid reset token';
          this.error = true;
        } else {
          this.errorMessage = 'An error occurred. Please try again.';
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}