import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, BrandSettings } from '../../../services/admin.service';
import { HasUnsavedChanges } from '../../../guards/unsaved-changes.guard';
import { NotificationService } from '../../../services/notification.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { FloatingActionBarComponent } from '../../../components/shared/floating-action-bar/floating-action-bar.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-label-integrations',
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbComponent,
    FloatingActionBarComponent,
    IconComponent
  ],
  templateUrl: './label-integrations.component.html',
  styleUrls: []
})
export class LabelIntegrationsComponent implements OnInit, HasUnsavedChanges {
  loading = false;
  saving = false;
  brandSettings: BrandSettings | null = null;
  editingSettings: any = {};
  private savedSettings: any = null;
  editingFields: Set<string> = new Set();
  dirtyFields: Set<string> = new Set();
  private fieldOriginals: Map<string, any> = new Map();

  showPaymongoWalletId = false;
  showLoyverseApiKey = false;
  showWoocommerceConsumerKey = false;
  showWoocommerceConsumerSecret = false;

  testingIntegration: 'loyverse' | 'woocommerce' | null = null;
  testResults: Record<string, { success: boolean; message: string } | null> = {
    loyverse: null,
    woocommerce: null,
  };

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.loading = true;
    this.adminService.getBrandSettings().subscribe({
      next: (settings) => {
        this.brandSettings = settings;
        this.editingSettings = { ...settings };
        this.savedSettings = { ...settings };
        this.dirtyFields.clear();
        this.editingFields.clear();
        this.fieldOriginals.clear();
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Error loading settings');
        this.loading = false;
      }
    });
  }

  startEditing(field: string): void {
    this.fieldOriginals.set(field, this.editingSettings[field]);
    this.editingFields.add(field);
  }

  stopEditing(field: string): void {
    this.fieldOriginals.delete(field);
    this.editingFields.delete(field);
    const savedValue = this.savedSettings ? this.savedSettings[field] : undefined;
    if (this.editingSettings[field] !== savedValue) {
      this.dirtyFields.add(field);
    } else {
      this.dirtyFields.delete(field);
    }
  }

  cancelEditing(field: string): void {
    if (this.fieldOriginals.has(field)) {
      this.editingSettings[field] = this.fieldOriginals.get(field);
      this.fieldOriginals.delete(field);
    }
    this.editingFields.delete(field);
    const savedValue = this.savedSettings ? this.savedSettings[field] : undefined;
    if (this.editingSettings[field] !== savedValue) {
      this.dirtyFields.add(field);
    } else {
      this.dirtyFields.delete(field);
    }
  }

  isEditing(field: string): boolean {
    return this.editingFields.has(field);
  }

  hasDirtyFields(): boolean {
    return this.dirtyFields.size > 0;
  }

  isFormDirty(): boolean {
    return this.hasDirtyFields();
  }

  save(): void {
    if (!this.brandSettings) return;
    this.saving = true;
    const formData = { ...this.brandSettings, ...this.editingSettings };
    this.adminService.updateBrandSettings(formData).subscribe({
      next: (response) => {
        if (response.brand) {
          this.brandSettings = response.brand;
          this.editingSettings = { ...response.brand };
          this.savedSettings = { ...response.brand };
        }
        this.dirtyFields.clear();
        this.editingFields.clear();
        this.fieldOriginals.clear();
        this.notificationService.showSuccess('Integrations saved successfully');
        this.saving = false;
      },
      error: (err) => {
        const message = err?.error?.error || 'Error saving integrations';
        this.notificationService.showError(message);
        this.saving = false;
      }
    });
  }

  testConnection(integration: 'loyverse' | 'woocommerce'): void {
    // Commit any open inline edits so their values are included in the test
    const fieldsPerIntegration: Record<string, string[]> = {
      loyverse: ['loyverse_api_key'],
      woocommerce: ['woocommerce_url', 'woocommerce_consumer_key', 'woocommerce_consumer_secret'],
    };
    for (const field of fieldsPerIntegration[integration]) {
      if (this.isEditing(field)) this.stopEditing(field);
    }

    const valueKeys: Record<string, (keyof typeof this.editingSettings)[]> = {
      loyverse: ['loyverse_api_key'],
      woocommerce: ['woocommerce_url', 'woocommerce_consumer_key', 'woocommerce_consumer_secret'],
    };
    const values: any = {};
    for (const key of valueKeys[integration]) {
      values[key] = this.editingSettings[key];
    }

    this.testingIntegration = integration;
    this.testResults[integration] = null;
    this.adminService.testIntegration(integration, values).subscribe({
      next: (result) => {
        this.testResults[integration] = result;
        this.testingIntegration = null;
      },
      error: () => {
        this.testResults[integration] = { success: false, message: 'Unexpected error while testing connection.' };
        this.testingIntegration = null;
      }
    });
  }

  toggleVisibility(field: 'paymongo_wallet_id' | 'loyverse_api_key' | 'woocommerce_consumer_key' | 'woocommerce_consumer_secret'): void {
    switch (field) {
      case 'paymongo_wallet_id': this.showPaymongoWalletId = !this.showPaymongoWalletId; break;
      case 'loyverse_api_key': this.showLoyverseApiKey = !this.showLoyverseApiKey; break;
      case 'woocommerce_consumer_key': this.showWoocommerceConsumerKey = !this.showWoocommerceConsumerKey; break;
      case 'woocommerce_consumer_secret': this.showWoocommerceConsumerSecret = !this.showWoocommerceConsumerSecret; break;
    }
  }

  isVisible(field: 'paymongo_wallet_id' | 'loyverse_api_key' | 'woocommerce_consumer_key' | 'woocommerce_consumer_secret'): boolean {
    switch (field) {
      case 'paymongo_wallet_id': return this.showPaymongoWalletId;
      case 'loyverse_api_key': return this.showLoyverseApiKey;
      case 'woocommerce_consumer_key': return this.showWoocommerceConsumerKey;
      case 'woocommerce_consumer_secret': return this.showWoocommerceConsumerSecret;
    }
  }
}
