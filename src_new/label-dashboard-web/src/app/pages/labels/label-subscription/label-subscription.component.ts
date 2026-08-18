import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SubscriptionService, Plan, CurrentSubscription } from '../../../services/subscription.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService, ConfirmationDialogData } from '../../../services/confirmation.service';
import { environment } from '../../../../environments/environment';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-label-subscription',
  imports: [CommonModule, BreadcrumbComponent, IconComponent],
  templateUrl: './label-subscription.component.html',
  styleUrls: ['./label-subscription.component.scss'],
})
export class LabelSubscriptionComponent implements OnInit {
  loading = true;
  actionLoading = false;

  plans: Plan[] = [];
  currentSubscription: CurrentSubscription | null = null;
  billingCycle: 'monthly' | 'annual' = 'monthly';

  // Show a banner if returning from a PayMongo checkout
  returnStatus: 'success' | 'pending' | null = null;

  readonly isDev = !environment.production;

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.has('subscription')) {
      // PayMongo redirects back — webhook may not have fired yet
      this.returnStatus = 'pending';
    }
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.subscriptionService.getPlans().subscribe({
      next: (data) => {
        this.plans = data.plans;
        this.currentSubscription = data.currentSubscription;
        // Pre-select billing cycle to match current subscription
        if (this.currentSubscription) {
          this.billingCycle = this.currentSubscription.billing_cycle;
        }
        // If we just returned from checkout and subscription is now active, clear the pending banner
        if (this.returnStatus === 'pending' && this.currentSubscription?.status === 'active') {
          this.returnStatus = 'success';
        }
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load plans');
        this.loading = false;
      },
    });
  }

  get annualSavingsPercent(): number {
    // Use the first paid plan to derive the actual savings percentage
    const paidPlan = this.plans.find(p => p.price_monthly > 0 && p.price_annual > 0);
    if (!paidPlan) return 0;
    const monthlyEquivalent = paidPlan.price_monthly * 12;
    return Math.round((1 - paidPlan.price_annual / monthlyEquivalent) * 100);
  }

  get currentPlanName(): string {
    if (!this.currentSubscription) return '';
    return this.plans.find((p) => p.id === this.currentSubscription!.plan_id)?.name ?? '';
  }

  get isCurrentPlanPaid(): boolean {
    if (!this.currentSubscription) return false;
    const plan = this.plans.find((p) => p.id === this.currentSubscription!.plan_id);
    return !!plan && plan.price_monthly > 0;
  }

  isCurrentPlan(plan: Plan): boolean {
    return this.currentSubscription?.plan_id === plan.id;
  }

  isUpgrade(plan: Plan): boolean {
    if (!this.currentSubscription) return plan.price_monthly > 0;
    const currentPlan = this.plans.find((p) => p.id === this.currentSubscription!.plan_id);
    if (!currentPlan) return false;
    return plan.sort_order > currentPlan.sort_order;
  }

  isDowngrade(plan: Plan): boolean {
    if (!this.currentSubscription) return false;
    const currentPlan = this.plans.find((p) => p.id === this.currentSubscription!.plan_id);
    if (!currentPlan) return false;
    return plan.sort_order < currentPlan.sort_order;
  }

  displayPrice(plan: Plan): number {
    return this.billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  }

  displayPriceLabel(plan: Plan): string {
    if (plan.price_monthly === 0) return 'Free';
    const price = this.displayPrice(plan);
    const suffix = this.billingCycle === 'monthly' ? '/mo' : '/yr';
    return `₱${price.toLocaleString()}${suffix}`;
  }

  limitLabel(value: number | null): string {
    return value === null ? 'Unlimited' : value.toLocaleString();
  }

  feeLabel(plan: Plan, type: 'event' | 'fundraiser'): string {
    const pct = type === 'event'
      ? plan.default_event_revenue_percentage_fee
      : plan.default_fundraiser_revenue_percentage_fee;
    const basis = type === 'event'
      ? plan.default_event_fee_revenue_type
      : plan.default_fundraiser_fee_revenue_type;
    if (pct === 0) return 'Processing fee only';
    return `${pct}% of ${basis} revenue`;
  }

  feeSaving(plan: Plan, type: 'event' | 'fundraiser'): string | null {
    const freePlan = this.plans.find(p => p.price_monthly === 0);
    if (!freePlan || plan.id === freePlan.id) return null;

    const freePct = type === 'event'
      ? freePlan.default_event_revenue_percentage_fee
      : freePlan.default_fundraiser_revenue_percentage_fee;
    const planPct = type === 'event'
      ? plan.default_event_revenue_percentage_fee
      : plan.default_fundraiser_revenue_percentage_fee;

    const saved = freePct - planPct;
    if (saved <= 0) return null;
    return `Save ${saved}%`;
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      active: 'status-success',
      incomplete: 'status-warning',
      past_due: 'status-warning',
      unpaid: 'status-danger',
      cancelled: 'status-secondary',
    };
    return map[status] ?? 'status-secondary';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Active',
      incomplete: 'Payment Pending',
      past_due: 'Payment Past Due',
      unpaid: 'Unpaid',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }

  async selectPlan(plan: Plan): Promise<void> {
    if (this.isCurrentPlan(plan)) return;

    const priceLabel = plan.price_monthly === 0
      ? 'free'
      : `₱${this.displayPrice(plan).toLocaleString()}/${this.billingCycle === 'monthly' ? 'mo' : 'yr'}`;

    const confirmed = await this.confirmationService.confirm({
      title: this.isDowngrade(plan) ? 'Switch plan' : 'Upgrade plan',
      message: `Switch to the ${plan.name} plan (${priceLabel})?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: this.isDowngrade(plan) ? 'warning' : 'info',
    } as ConfirmationDialogData);

    if (!confirmed) return;

    this.actionLoading = true;
    this.subscriptionService.initiateCheckout(plan.id, this.billingCycle).subscribe({
      next: (result) => {
        if (result.immediate) {
          this.notificationService.showSuccess(`Switched to ${plan.name} plan`);
          this.loadPlans();
          this.actionLoading = false;
        } else if (result.checkout_url) {
          // Redirect to PayMongo hosted checkout for first payment
          window.location.href = result.checkout_url;
        }
      },
      error: () => {
        this.notificationService.showError('Failed to initiate checkout');
        this.actionLoading = false;
      },
    });
  }

  devOverride(plan: Plan): void {
    this.actionLoading = true;
    this.subscriptionService.devOverridePlan(plan.id, this.billingCycle).subscribe({
      next: () => {
        this.notificationService.showSuccess(`[Dev] Switched to ${plan.name}`);
        this.loadPlans();
        this.actionLoading = false;
      },
      error: () => {
        this.notificationService.showError('[Dev] Override failed');
        this.actionLoading = false;
      },
    });
  }

  async cancelSubscription(): Promise<void> {
    const confirmed = await this.confirmationService.confirm({
      title: 'Cancel subscription',
      message: 'You will be downgraded to the Free plan immediately.',
      confirmText: 'Yes, cancel',
      cancelText: 'Keep subscription',
      type: 'danger',
    } as ConfirmationDialogData);

    if (!confirmed) return;

    this.actionLoading = true;
    this.subscriptionService.cancelSubscription().subscribe({
      next: () => {
        this.notificationService.showSuccess('Subscription cancelled');
        this.loadPlans();
        this.actionLoading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to cancel subscription');
        this.actionLoading = false;
      },
    });
  }
}
