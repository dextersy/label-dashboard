import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { PublicService } from '../../services/public.service';
import { BrandService, BrandSettings } from '../../services/brand.service';

@Component({
  selector: 'app-fundraiser',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './fundraiser.component.html',
  styleUrls: ['./fundraiser.component.scss']
})
export class FundraiserComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fundraiser: any = null;
  donationForm: FormGroup;
  isLoading = false;
  isSubmitting = false;
  isError = false;
  errorMessage = '';
  submitError = '';
  brandColor = '#6f42c1';
  currentBrand: BrandSettings | null = null;
  showLightbox = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private publicService: PublicService,
    private brandService: BrandService
  ) {
    this.donationForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contact_number: [''],
      amount: ['', [Validators.required, Validators.min(20)]],
      anonymous: [false]
    });
  }

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const fundraiserId = params['id'];
      if (fundraiserId) {
        this.loadFundraiser(fundraiserId);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFundraiser(fundraiserId: string) {
    this.isLoading = true;

    forkJoin({
      brand: this.brandService.loadBrandByDomain(),
      fundraiser: this.publicService.getFundraiser(parseInt(fundraiserId, 10))
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ brand, fundraiser }) => {
          this.currentBrand = brand;
          this.fundraiser = fundraiser.fundraiser;

          if (this.currentBrand?.brand_color) {
            this.brandColor = this.currentBrand.brand_color;
          } else if (this.fundraiser.brand?.color) {
            this.brandColor = this.fundraiser.brand.color;
          }

          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading fundraiser:', error);
          this.showError('Unable to load fundraiser. Please try again later.');
        }
      });
  }

  showError(message: string) {
    this.isLoading = false;
    this.isError = true;
    this.errorMessage = message;
  }

  onSubmit() {
    if (this.donationForm.valid && this.fundraiser) {
      this.isSubmitting = true;

      const donationRequest = {
        fundraiser_id: this.fundraiser.id,
        name: this.donationForm.value.name,
        email: this.donationForm.value.email,
        contact_number: this.donationForm.value.contact_number || '',
        amount: parseFloat(this.donationForm.value.amount),
        anonymous: this.donationForm.value.anonymous || false
      };

      this.submitError = '';
      this.publicService.makeDonation(donationRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success && response.checkout_url) {
              window.location.href = response.checkout_url;
            } else {
              this.isSubmitting = false;
              this.submitError = 'There was an error processing your payment. Please try again.';
            }
          },
          error: (error) => {
            console.error('Error making donation:', error);
            this.isSubmitting = false;
            this.submitError = 'There was an error processing your payment. Please try again.';
          }
        });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.donationForm.controls).forEach(key => {
        this.donationForm.get(key)?.markAsTouched();
      });

      // Focus on the first invalid field
      this.focusFirstInvalidField();
    }
  }

  private focusFirstInvalidField(): void {
    // Check fields in display order
    const fieldOrder = ['amount', 'name', 'email'];

    for (const fieldName of fieldOrder) {
      const control = this.donationForm.get(fieldName);
      if (control?.invalid) {
        const element = document.getElementById(fieldName);
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  }

  formatPrice(price: number): string {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get nameControl() {
    return this.donationForm.get('name');
  }

  get emailControl() {
    return this.donationForm.get('email');
  }

  get amountControl() {
    return this.donationForm.get('amount');
  }

  openLightbox() {
    if (this.fundraiser?.poster_url) {
      this.showLightbox = true;
    }
  }

  closeLightbox() {
    this.showLightbox = false;
  }
}
