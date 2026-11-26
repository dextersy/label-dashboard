import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductListTabComponent } from './components/product-list-tab.component';
import { ProductDetailTabComponent } from './components/product-detail-tab.component';
import { ProductGalleryTabComponent } from './components/product-gallery-tab.component';
import { InPageNavComponent, InPageNavTab } from '../../components/shared/in-page-nav/in-page-nav.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-merch',
  standalone: true,
  imports: [CommonModule, ProductListTabComponent, ProductDetailTabComponent, ProductGalleryTabComponent, InPageNavComponent, BreadcrumbComponent],
  templateUrl: './merch.component.html',
})
export class MerchComponent implements OnInit {
  activeTab: string = 'products';
  productId: number | null = null;

  productNavTabs: InPageNavTab[] = [
    { id: 'product-detail', label: 'Details', icon: 'info' },
    { id: 'product-gallery', label: 'Gallery', icon: 'images' },
  ];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.activeTab = data['tab'] || 'products';
    });
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.productId = parseInt(params['id'] as string, 10);
      }
    });
  }

  get isProductView(): boolean {
    return this.activeTab === 'product-detail' || this.activeTab === 'product-gallery';
  }

  onProductTabChange(tabId: string): void {
    if (!this.productId) return;
    if (tabId === 'product-detail') {
      this.router.navigate(['/merch/products', this.productId]);
    } else if (tabId === 'product-gallery') {
      this.router.navigate(['/merch/products', this.productId, 'gallery']);
    }
  }
}
