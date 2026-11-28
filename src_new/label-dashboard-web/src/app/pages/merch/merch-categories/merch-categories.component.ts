import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { ProductCategory } from '../../../models/product.model';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { ConfirmationService } from '../../../services/confirmation.service';
import { NotificationService } from '../../../services/notification.service';

const SUGGESTED_CATEGORIES = ['Vinyl', 'Cassette', 'CD', 'Apparel'];

@Component({
  selector: 'app-merch-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BreadcrumbComponent],
  templateUrl: './merch-categories.component.html',
})
export class MerchCategoriesComponent implements OnInit {
  categories: ProductCategory[] = [];
  loading = true;
  saving = false;

  showNewForm = false;
  newName = '';
  newDescription = '';

  editingId: number | null = null;
  editName = '';
  editDescription = '';

  get suggestedToAdd(): string[] {
    const existing = new Set(this.categories.map(c => c.name.toLowerCase()));
    return SUGGESTED_CATEGORIES.filter(s => !existing.has(s.toLowerCase()));
  }

  constructor(
    private productService: ProductService,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.productService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  openNewForm(): void {
    this.showNewForm = true;
    this.newName = '';
    this.newDescription = '';
  }

  cancelNew(): void {
    this.showNewForm = false;
  }

  quickAdd(name: string): void {
    if (this.saving) return;
    this.saving = true;
    this.productService.createCategory({ name }).subscribe({
      next: (cat) => {
        this.categories.push(cat);
        this.saving = false;
      },
      error: () => {
        this.saving = false;
        this.notificationService.showError('Failed to add category.');
      },
    });
  }

  createCategory(): void {
    if (!this.newName.trim() || this.saving) return;
    this.saving = true;
    this.productService.createCategory({
      name: this.newName.trim(),
      description: this.newDescription.trim() || undefined,
    }).subscribe({
      next: (cat) => {
        this.categories.push(cat);
        this.showNewForm = false;
        this.newName = '';
        this.newDescription = '';
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.error || 'Failed to create category.';
        this.notificationService.showError(msg);
      },
    });
  }

  startEdit(cat: ProductCategory): void {
    this.editingId = cat.id;
    this.editName = cat.name;
    this.editDescription = cat.description || '';
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(cat: ProductCategory): void {
    if (!this.editName.trim() || this.saving) return;
    this.saving = true;
    this.productService.updateCategory(cat.id, {
      name: this.editName.trim(),
      description: this.editDescription.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        const idx = this.categories.findIndex(c => c.id === cat.id);
        if (idx !== -1) this.categories[idx] = updated;
        this.editingId = null;
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.error || 'Failed to update category.';
        this.notificationService.showError(msg);
      },
    });
  }

  async deleteCategory(cat: ProductCategory): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Delete Category',
      message: `Delete "${cat.name}"?`,
      warning: 'This will remove the category from all products.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;
    this.productService.deleteCategory(cat.id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== cat.id);
      },
      error: () => this.notificationService.showError('Failed to delete category.'),
    });
  }
}
