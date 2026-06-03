import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface BrandChoice {
  id: number;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginField = '';
  password = '';
  loading = false;
  errorMessage = '';
  showPassword = false;

  loginState: 'login' | 'brand_selection' = 'login';
  brandChoices: BrandChoice[] = [];
  selectionToken = '';

  constructor(private http: HttpClient) {}

  onSubmit(): void {
    if (!this.loginField || !this.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http.post<any>(`${environment.apiUrl}/auth/login-unified`, {
      email: this.loginField,
      password: this.password,
    }).subscribe({
      next: (response) => {
        this.loading = false;

        if (response.status === 'brand_selection') {
          this.brandChoices = response.brands;
          this.selectionToken = response.selection_token;
          this.loginState = 'brand_selection';
          return;
        }

        this.redirectAfterLogin(response);
      },
      error: (error) => {
        this.loading = false;
        if (error.status === 423) {
          const m = error.error?.error?.match(/(\d+)\s+minutes?/);
          this.errorMessage = `Account temporarily locked. Please try again in ${m ? m[1] : '2'} minutes.`;
        } else {
          this.errorMessage = error.error?.error || 'Invalid username or password';
          this.password = '';
        }
      }
    });
  }

  selectBrand(brandId: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.post<any>(`${environment.apiUrl}/auth/select-brand`, {
      selection_token: this.selectionToken,
      brand_id: brandId,
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.redirectAfterLogin(response);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.error || 'Login failed. Please try again.';
        this.loginState = 'login';
      }
    });
  }

  backToLogin(): void {
    this.loginState = 'login';
    this.brandChoices = [];
    this.selectionToken = '';
    this.errorMessage = '';
    this.password = '';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  private redirectAfterLogin(response: any): void {
    if (response.frontend_url && response.token) {
      window.location.href = `${response.frontend_url}?auth_token=${encodeURIComponent(response.token)}`;
    } else if (response.status === 'profile_incomplete' && response.frontend_url) {
      window.location.href = `${response.frontend_url}/set-profile?auth_token=${encodeURIComponent(response.token)}`;
    } else {
      this.errorMessage = 'Login succeeded but no dashboard URL is configured for your account. Please contact your label admin.';
    }
  }
}
