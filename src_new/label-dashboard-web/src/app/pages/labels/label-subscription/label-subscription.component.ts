import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SubscriptionService, Plan, CurrentSubscription, EffectiveLimits } from '../../../services/subscription.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService, ConfirmationDialogData, ConfirmationDialogDetail } from '../../../services/confirmation.service';
import { environment } from '../../../../environments/environment';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

@Component({
  selector: 'app-label-subscription',
  imports: [CommonModule, BreadcrumbComponent, IconComponent, RouterLink],
  templateUrl: './label-subscription.component.html',
  styleUrls: ['./label-subscription.component.scss'],
})
export class LabelSubscriptionComponent implements OnInit, OnDestroy {
  @ViewChild('plansSection') plansSection!: ElementRef<HTMLElement>;
  loading = true;
  actionLoading = false;

  plans: Plan[] = [];
  currentSubscription: CurrentSubscription | null = null;
  usageLimits: EffectiveLimits | null = null;
  usageArtists = 0;
  usageReleasesPerArtist: Record<number, number> = {};
  usagePressCampaignsThisMonth = 0;
  usageSyncPitchesThisMonth = 0;
  usageStorageBytes = 0;
  billingCycle: 'monthly' | 'annual' = 'monthly';

  // Show a banner if returning from a PayPal checkout
  returnStatus: 'success' | 'pending' | null = null;
  pollTimedOut = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAttempts = 0;
  private readonly POLL_MAX = 10;
  private readonly POLL_INTERVAL_MS = 3000;

  readonly isDev = !environment.production;

