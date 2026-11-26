import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProductListTabComponent } from './components/product-list-tab.component';
import { ProductDetailTabComponent } from './components/product-detail-tab.component';

@Component({
  selector: 'app-merch',
  standalone: true,
  imports: [CommonModule, ProductListTabComponent, ProductDetailTabComponent],
  templateUrl: './merch.component.html',
})
export class MerchComponent implements OnInit {
  activeTab: string = 'products';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.activeTab = data['tab'] || 'products';
    });
  }
}
