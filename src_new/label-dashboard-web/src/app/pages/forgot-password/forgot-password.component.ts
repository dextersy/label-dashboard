import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BrandService } from '../../services/brand.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnInit {
  email: string = '';
  loading: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | '' = '';
  
  // Brand settings
  brandLogo: string = 'assets/img/Your Logo Here.png';
  brandName: string = 'Label Dashboard';
  brandColor: string = '#667eea';

  constructor(
    private router: Router,
    private apiService: ApiService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    this.loadBrandSettings();
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo_url || 'assets/img/Your Logo Here.png';
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.brand_color;
        
        // Apply brand styling to the page
        document.documentElement.style.setProperty('--brand-color', this.brandColor);
        document.title = `${this.brandName} - Forgot Password`;
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        this.router.navigate(['/domain-not-found']);
      }
    });
  }

  onSubmit(): void {
    if (!this.email) {
      this.showMessage('Please enter your email address', 'error');
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.showMessage('Please enter a valid email address', 'error');
      return;
    }

    this.loading = true;
    this.message = '';

    this.apiService.forgotPassword(this.email).subscribe({
      next: (response) => {
        this.loading = false;
        this.showMessage('Password reset instructions have been sent to your email address', 'success');
        this.email = '';
      },
      error: (error) => {
        this.loading = false;
        if (error.status === 404) {
          this.showMessage('No account found with this email address', 'error');
        } else if (error.status === 429) {
          this.showMessage('Too many requests. Please try again later', 'error');
        } else {
          this.showMessage(error.error?.message || 'An error occurred. Please try again', 'error');
        }
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}