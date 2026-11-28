import { Component, Input, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, from } from 'rxjs';
import { IconComponent } from '../../../../components/shared/icon/icon.component';
import { FinancialService } from '../../../../services/financial.service';

interface TargetOption {
  id: number;
  type: 'release' | 'product';
  label: string;
}

@Component({
    selector: 'app-new-earning-form',
    imports: [CommonModule, FormsModule, IconComponent],
    templateUrl: './new-earning-form.component.html',
    styleUrl: './new-earning-form.component.scss'
})
export class NewEarningFormComponent {
  @Input() newEarningForm: any = {};
  @Input() releases: any[] = [];
  @Input() onSubmitEarning: () => Promise<void> = async () => {};
  @Input() isLoading: boolean = false;
  @Input() artistId: number | null = null;

  // Earning target search
  targetSearchQuery = '';
  targetSearchResults: { releases: TargetOption[]; products: TargetOption[] } = { releases: [], products: [] };
  showTargetDropdown = false;
  selectedTargetLabel = '';
  searchLoading = false;
  private searchSubject = new Subject<string>();

  constructor(
    private financialService: FinancialService,
    private elementRef: ElementRef,
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of(null);
        }
        this.searchLoading = true;
        return from(this.financialService.searchEarningTargets(query, this.artistId ?? undefined));
      })
    ).subscribe(result => {
      if (!result) {
        this.targetSearchResults = { releases: [], products: [] };
      } else {
        this.targetSearchResults = {
          releases: result.releases.map(r => ({
            id: r.id,
            type: 'release' as const,
            label: r.catalog_no ? `${r.catalog_no} : ${r.title}` : r.title,
          })),
          products: result.products.map(p => ({
            id: p.id,
            type: 'product' as const,
            label: p.sku ? `${p.sku} : ${p.name}` : p.name,
          })),
        };
      }
      this.searchLoading = false;
      this.showTargetDropdown = true;
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showTargetDropdown = false;
    }
  }

  onTargetSearch(): void {
    this.searchSubject.next(this.targetSearchQuery);
    // Clear selection when user types
    this.newEarningForm.release_id = '';
    this.newEarningForm.product_id = null;
    this.selectedTargetLabel = '';
  }

  selectTarget(target: TargetOption): void {
    this.selectedTargetLabel = target.label;
    this.targetSearchQuery = target.label;
    this.showTargetDropdown = false;

    if (target.type === 'release') {
      this.newEarningForm.release_id = target.id.toString();
      this.newEarningForm.product_id = null;
      // Don't change earning type — user picks it
    } else {
      this.newEarningForm.product_id = target.id;
      this.newEarningForm.release_id = '';
      this.newEarningForm.type = 'Merch';
    }
  }

  clearTarget(): void {
    this.targetSearchQuery = '';
    this.selectedTargetLabel = '';
    this.newEarningForm.release_id = '';
    this.newEarningForm.product_id = null;
    this.newEarningForm.type = 'Streaming';
  }

  get hasTarget(): boolean {
    return !!(this.newEarningForm.release_id || this.newEarningForm.product_id);
  }

  get isMerchTarget(): boolean {
    return !!this.newEarningForm.product_id;
  }

  formatReleaseOption(release: any): string {
    return `${release.catalog_no} : ${release.title}`;
  }
}