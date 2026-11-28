import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit, ProductCategory } from '../../../models/product.model';
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
  categories: ProductCategory[] = [];
  loading = true;
  isAdmin = false;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
    private authService: AuthService,
  ) {}

  private static readonly AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];

  getAvatarColor(name: string): string {
    if (!name) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return ProductDetailTabComponent.AVATAR_COLORS[Math.abs(hash) % 8];
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

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
          this.categories = product.categories || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }
}