  get isSuperadmin(): boolean {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}');
      return !!user?.is_superadmin;
    } catch {
      return false;
    }
  }

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('checkout') === 'success') {
      // PayPal redirects back — webhook may not have fired yet, poll until active
      this.returnStatus = 'pending';
    }
    this.loadPlans();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  loadPlans(): void {
    this.loading = true;
    forkJoin({
      plans: this.subscriptionService.getPlans(),
      usage: this.subscriptionService.getUsage(),
    }).subscribe({
      next: ({ plans, usage }) => {
        this.plans = plans.plans;
        this.currentSubscription = plans.currentSubscription;
        this.usageLimits = usage.limits;
        this.usageArtists = usage.usage.artists;
        this.usageReleasesPerArtist = usage.usage.releases_per_artist;
        this.usagePressCampaignsThisMonth = usage.usage.press_campaigns_this_month;
        this.usageSyncPitchesThisMonth = usage.usage.sync_pitches_this_month;
        this.usageStorageBytes = usage.usage.storage_used_bytes ?? 0;
        // Pre-select billing cycle on first load only — don't reset it during polling
        // (user may have switched the toggle while waiting for the webhook).
        if (this.currentSubscription && this.pollAttempts === 0) {
          this.billingCycle = (this.currentSubscription.pending_billing_cycle as 'monthly' | 'annual') ?? this.currentSubscription.billing_cycle;
        }
        // If we just returned from checkout, poll until the webhook marks it active
        if (this.returnStatus === 'pending') {
          if (this.currentSubscription?.status === 'active') {
            this.returnStatus = 'success';
          } else if (this.pollAttempts < this.POLL_MAX) {
            this.pollAttempts++;
            this.pollTimer = setTimeout(() => this.loadPlans(), this.POLL_INTERVAL_MS);
          } else {
            this.pollTimedOut = true;
          }
        }
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load plans');
        this.loading = false;
      },
    });
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }

  get storageLimitBytes(): number | null {
    const gb = this.usageLimits?.limit_storage_gb ?? null;
    return gb !== null ? Math.round(gb * 1024 * 1024 * 1024) : null;
  }

  usageBarWidth(used: number, limit: number | null): string {
    if (limit === null) return '0%';
    const pct = Math.min(100, Math.round((used / limit) * 100));
    return `${pct}%`;
  }

  usageBarClass(used: number, limit: number | null): string {
    if (limit === null) return '';
    const pct = (used / limit) * 100;
    if (pct > 100) return 'tw-bg-red-500';
    if (pct === 100) return 'tw-bg-amber-500';
    if (pct >= 80) return 'tw-bg-amber-500';
    return 'tw-bg-[var(--brand-color)]';
  }

  // SVG circumference for r=15.9 ≈ 99.9 ≈ 100
  private readonly CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 15.9;

  usageCircleDash(used: number, limit: number): string {
    const pct = Math.min(1, used / limit);
    const filled = pct * this.CIRCLE_CIRCUMFERENCE;
    return `${filled} ${this.CIRCLE_CIRCUMFERENCE - filled}`;
  }

  usageBarStroke(used: number, limit: number): string {
    // Over-limit is handled in template (full red ring); this handles normal range
    if (used === limit) return '#d97706'; // amber (at limit)
    if (used / limit >= 0.8) return '#d97706'; // amber (near limit)
    return 'var(--brand-color)';
  }

  get anyOverLimit(): boolean {
    if (!this.usageLimits) return false;
    return (
      (this.usageLimits.limit_artists !== null && this.usageArtists > this.usageLimits.limit_artists) ||
      (this.usageLimits.limit_press_campaigns_per_month !== null && this.usagePressCampaignsThisMonth > this.usageLimits.limit_press_campaigns_per_month) ||
      (this.usageLimits.limit_sync_pitches_per_month !== null && this.usageSyncPitchesThisMonth > this.usageLimits.limit_sync_pitches_per_month) ||
      (this.storageLimitBytes !== null && this.usageStorageBytes > this.storageLimitBytes)
    );
  }

  get overLimitWarnings(): Array<{ metric: string; value: string; max: string; over: string }> {
    if (!this.usageLimits) return [];
    const warnings = [];
    if (this.usageLimits.limit_artists !== null && this.usageArtists > this.usageLimits.limit_artists) {
      warnings.push({
        metric: 'artists',
        value: String(this.usageArtists),
        max: String(this.usageLimits.limit_artists),
        over: String(this.usageArtists - this.usageLimits.limit_artists),
      });
    }
    if (this.usageLimits.limit_press_campaigns_per_month !== null && this.usagePressCampaignsThisMonth > this.usageLimits.limit_press_campaigns_per_month) {
      warnings.push({
        metric: 'press campaigns this month',
        value: String(this.usagePressCampaignsThisMonth),
        max: String(this.usageLimits.limit_press_campaigns_per_month),
        over: String(this.usagePressCampaignsThisMonth - this.usageLimits.limit_press_campaigns_per_month),
      });
    }
    if (this.usageLimits.limit_sync_pitches_per_month !== null && this.usageSyncPitchesThisMonth > this.usageLimits.limit_sync_pitches_per_month) {
      warnings.push({
        metric: 'sync pitches this month',
        value: String(this.usageSyncPitchesThisMonth),
        max: String(this.usageLimits.limit_sync_pitches_per_month),
        over: String(this.usageSyncPitchesThisMonth - this.usageLimits.limit_sync_pitches_per_month),
      });
    }
    if (this.storageLimitBytes !== null && this.usageStorageBytes > this.storageLimitBytes) {
      warnings.push({
        metric: 'storage',
        value: this.formatBytes(this.usageStorageBytes),
        max: this.usageLimits.limit_storage_gb + ' GB',
        over: this.formatBytes(this.usageStorageBytes - this.storageLimitBytes),
      });
    }
    return warnings;
  }

  get totalReleases(): number {
    return Object.values(this.usageReleasesPerArtist).reduce((sum, n) => sum + n, 0);
  }

  get maxReleasesPerArtist(): number {
    return Object.values(this.usageReleasesPerArtist).reduce((max, n) => Math.max(max, n), 0);
  }

  get annualSavingsPercent(): number {
    // Use the first paid plan to derive the actual savings percentage
    const paidPlan = this.plans.find(p => p.price_monthly > 0 && p.price_annual > 0);
    if (!paidPlan) return 0;
    const monthlyEquivalent = paidPlan.price_monthly * 12;
    return Math.round((1 - paidPlan.price_annual / monthlyEquivalent) * 100);
  }

  /** Returns the effective period end date — real ends_at or estimated from started_at + billing cycle. */
  get effectiveEndsAt(): Date | null {
    if (!this.currentSubscription) return null;
    if (this.currentSubscription.ends_at) return new Date(this.currentSubscription.ends_at);
    if (!this.currentSubscription.started_at) return null;
    const d = new Date(this.currentSubscription.started_at);
    if (this.currentSubscription.billing_cycle === 'annual') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
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
    return this.currentSubscription?.plan_id === plan.id &&
      this.currentSubscription?.billing_cycle === this.billingCycle;
  }

  isPendingPlan(plan: Plan): boolean {
    return !!this.currentSubscription?.pending_plan_id &&
      this.currentSubscription.pending_plan_id === plan.id &&
      this.currentSubscription.pending_billing_cycle === this.billingCycle;
  }

  /** True when the pending plan is awaiting PayPal payment (not a scheduled future switch). */
  isPaymentPendingPlan(plan: Plan): boolean {
    return this.isPendingPlan(plan) && this.currentSubscription?.status === 'incomplete';
  }

  /** True when the pending plan is a scheduled future switch (downgrade/cancel scheduled). */
  isScheduledPlan(plan: Plan): boolean {
    return this.isPendingPlan(plan) && this.currentSubscription?.status !== 'incomplete';
  }

  get effectiveEndsAtLabel(): string | null {
    const d = this.effectiveEndsAt;
    if (!d) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private cyclePrice(plan: Plan, cycle: 'monthly' | 'annual'): number {
    return cycle === 'annual' ? plan.price_annual : plan.price_monthly;
  }

  isUpgrade(plan: Plan): boolean {
    if (!this.currentSubscription) return plan.price_monthly > 0;
    const currentPlan = this.plans.find((p) => p.id === this.currentSubscription!.plan_id);
    if (!currentPlan) return false;
    if (plan.id === currentPlan.id && this.billingCycle === this.currentSubscription.billing_cycle) return false;
    // Same plan billing cycle flip
    if (plan.id === currentPlan.id) return this.currentSubscription.billing_cycle === 'monthly' && this.billingCycle === 'annual';
    // Compare total payment amounts
    const currentPrice = this.cyclePrice(currentPlan, this.currentSubscription.billing_cycle);
    const newPrice = this.cyclePrice(plan, this.billingCycle);
    return newPrice > currentPrice;
  }

  isDowngrade(plan: Plan): boolean {
    if (!this.currentSubscription) return false;
    const currentPlan = this.plans.find((p) => p.id === this.currentSubscription!.plan_id);
    if (!currentPlan) return false;
    if (plan.id === currentPlan.id && this.billingCycle === this.currentSubscription.billing_cycle) return false;
    // Same plan billing cycle flip
    if (plan.id === currentPlan.id) return this.currentSubscription.billing_cycle === 'annual' && this.billingCycle === 'monthly';
    // Compare total payment amounts
    const currentPrice = this.cyclePrice(currentPlan, this.currentSubscription.billing_cycle);
    const newPrice = this.cyclePrice(plan, this.billingCycle);
    return newPrice < currentPrice;
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

  private formatCurrency(amount: number): string {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private buildUpgradeDetails(newPlan: Plan): ConfirmationDialogDetail[] {
    const currentPlan = this.plans.find(p => p.id === this.currentSubscription?.plan_id);
    const currentPrice = this.currentSubscription?.billing_cycle === 'monthly'
      ? (currentPlan?.price_monthly ?? 0)
      : (currentPlan?.price_annual ?? 0);
    const newPrice = this.billingCycle === 'monthly' ? newPlan.price_monthly : newPlan.price_annual;
    const cycleLabel = this.billingCycle === 'monthly' ? '/mo' : '/yr';

    const startedAt = this.currentSubscription?.started_at ? new Date(this.currentSubscription.started_at) : null;
    const endsAt = this.effectiveEndsAt;

    if (!endsAt || !startedAt || currentPrice === 0) {
      return [
        { label: `${newPlan.name} plan`, value: `${this.formatCurrency(newPrice)}${cycleLabel}` },
        { label: 'Charged today', value: this.formatCurrency(newPrice), bold: true, separator: true },
      ];
    }

    const now = Date.now();
    const totalMs = endsAt.getTime() - startedAt.getTime();
    const remainingMs = Math.max(0, endsAt.getTime() - now);
    const fraction = totalMs > 0 ? remainingMs / totalMs : 0;

    const credit = parseFloat((fraction * currentPrice).toFixed(2));
    const total = parseFloat(Math.max(0, newPrice - credit).toFixed(2));

    const totalDays = Math.round(totalMs / (1000 * 60 * 60 * 24));
    const remainingDays = Math.round(remainingMs / (1000 * 60 * 60 * 24));

    return [
      { label: `${newPlan.name} plan`, value: this.formatCurrency(newPrice) },
      { label: `Credit from current plan (${remainingDays} of ${totalDays} days unused)`, value: `−${this.formatCurrency(credit)}`, muted: true },
      { label: 'Charged today', value: this.formatCurrency(total), bold: true, separator: true },
      { label: `Recurring charge`, value: `${this.formatCurrency(newPrice)}${cycleLabel}`, muted: true },
    ];
  }

  private buildDowngradeDetails(newPlan: Plan): ConfirmationDialogDetail[] {
    const endsAt = this.effectiveEndsAt;
    const dateLabel = endsAt
      ? endsAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'end of billing period';
    const newPrice = this.billingCycle === 'monthly' ? newPlan.price_monthly : newPlan.price_annual;
    const cycleLabel = this.billingCycle === 'monthly' ? '/mo' : '/yr';

    return [
      { label: 'Charged today', value: 'Nothing' },
      { label: 'Current plan active until', value: dateLabel, muted: true },
      { label: 'Recurring charge from ' + dateLabel, value: newPrice === 0 ? 'Free' : `${this.formatCurrency(newPrice)}${cycleLabel}`, bold: true, separator: true },
    ];
  }

  async selectPlan(plan: Plan): Promise<void> {
    if (this.isCurrentPlan(plan)) return;

    const isDowngrade = this.isDowngrade(plan);
    const hasCurrentPaidSub = this.isCurrentPlanPaid && !!this.currentSubscription &&
      ['active', 'past_due', 'incomplete'].includes(this.currentSubscription.status);

    let details: ConfirmationDialogDetail[] | undefined;
    let message: string;
    let note: string | undefined;
    let warning: string | undefined;

    if (isDowngrade) {
      message = `Switch to the ${plan.name} plan?`;
      if (hasCurrentPaidSub) {
        details = this.buildDowngradeDetails(plan);
        note = 'You will be redirected to PayPal to authorize future billing. Your current plan stays active until the end of your billing period — no charge today.';
      }
    } else {
      // Upgrade or new subscription
      if (plan.price_monthly === 0) {
        message = `Switch to the ${plan.name} plan?`;
      } else {
        message = `Upgrade to the ${plan.name} plan?`;
        details = this.buildUpgradeDetails(plan);
        note = hasCurrentPaidSub
          ? 'You will be redirected to PayPal to complete payment. The prorated amount above will be charged as a one-time setup fee.'
          : 'You will be redirected to PayPal to complete payment. A PayPal account is required to set up recurring billing.';
      }
    }

    const confirmed = await this.confirmationService.confirm({
      title: isDowngrade ? 'Downgrade plan' : (plan.price_monthly === 0 ? 'Switch plan' : 'Upgrade plan'),
      message,
      details,
      note,
      noteIcon: plan.price_monthly > 0 ? 'paypal' : undefined,
      warning,
      confirmText: plan.price_monthly > 0 ? 'Proceed to Payment' : 'Confirm',
      cancelText: 'Cancel',
      type: isDowngrade ? 'warning' : 'info',
    } as ConfirmationDialogData);

    if (!confirmed) return;

    this.actionLoading = true;
    this.subscriptionService.initiateCheckout(plan.id, this.billingCycle).subscribe({
      next: (result) => {
        if (result.checkout_url) {
          // Redirect to PayPal — for upgrades (payment now) and downgrades (authorize future billing)
          window.location.href = result.checkout_url;
        } else if (result.immediate) {
          this.notificationService.showSuccess(`Switched to ${plan.name} plan`);
          this.loadPlans();
          this.actionLoading = false;
        } else if (result.downgrade_scheduled) {
          this.notificationService.showSuccess(`Downgrade scheduled — your ${plan.name} plan will start at the end of your current billing period`);
          this.loadPlans();
          this.actionLoading = false;
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

  scrollToPlans(): void {
    this.plansSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  get hasPendingChange(): boolean {
    return !!this.currentSubscription?.pending_plan_id;
  }

  get pendingChangePlanName(): string {
    if (!this.currentSubscription?.pending_plan_id) return '';
    const pending = this.plans.find((p) => p.id === this.currentSubscription!.pending_plan_id);
    return pending?.name ?? '';
  }

  async cancelPendingChange(): Promise<void> {
    const pendingName = this.pendingChangePlanName;
    const dateLabel = this.effectiveEndsAtLabel;

    const confirmed = await this.confirmationService.confirm({
      title: 'Cancel pending plan change',
      message: pendingName
        ? `This will cancel the scheduled change to ${pendingName}. Your current plan will continue after ${dateLabel ?? 'the billing period ends'}.`
        : `This will cancel the scheduled plan change. Your current plan will continue.`,
      confirmText: 'Yes, cancel change',
      cancelText: 'Keep change',
      type: 'warning',
      primaryAction: 'cancel',
    } as ConfirmationDialogData);

    if (!confirmed) return;

    this.actionLoading = true;
    this.subscriptionService.cancelPendingChange().subscribe({
      next: (res) => {
        this.actionLoading = false;
        if (res.checkout_url) {
          window.location.href = res.checkout_url;
        }
      },
      error: () => {
        this.notificationService.showError('Failed to cancel pending plan change');
        this.actionLoading = false;
      },
    });
  }

  async cancelSubscription(): Promise<void> {
    const endsAt = this.effectiveEndsAt;
    const dateLabel = endsAt
      ? endsAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    const confirmed = await this.confirmationService.confirm({
      title: 'Cancel subscription',
      message: dateLabel
        ? `Your plan will remain active until ${dateLabel}, then switch to Free.`
        : 'You will be downgraded to the Free plan.',
      warning: 'No refund is issued for unused time.',
      confirmText: 'Yes, cancel',
      cancelText: 'Keep subscription',
      type: 'danger',
      primaryAction: 'cancel',
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
