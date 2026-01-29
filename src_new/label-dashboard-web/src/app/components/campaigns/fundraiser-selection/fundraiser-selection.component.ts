import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Fundraiser } from '../../../services/fundraiser.service';

@Component({
  selector: 'app-fundraiser-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fundraiser-selection.component.html',
  styleUrl: './fundraiser-selection.component.scss'
})
export class FundraiserSelectionComponent implements OnInit, OnDestroy {
  @Input() fundraisers: Fundraiser[] = [];
  @Input() selectedFundraiser: Fundraiser | null = null;
  @Input() loading = false;
  @Input() isAdmin = false;

  @Output() fundraiserSelected = new EventEmitter<Fundraiser>();

  isDropdownOpen = false;
  searchTerm = '';

  private boundHandleOutsideClick = this.handleOutsideClick.bind(this);

  constructor(private router: Router) {}

  ngOnInit(): void {
    document.addEventListener('click', this.boundHandleOutsideClick);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.boundHandleOutsideClick);
  }

  toggleDropdown(): void {
    if (!this.loading) {
      if (!this.isDropdownOpen) {
        this.isDropdownOpen = true;

        // Focus search input after dropdown opens
        if (this.fundraisers.length > 5) {
          setTimeout(() => {
            const searchInput = document.querySelector('.fundraiser-selection-container .search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
          }, 50);
        }
      } else {
        this.isDropdownOpen = false;
      }
    }
  }

  selectFundraiser(fundraiser: Fundraiser): void {
    this.fundraiserSelected.emit(fundraiser);
    this.isDropdownOpen = false;
    this.clearSearch();
  }

  createFundraiser(): void {
    this.router.navigate(['/campaigns/fundraisers/new']);
    this.isDropdownOpen = false;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  get filteredFundraisers(): Fundraiser[] {
    if (!this.searchTerm.trim()) {
      return this.fundraisers;
    }

    const term = this.searchTerm.toLowerCase();
    return this.fundraisers.filter(fundraiser =>
      fundraiser.title.toLowerCase().includes(term) ||
      fundraiser.description?.toLowerCase().includes(term)
    );
  }

  getFundraiserStatusText(fundraiser: Fundraiser): string {
    switch (fundraiser.status) {
      case 'draft':
        return 'Draft';
      case 'published':
        return 'Active';
      case 'closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  }

  getFundraiserStatusClass(fundraiser: Fundraiser): string {
    switch (fundraiser.status) {
      case 'draft':
        return 'badge-secondary';
      case 'published':
        return 'badge-success';
      case 'closed':
        return 'badge-warning';
      default:
        return 'badge-primary';
    }
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  onDropdownImageError(event: any): void {
    event.target.style.display = 'none';
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) {
      return '0.00';
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private handleOutsideClick(domEvent: MouseEvent): void {
    const target = domEvent.target as HTMLElement;
    const dropdown = target.closest('.fundraiser-selection-container');

    if (!dropdown && this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }
}
