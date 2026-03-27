import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BrandService } from '../../services/brand.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-domain-not-found',
    imports: [CommonModule],
    templateUrl: './domain-not-found.component.html',
    styleUrl: './domain-not-found.component.scss'
})
export class DomainNotFoundComponent implements OnInit {
  currentDomain: string = '';
  isChecking: boolean = true;
  reason: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private brandService: BrandService,
    private authService: AuthService
  ) {
    this.currentDomain = window.location.hostname;
  }

  ngOnInit(): void {
    this.reason = this.route.snapshot.queryParamMap.get('reason');
    if (this.reason === 'no-workspace') {
      this.isChecking = false;
      return;
    }
    this.checkDomainStatus();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private checkDomainStatus(): void {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brandSettings) => {
        // Domain is now valid, redirect to the intended URL
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl) {
          window.location.href = returnUrl;
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        // Domain is still not found, show the error page
        this.isChecking = false;
        console.error('Domain validation failed:', error);
      }
    });
  }
}