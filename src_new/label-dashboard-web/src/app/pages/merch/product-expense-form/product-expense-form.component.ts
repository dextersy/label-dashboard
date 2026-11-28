import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ProductService } from '../../../services/product.service';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { Product } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-product-expense-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, BreadcrumbComponent],
  templateUrl: './product-expense-form.component.html',
})
export class ProductExpenseFormComponent implements OnInit {
  submitting = false;

  // Product search
  productSearchQuery = '';
  productSearchResults: Product[] = [];
  showProductDropdown = false;
  searchLoading = false;
  selectedProduct: Product | null = null;
  private searchSubject = new Subject<string>();

  form = {
    expense_description: '',
    expense_amount: '',
    date_recorded: new Date().toISOString().split('T')[0],
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private elementRef: ElementRef,
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) return of(null);
        this.searchLoading = true;
        return this.productService.getProducts({ search: query, limit: 10 });
      })
    ).subscribe(result => {
      this.productSearchResults = result?.products ?? [];
      this.searchLoading = false;
      this.showProductDropdown = true;
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showProductDropdown = false;
    }
  }

  ngOnInit(): void {
    const productIdParam = this.route.snapshot.queryParams['product_id'];
    if (productIdParam) {
      const productId = parseInt(productIdParam as string, 10);
      this.productService.getProduct(productId).subscribe({
        next: (product) => this.applySelectedProduct(product),
        error: () => { /* user can search manually */ }
      });
    }
  }

  onProductSearch(): void {
    this.selectedProduct = null;
    this.searchSubject.next(this.productSearchQuery);
  }

  selectProduct(product: Product): void {
    this.applySelectedProduct(product);
    this.showProductDropdown = false;
  }

  private applySelectedProduct(product: Product): void {
    this.selectedProduct = product;
    this.productSearchQuery = product.sku ? `${product.sku} : ${product.name}` : product.name;
  }

  clearProduct(): void {
    this.selectedProduct = null;
    this.productSearchQuery = '';
    this.productSearchResults = [];
  }

  get hasProduct(): boolean {
    return !!this.selectedProduct;
  }

  get isFormValid(): boolean {
    return this.hasProduct && !!this.form.expense_description && !!this.form.expense_amount;
  }

  async onSubmit(): Promise<void> {
    if (!this.selectedProduct || this.submitting) return;

    this.submitting = true;
    try {
      await this.financialService.addProductExpense(this.selectedProduct.id, this.form);
      this.notificationService.showSuccess('Recuperable expense added successfully');
      this.router.navigate(['/merch/products', this.selectedProduct.id]);
    } catch {
      this.notificationService.showError('Failed to add expense');
    } finally {
      this.submitting = false;
    }
  }
}
