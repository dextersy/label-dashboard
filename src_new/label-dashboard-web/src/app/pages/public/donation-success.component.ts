import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandService, BrandSettings } from '../../services/brand.service';

@Component({
  selector: 'app-donation-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './donation-success.component.html',
  styleUrls: ['./donation-success.component.scss']
})
export class DonationSuccessComponent implements OnInit {
  brandColor = '#6f42c1';
  currentBrand: BrandSettings | null = null;
  isLoading = true;

  constructor(private brandService: BrandService) {}

  ngOnInit() {
    this.loadBrand();
  }

  loadBrand() {
    this.brandService.loadBrandByDomain().subscribe({
      next: (brand) => {
        this.currentBrand = brand;
        if (brand?.brand_color) {
          this.brandColor = brand.brand_color;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading brand:', error);
        this.isLoading = false;
      }
    });
  }
}
