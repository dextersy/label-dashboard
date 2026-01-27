import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { FundraiserService, Fundraiser } from '../../services/fundraiser.service';

import { FundraiserSelectionComponent } from '../../components/campaigns/fundraiser-selection/fundraiser-selection.component';
import { FundraiserDonationsTabComponent } from '../../components/campaigns/fundraiser-donations-tab/fundraiser-donations-tab.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

export type FundraisersTabType = 'donations';

@Component({
  selector: 'app-fundraisers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FundraiserSelectionComponent,
    FundraiserDonationsTabComponent,
    BreadcrumbComponent
  ],
  templateUrl: './fundraisers.component.html',
  styleUrl: './fundraisers.component.scss'
})
export class FundraisersComponent implements OnInit, OnDestroy {
  selectedFundraiser: Fundraiser | null = null;
  activeTab: FundraisersTabType = 'donations';
  isAdmin = false;
  loading = false;

  private subscriptions = new Subscription();

  availableFundraisers: Fundraiser[] = [];

  tabs = [
    { id: 'donations' as FundraisersTabType, label: 'Donations', icon: 'fas fa-hand-holding-heart' }
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private fundraiserService: FundraiserService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.isAdmin = user ? user.is_admin : false;
      })
    );

    this.subscriptions.add(
      this.fundraiserService.selectedFundraiser$.subscribe(fundraiser => {
        if (fundraiser && fundraiser !== this.selectedFundraiser) {
          this.selectedFundraiser = fundraiser;
        }
      })
    );

    this.subscriptions.add(
      this.route.data.subscribe(data => {
        if (data['tab']) {
          this.activeTab = data['tab'] as FundraisersTabType;
        }
      })
    );

    this.loadAvailableFundraisers();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadAvailableFundraisers(): void {
    this.loading = true;

    this.subscriptions.add(
      this.fundraiserService.getFundraisers().subscribe({
        next: (fundraisers) => {
          this.availableFundraisers = fundraisers;

          const currentSelected = this.fundraiserService.getSelectedFundraiser();
          let fundraiserToSelect: Fundraiser | null = null;

          if (currentSelected && fundraisers.find(f => f.id === currentSelected.id)) {
            fundraiserToSelect = fundraisers.find(f => f.id === currentSelected.id) || null;
          }

          if (fundraisers.length > 0 && !fundraiserToSelect) {
            fundraiserToSelect = fundraisers[0];
          }

          if (fundraiserToSelect) {
            this.selectedFundraiser = fundraiserToSelect;
            this.fundraiserService.setSelectedFundraiser(fundraiserToSelect);
          }

          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load fundraisers:', error);
          this.notificationService.showError(error.message || 'Failed to load fundraisers');
          this.loading = false;
        }
      })
    );
  }

  onFundraiserSelection(fundraiser: Fundraiser): void {
    this.selectedFundraiser = fundraiser;
    this.fundraiserService.setSelectedFundraiser(fundraiser);
    this.refreshCurrentTabData();
  }

  openCreateFundraiserModal(): void {
    this.router.navigate(['/campaigns/fundraisers/new']);
  }

  setActiveTab(tabId: FundraisersTabType): void {
    this.activeTab = tabId;
    this.router.navigate(['/campaigns/fundraisers', tabId]);
    this.refreshCurrentTabData();
  }

  getTabClass(tabId: FundraisersTabType): string {
    return this.activeTab === tabId ? 'active' : '';
  }

  shouldShowTab(tab: any): boolean {
    return !tab.adminOnly || this.isAdmin;
  }

  onAlertMessage(message: { type: string; text: string }): void {
    if (message.type === 'success') {
      this.notificationService.showSuccess(message.text);
    } else if (message.type === 'error') {
      this.notificationService.showError(message.text);
    } else if (message.type === 'info') {
      this.notificationService.showInfo(message.text);
    }
  }

  private refreshCurrentTabData(): void {
    setTimeout(() => {
      this.fundraiserService.triggerDataRefresh();
    }, 100);
  }
}
