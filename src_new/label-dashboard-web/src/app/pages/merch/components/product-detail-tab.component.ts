import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { AuthService } from '../../../services/auth.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-product-detail-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './product-detail-tab.component.html',
  styleUrl: './product-detail-tab.component.scss',
})
export class ProductDetailTabComponent implements OnInit {
  product: Product | null = null;
  splits: ProductArtistSplit[] = [];
  loading = true;
  isAdmin = false;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
    private authService: AuthService,
  ) {}

  get totalSplitPercentage(): number {
    return this.splits.reduce((sum, s) => sum + s.merch_royalty_percentage * 100, 0);
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    const id = this.route.snapshot.params['id'];
    if (id) {
      const productId = parseInt(id, 10);
      forkJoin({
        product: this.productService.getProduct(productId),
        splits: this.productService.getProductArtists(productId),
      }).subscribe({
        next: ({ product, splits }) => {
          this.product = product;
          this.splits = splits;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }
}
