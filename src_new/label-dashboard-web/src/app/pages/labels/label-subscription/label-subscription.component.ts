import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SubscriptionService, Plan, CurrentSubscription, EffectiveLimits, SubscriptionInvoice, SubscriptionPayment, BillingDetails } from '../../../services/subscription.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationService, ConfirmationDialogData, ConfirmationDialogDetail } from '../../../services/confirmation.service';
import { environment } from '../../../../environments/environment';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';
import { InPageNavComponent, InPageNavTab } from '../../../components/shared/in-page-nav/in-page-nav.component';
import { PaginatedTableComponent, PaginationInfo, TableColumn } from '../../../components/shared/paginated-table/paginated-table.component';

@Component({
  selector: 'app-label-subscription',
  imports: [CommonModule, FormsModule, BreadcrumbComponent, IconComponent, RouterLink, InPageNavComponent, PaginatedTableComponent],
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

  // In-page nav
  activeSection: 'subscription' | 'invoices' | 'payments' | 'billing-details' = 'subscription';
  readonly navTabs: InPageNavTab[] = [
    { id: 'subscription', label: 'Subscription', icon: 'layers' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt' },
    { id: 'payments', label: 'Payments', icon: 'credit-card' },
    { id: 'billing-details', label: 'Billing Details', icon: 'receipt' },
  ];

  // Billing details tab
  billingDetails: BillingDetails | null = null;
  billingDetailsLoading = false;
  billingDetailsSaving = false;
  editingBillingFields: Set<string> = new Set();
  editingBillingValues: Partial<BillingDetails> = {};
  private billingFieldOriginals: Map<string, string | null> = new Map();

  // Invoices tab
  invoices: SubscriptionInvoice[] = [];
  invoicesLoading = false;
  invoicesLoaded = false;
  invoicesPage = 1;
  invoicesTotalPages = 1;
  invoicesTotal = 0;

  // Payments tab
  payments: SubscriptionPayment[] = [];
  paymentsLoading = false;
  paymentsLoaded = false;
  paymentsPage = 1;
  paymentsTotalPages = 1;
  paymentsTotal = 0;

  private formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  downloadingInvoiceId: number | null = null;

  readonly invoiceColumns: TableColumn[] = [
    {
      key: 'createdAt', label: 'Date',
      formatter: (item) => this.formatDate(item.createdAt),
      mobileGroup: 'summary', mobileGroupMain: true,
    },
    {
      key: 'invoice_number', label: 'Invoice #', renderHtml: true,
      formatter: (item) => `<span class="tw-bg-gray-100 tw-text-gray-600 tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium">${item.invoice_number}</span>`,
      mobileGroup: 'summary',
    },
    { key: 'plan', label: 'Plan', formatter: (item) => item.plan?.name ?? '—' },
    { key: 'billing_reason', label: 'Type', formatter: (item) => this.billingReasonLabel(item.billing_reason) },
    {
      key: 'amount', label: 'Amount', align: 'right',
      formatter: (item) => `${item.currency} ${Number(item.amount).toFixed(2)}`,
    },
    {
      key: 'status', label: 'Status', renderHtml: true,
      formatter: (item) => `<span class="status-badge ${this.invoiceStatusClass(item.status)}">${this.invoiceStatusLabel(item.status)}</span>`,
      mobileGroup: 'summary',
    },
  ];

  readonly invoiceActions = [
    {
      label: 'Download PDF',
      icon: 'download',
      handler: (item: any) => this.downloadInvoice(item),
    },
  ];

  readonly paymentColumns: TableColumn[] = [
    {
      key: 'processed_at', label: 'Date',
      formatter: (item) => this.formatDate(item.processed_at ?? item.createdAt),
      mobileGroup: 'summary', mobileGroupMain: true,
    },
    {
      key: 'paypal_transaction_id', label: 'Transaction ID', renderHtml: true,
      formatter: (item) => item.paypal_transaction_id
        ? `<span class="tw-bg-gray-100 tw-text-gray-600 tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium">${item.paypal_transaction_id}</span>`
        : '—',
      mobileGroup: 'summary',
    },
    {
      key: 'invoice', label: 'Invoice #', renderHtml: true,
      formatter: (item) => item.invoice?.invoice_number
        ? `<span class="tw-bg-gray-100 tw-text-gray-600 tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium">${item.invoice.invoice_number}</span>`
        : '—',
    },
    { key: 'plan', label: 'Plan', formatter: (item) => item.invoice?.plan?.name ?? '—' },
    { key: 'payment_method', label: 'Method', formatter: (item) => item.payment_method.charAt(0).toUpperCase() + item.payment_method.slice(1) },
    {
      key: 'amount', label: 'Amount', align: 'right',
      formatter: (item) => `${item.currency} ${Number(item.amount).toFixed(2)}`,
    },
    {
      key: 'status', label: 'Status', renderHtml: true,
      formatter: (item) => `<span class="status-badge ${this.paymentStatusClass(item.status)}">${this.paymentStatusLabel(item.status)}</span>`,
      mobileGroup: 'summary',
    },
  ];

  get invoicesPagination(): PaginationInfo {
    return {
      current_page: this.invoicesPage,
      total_pages: this.invoicesTotalPages,
      total_count: this.invoicesTotal,
      per_page: 20,
      has_next: this.invoicesPage < this.invoicesTotalPages,
      has_prev: this.invoicesPage > 1,
    };
  }

  get paymentsPagination(): PaginationInfo {
    return {
      current_page: this.paymentsPage,
      total_pages: this.paymentsTotalPages,
      total_count: this.paymentsTotal,
      per_page: 20,
      has_next: this.paymentsPage < this.paymentsTotalPages,
      has_prev: this.paymentsPage > 1,
    };
  }

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
    if (!this.hasTruePendingChange) return false;
    return this.currentSubscription!.pending_plan_id === plan.id &&
      this.currentSubscription!.pending_billing_cycle === this.billingCycle;
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

  /** True only when the pending plan/cycle differs from the current plan/cycle. */
  get hasTruePendingChange(): boolean {
    const sub = this.currentSubscription;
    if (!sub?.pending_plan_id) return false;
    return sub.pending_plan_id !== sub.plan_id || sub.pending_billing_cycle !== sub.billing_cycle;
  }

  get hasPendingChange(): boolean {
    return this.hasTruePendingChange;
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
      title: 'Restore current plan',
      message: pendingName
        ? `This will cancel the scheduled change to ${pendingName}. Your current plan will continue after ${dateLabel ?? 'the billing period ends'}.`
        : `This will cancel the scheduled plan change. Your current plan will continue.`,
      note: 'You will be redirected to PayPal to re-authorize billing for your current plan. No charge will be made today.',
      noteIcon: 'paypal',
      confirmText: 'Restore plan',
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

  onNavTabChange(id: string): void {
    this.activeSection = id as 'subscription' | 'invoices' | 'payments' | 'billing-details';
    if (id === 'invoices' && !this.invoicesLoaded) this.loadInvoices();
    if (id === 'payments' && !this.paymentsLoaded) this.loadPayments();
    if (id === 'billing-details' && !this.billingDetails) this.loadBillingDetails();
  }

  loadBillingDetails(): void {
    this.billingDetailsLoading = true;
    this.subscriptionService.getBillingDetails().subscribe({
      next: (details) => {
        this.billingDetails = details;
        this.editingBillingValues = { ...details };
        this.billingDetailsLoading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load billing details');
        this.billingDetailsLoading = false;
      },
    });
  }

  isBillingEditing(field: string): boolean {
    return this.editingBillingFields.has(field);
  }

  startBillingEditing(field: string): void {
    this.billingFieldOriginals.set(field, (this.editingBillingValues as any)[field] ?? null);
    this.editingBillingFields.add(field);
  }

  cancelBillingEditing(field: string): void {
    const original = this.billingFieldOriginals.get(field) ?? null;
    (this.editingBillingValues as any)[field] = original;
    this.editingBillingFields.delete(field);
  }

  saveBillingField(field: string): void {
    this.editingBillingFields.delete(field);
    const value = (this.editingBillingValues as any)[field] ?? null;
    this.billingDetailsSaving = true;
    this.subscriptionService.updateBillingDetails({ [field]: value }).subscribe({
      next: (updated) => {
        this.billingDetails = updated;
        this.editingBillingValues = { ...updated };
        this.billingDetailsSaving = false;
        this.notificationService.showSuccess('Billing details updated');
      },
      error: () => {
        this.notificationService.showError('Failed to update billing details');
        this.billingDetailsSaving = false;
      },
    });
  }

  loadInvoices(page = 1): void {
    this.invoicesLoading = true;
    this.subscriptionService.getInvoices(page).subscribe({
      next: (res) => {
        this.invoices = res.invoices;
        this.invoicesPage = res.page;
        this.invoicesTotalPages = res.totalPages;
        this.invoicesTotal = res.total;
        this.invoicesLoaded = true;
        this.invoicesLoading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load invoices');
        this.invoicesLoading = false;
      },
    });
  }

  downloadInvoice(invoice: SubscriptionInvoice): void {
    this.downloadingInvoiceId = invoice.id;
    this.subscriptionService.downloadInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.invoice_number ?? invoice.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingInvoiceId = null;
      },
      error: () => {
        this.notificationService.showError('Failed to download invoice PDF');
        this.downloadingInvoiceId = null;
      },
    });
  }

  loadPayments(page = 1): void {
    this.paymentsLoading = true;
    this.subscriptionService.getPayments(page).subscribe({
      next: (res) => {
        this.payments = res.payments;
        this.paymentsPage = res.page;
        this.paymentsTotalPages = res.totalPages;
        this.paymentsTotal = res.total;
        this.paymentsLoaded = true;
        this.paymentsLoading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load payments');
        this.paymentsLoading = false;
      },
    });
  }

  invoiceStatusClass(status: string): string {
    const map: Record<string, string> = {
      paid: 'status-success',
      open: 'status-warning',
      uncollectible: 'status-danger',
      void: 'status-secondary',
    };
    return map[status] ?? 'status-secondary';
  }

  invoiceStatusLabel(status: string): string {
    const map: Record<string, string> = {
      paid: 'Paid',
      open: 'Unpaid',
      uncollectible: 'Uncollectible',
      void: 'Void',
    };
    return map[status] ?? status;
  }

  paymentStatusClass(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'status-success',
      pending: 'status-warning',
      failed: 'status-danger',
    };
    return map[status] ?? 'status-secondary';
  }

  paymentStatusLabel(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'Succeeded',
      pending: 'Pending',
      failed: 'Failed',
    };
    return map[status] ?? status;
  }

  billingReasonLabel(reason: string): string {
    const map: Record<string, string> = {
      subscription_create: 'New subscription',
      subscription_cycle: 'Renewal',
      subscription_update: 'Plan change',
    };
    return map[reason] ?? reason;
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
