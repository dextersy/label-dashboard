import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { Product, ProductArtistSplit } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-product-detail-tab',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './product-detail-tab.component.html',
  styleUrl: './product-detail-tab.component.scss',
})
export class ProductDetailTabComponent implements OnInit {
  product: Product | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.productService.getProduct(parseInt(id, 10)).subscribe({
        next: (product) => {
          this.product = product;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }
}
