import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BrandService } from '../../services/brand.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginField: string = '';
  password: string = '';
  loading: boolean = false;
  errorMessage: string = '';
  errorType: string = '';
  redirectUrl: string = '';
  showResetSuccess: boolean = false;
  lockTimeMinutes: number = 0;
  
  // Brand settings (matching original PHP defaults)
  brandLogo: string = 'assets/img/Melt Records-logo-WHITE.png';
  brandName: string = 'Melt Records';
  brandColor: string = '#667eea';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private brandService: BrandService
  ) {}

  ngOnInit(): void {
    // Check for query parameters (matching original PHP conditions)
    this.route.queryParams.subscribe(params => {
      // Handle error parameters
      if (params['err']) {
        this.errorType = params['err'];
        this.errorMessage = '';
      }
      
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
      this.router.navigate(['/dashboard']);
    }

    this.loadBrandSettings();
    this.setupLoadingOverlay();
  }

  loadBrandSettings(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        this.brandLogo = brandSettings.logo;
        this.brandName = brandSettings.name;
        this.brandColor = brandSettings.color;
      },
      error: (error) => {
        console.error('Error loading brand settings:', error);
        // Use defaults if brand service fails
        this.brandLogo = 'assets/img/Melt Records-logo-WHITE.png';
        this.brandName = 'Melt Records';
        this.brandColor = '#667eea';
      }
    });
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

    this.loading = true;
    this.errorMessage = '';
    this.errorType = '';

    // Show loading overlay (matching original behavior)
    this.showLoadingOverlay();

    this.apiService.login(this.loginField, this.password).subscribe({
      next: (response) => {
        if (response.token) {
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('user_data', JSON.stringify(response.user));
          
          const redirectTo = this.redirectUrl || '/dashboard';
          this.router.navigate([redirectTo]);
        }
        this.loading = false;
        this.hideLoadingOverlay();
      },
      error: (error) => {
        this.loading = false;
        this.hideLoadingOverlay();
        
        if (error.status === 404) {
          this.errorType = 'no_user';
        } else if (error.status === 401) {
          this.errorType = 'pass';
        } else if (error.status === 423) {
          this.errorType = 'lock';
          this.lockTimeMinutes = error.error.lockTime || 2; // Default 2 minutes like original
        } else {
          this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        }
      }
    });
  }
}
