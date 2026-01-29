import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FundraiserService, Fundraiser } from '../../services/fundraiser.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { FundraiserSelectionComponent } from '../../components/campaigns/fundraiser-selection/fundraiser-selection.component';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-fundraiser-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BreadcrumbComponent,
    FundraiserSelectionComponent,
    QuillModule
  ],
  templateUrl: './fundraiser-form.component.html',
  styleUrl: './fundraiser-form.component.scss'
})
export class FundraiserFormComponent implements OnInit, OnDestroy {
  fundraiserId: number | null = null;
  fundraiser: Fundraiser | null = null;
  loading = false;
  saving = false;
  isNewFundraiser = false;
  isAdmin = false;
  availableFundraisers: Fundraiser[] = [];

  // Form data
  fundraiserData: any = {
    title: '',
    description: '',
    poster_url: '',
    status: 'draft'
  };

  selectedPosterFile: File | null = null;
  posterPreview: string | null = null;
  originalFundraiserData: any = null;

  // Quill editor config
  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  };

  // Character limits for rich text fields (visible characters, not HTML)
  descriptionCharLimit = 5000;
  descriptionCharCount = 0;

  private subscriptions = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService,
    private fundraiserService: FundraiserService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    // Check if this is /fundraisers/new or /fundraisers/details
    const currentPath = this.router.url.split('?')[0];
    this.isNewFundraiser = currentPath.endsWith('/new');

    if (this.isNewFundraiser) {
      // New fundraiser mode
      this.initializeNewFundraiser();
    } else {
      // Edit mode - get fundraiser from FundraiserService
      this.loadAvailableFundraisers();
      this.subscriptions.add(
        this.fundraiserService.selectedFundraiser$.subscribe(fundraiser => {
          if (fundraiser) {
            this.fundraiser = fundraiser;
            this.fundraiserId = fundraiser.id;
            this.loadFundraiser();
          } else if (this.availableFundraisers.length > 0) {
            // Auto-select first fundraiser if none selected
            const firstFundraiser = this.availableFundraisers[0];
            this.fundraiserService.setSelectedFundraiser(firstFundraiser);
          }
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadAvailableFundraisers(): void {
    this.subscriptions.add(
      this.fundraiserService.getFundraisers().subscribe({
        next: (fundraisers) => {
          this.availableFundraisers = fundraisers;
          // Check if there's a selected fundraiser from FundraiserService
          const selectedFundraiser = this.fundraiserService.getSelectedFundraiser();
          if (!selectedFundraiser && fundraisers.length > 0) {
            this.fundraiserService.setSelectedFundraiser(fundraisers[0]);
          }
        },
        error: (error) => {
          console.error('Error loading fundraisers:', error);
          this.notificationService.showError('Failed to load fundraisers');
        }
      })
    );
  }

  onFundraiserSelection(fundraiser: Fundraiser): void {
    this.fundraiserService.setSelectedFundraiser(fundraiser);
  }

  private loadFundraiser(): void {
    if (!this.fundraiserId) return;

    this.loading = true;
    this.subscriptions.add(
      this.fundraiserService.getFundraiser(this.fundraiserId).subscribe({
        next: (fundraiser) => {
          this.fundraiser = fundraiser;
          this.populateFormFromFundraiser(fundraiser);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading fundraiser:', error);
          this.notificationService.showError('Failed to load fundraiser details');
          this.loading = false;
          this.router.navigate(['/campaigns/fundraisers']);
        }
      })
    );
  }

  private initializeNewFundraiser(): void {
    // Initialize with default values for new fundraiser
    this.fundraiser = null;
    this.fundraiserData = {
      title: '',
      description: '',
      poster_url: '',
      status: 'draft'
    };
  }

  onCancel(): void {
    this.router.navigate(['/campaigns/fundraisers']);
  }

  onSave(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    const isPublished = this.isFundraiserPublished();
    const status = isPublished ? 'published' : 'draft';

    const saveObservable = this.isNewFundraiser
      ? this.fundraiserService.createFundraiser({
          title: this.fundraiserData.title,
          description: this.fundraiserData.description,
          poster_file: this.selectedPosterFile || undefined,
          status: status
        })
      : this.fundraiserService.updateFundraiser(this.fundraiserId!, {
          title: this.fundraiserData.title,
          description: this.fundraiserData.description,
          poster_file: this.selectedPosterFile || undefined,
          poster_url: this.selectedPosterFile ? undefined : this.fundraiserData.poster_url,
          status: status
        });

    this.subscriptions.add(
      saveObservable.subscribe({
        next: (fundraiser) => {
          const message = this.isFundraiserPublished() ? 'Fundraiser updated successfully' : 'Fundraiser saved as draft';
          this.notificationService.showSuccess(message);
          this.saving = false;
          if (this.isNewFundraiser) {
            // Set the newly created fundraiser as selected and navigate to details
            this.fundraiserService.setSelectedFundraiser(fundraiser);
            this.router.navigate(['/campaigns/fundraisers/details']);
          } else {
            // Update the fundraiser object and reset dirty tracking
            this.fundraiser = fundraiser;
            this.fundraiserService.setSelectedFundraiser(fundraiser);
            this.originalFundraiserData = JSON.parse(JSON.stringify(this.fundraiserData));
            this.selectedPosterFile = null;
          }
        },
        error: (error) => {
          console.error('Error saving fundraiser:', error);
          this.notificationService.showError('Failed to save fundraiser');
          this.saving = false;
        }
      })
    );
  }

  async onPublish(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    const confirmed = await this.confirmationService.confirm({
      title: 'Publish Fundraiser',
      message: 'Are you sure you want to publish this fundraiser?\n\n' +
        'Once published, the fundraiser will be visible to the public and people can start donating.\n\n' +
        'Click \'Publish\' to proceed.',
      confirmText: 'Publish',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) return;

    this.saving = true;

    // First save the fundraiser, then publish
    const saveObservable = this.isNewFundraiser
      ? this.fundraiserService.createFundraiser({
          title: this.fundraiserData.title,
          description: this.fundraiserData.description,
          poster_file: this.selectedPosterFile || undefined,
          status: 'published'
        })
      : this.fundraiserService.updateFundraiser(this.fundraiserId!, {
          title: this.fundraiserData.title,
          description: this.fundraiserData.description,
          poster_file: this.selectedPosterFile || undefined,
          poster_url: this.selectedPosterFile ? undefined : this.fundraiserData.poster_url,
          status: 'published'
        });

    this.subscriptions.add(
      saveObservable.subscribe({
        next: (fundraiser) => {
          this.saving = false;
          this.fundraiser = fundraiser;
          this.fundraiserService.setSelectedFundraiser(fundraiser);
          this.notificationService.showSuccess('Fundraiser published successfully!');

          if (this.isNewFundraiser) {
            this.router.navigate(['/campaigns/fundraisers/details']);
          } else {
            this.populateFormFromFundraiser(fundraiser);
          }
        },
        error: (error) => {
          console.error('Error publishing fundraiser:', error);
          this.notificationService.showError('Failed to publish fundraiser');
          this.saving = false;
        }
      })
    );
  }

  async onUnpublish(): Promise<void> {
    if (!this.fundraiserId) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Unpublish Fundraiser',
      message: 'Are you sure you want to unpublish this fundraiser? It will no longer be visible to the public and donations will stop.',
      confirmText: 'Unpublish',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    this.saving = true;

    this.subscriptions.add(
      this.fundraiserService.unpublishFundraiser(this.fundraiserId).subscribe({
        next: (fundraiser) => {
          this.saving = false;
          this.fundraiser = fundraiser;
          this.fundraiserService.setSelectedFundraiser(fundraiser);
          this.populateFormFromFundraiser(fundraiser);
          this.notificationService.showSuccess('Fundraiser unpublished successfully');
        },
        error: (error) => {
          console.error('Error unpublishing fundraiser:', error);
          this.notificationService.showError('Failed to unpublish fundraiser');
          this.saving = false;
        }
      })
    );
  }

  async onClose(): Promise<void> {
    if (!this.fundraiserId) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Close Fundraiser',
      message: 'Are you sure you want to close this fundraiser?\n\n' +
        'The fundraiser page will show as completed and no new donations will be accepted.',
      confirmText: 'Close Fundraiser',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    this.saving = true;

    this.subscriptions.add(
      this.fundraiserService.closeFundraiser(this.fundraiserId).subscribe({
        next: (fundraiser) => {
          this.saving = false;
          this.fundraiser = fundraiser;
          this.fundraiserService.setSelectedFundraiser(fundraiser);
          this.populateFormFromFundraiser(fundraiser);
          this.notificationService.showSuccess('Fundraiser closed successfully');
        },
        error: (error) => {
          console.error('Error closing fundraiser:', error);
          this.notificationService.showError('Failed to close fundraiser');
          this.saving = false;
        }
      })
    );
  }

  async onReopen(): Promise<void> {
    if (!this.fundraiserId) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Reopen Fundraiser',
      message: 'Are you sure you want to reopen this fundraiser?\n\n' +
        'The fundraiser will be published again and will accept new donations.',
      confirmText: 'Reopen Fundraiser',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) return;

    this.saving = true;

    this.subscriptions.add(
      this.fundraiserService.reopenFundraiser(this.fundraiserId).subscribe({
        next: (fundraiser) => {
          this.saving = false;
          this.fundraiser = fundraiser;
          this.fundraiserService.setSelectedFundraiser(fundraiser);
          this.populateFormFromFundraiser(fundraiser);
          this.notificationService.showSuccess('Fundraiser reopened successfully');
        },
        error: (error) => {
          console.error('Error reopening fundraiser:', error);
          this.notificationService.showError('Failed to reopen fundraiser');
          this.saving = false;
        }
      })
    );
  }

  onPosterSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.notificationService.showError('Please select a valid image file (JPG, PNG, GIF, WebP).');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.notificationService.showError('File is too large. Please select an image smaller than 10MB.');
        return;
      }

      this.selectedPosterFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.posterPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onPosterUploadKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const posterInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
      if (posterInput) {
        posterInput.click();
      }
    }
  }

  removePoster(): void {
    this.selectedPosterFile = null;
    this.posterPreview = null;
    this.fundraiserData.poster_url = '';
  }

  isFundraiserDraft(): boolean {
    if (this.isNewFundraiser) return true;
    const status = this.fundraiser?.status || this.fundraiserData?.status;
    return status === 'draft' || !status;
  }

  isFundraiserPublished(): boolean {
    if (this.isNewFundraiser) return false;
    const status = this.fundraiser?.status || this.fundraiserData?.status;
    return status === 'published';
  }

  isFundraiserClosed(): boolean {
    if (this.isNewFundraiser) return false;
    const status = this.fundraiser?.status || this.fundraiserData?.status;
    return status === 'closed';
  }

  hasDonations(): boolean {
    return (this.fundraiser?.donationCount || 0) > 0;
  }

  isFormDirty(): boolean {
    if (!this.originalFundraiserData) return false;
    const dataChanged = JSON.stringify(this.fundraiserData) !== JSON.stringify(this.originalFundraiserData);
    return dataChanged || this.selectedPosterFile !== null;
  }

  private validateForm(): boolean {
    if (!this.fundraiserData.title || !this.fundraiserData.title.trim()) {
      this.notificationService.showError('Fundraiser title is required');
      return false;
    }

    if (this.descriptionCharCount > this.descriptionCharLimit) {
      this.notificationService.showError(`Description exceeds the ${this.descriptionCharLimit.toLocaleString()} character limit`);
      return false;
    }

    return true;
  }

  private populateFormFromFundraiser(fundraiser: Fundraiser): void {
    this.posterPreview = null;
    this.selectedPosterFile = null;

    this.fundraiserData = {
      title: fundraiser.title || '',
      description: fundraiser.description || '',
      poster_url: fundraiser.poster_url || '',
      status: fundraiser.status || 'draft'
    };

    // Initialize description character count from loaded content
    this.descriptionCharCount = this.getPlainTextLength(fundraiser.description || '');

    if (fundraiser.poster_url) {
      this.posterPreview = fundraiser.poster_url;
    }

    // Store original data for dirty checking
    this.originalFundraiserData = JSON.parse(JSON.stringify(this.fundraiserData));
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) {
      return '0.00';
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onDescriptionContentChanged(event: any): void {
    // event.text contains the plain text without HTML tags
    // Quill adds a trailing newline, so we trim it
    const text = event.text ? event.text.replace(/\n$/, '') : '';
    this.descriptionCharCount = text.length;
  }

  private getPlainTextLength(html: string): number {
    if (!html) return 0;
    // Create a temporary element to extract plain text from HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || '';
    return text.replace(/\n$/, '').length;
  }
}
