import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService, AdminPlan, PlanInput } from '../../../services/subscription.service';
import { NotificationService } from '../../../services/notification.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';
import { IconComponent } from '../../../components/shared/icon/icon.component';

interface PlanFormState {
  name: string;
  sort_order: number | '';
  is_active: boolean;
  is_public: boolean;
  is_default_free: boolean;
  price_monthly: number | '';
  price_annual: number | '';
  limit_artists: number | null;
  limit_releases_per_artist: number | null;
  limit_press_campaigns_per_month: number | null;
  limit_sync_pitches_per_month: number | null;
  limit_storage_gb: number | null;
  limit_admin_users: number | null;
  default_music_transaction_fixed_fee: number | '';
  default_music_revenue_percentage_fee: number | '';
  default_music_fee_revenue_type: 'net' | 'gross';
  default_event_transaction_fixed_fee: number | '';
  default_event_revenue_percentage_fee: number | '';
  default_event_fee_revenue_type: 'net' | 'gross';
  default_fundraiser_transaction_fixed_fee: number | '';
  default_fundraiser_revenue_percentage_fee: number | '';
  default_fundraiser_fee_revenue_type: 'net' | 'gross';
  feature_music_workspace: boolean;
  feature_campaigns_workspace: boolean;
  feature_sublabels: boolean;
  feature_artist_profiles: boolean;
  feature_music_releases: boolean;
  feature_press_campaigns: boolean;
  feature_sync_licensing: boolean;
  feature_events: boolean;
  feature_fundraisers: boolean;
}

interface PlanRow extends AdminPlan {
  _isEditing: boolean;
  _saving: boolean;
  _form: PlanFormState;
}

function blankForm(): PlanFormState {
  return {
    name: '',
    sort_order: 0,
    is_active: true,
    is_public: false,
    is_default_free: false,
    price_monthly: 0,
    price_annual: 0,
    limit_artists: null,
    limit_releases_per_artist: null,
    limit_press_campaigns_per_month: null,
    limit_sync_pitches_per_month: null,
    limit_storage_gb: null,
    limit_admin_users: null,
    default_music_transaction_fixed_fee: 0,
    default_music_revenue_percentage_fee: 0,
    default_music_fee_revenue_type: 'net',
    default_event_transaction_fixed_fee: 0,
    default_event_revenue_percentage_fee: 0,
    default_event_fee_revenue_type: 'net',
    default_fundraiser_transaction_fixed_fee: 0,
    default_fundraiser_revenue_percentage_fee: 0,
    default_fundraiser_fee_revenue_type: 'net',
    feature_music_workspace: true,
    feature_campaigns_workspace: true,
    feature_sublabels: true,
    feature_artist_profiles: true,
    feature_music_releases: true,
    feature_press_campaigns: true,
    feature_sync_licensing: true,
    feature_events: true,
    feature_fundraisers: true,
  };
}

function planToForm(plan: AdminPlan): PlanFormState {
  return {
    name: plan.name,
    sort_order: plan.sort_order,
    is_active: plan.is_active,
    is_public: plan.is_public,
    is_default_free: plan.is_default_free,
    price_monthly: plan.price_monthly,
    price_annual: plan.price_annual,
    limit_artists: plan.limit_artists ?? null,
    limit_releases_per_artist: plan.limit_releases_per_artist ?? null,
    limit_press_campaigns_per_month: plan.limit_press_campaigns_per_month ?? null,
    limit_sync_pitches_per_month: plan.limit_sync_pitches_per_month ?? null,
    limit_storage_gb: plan.limit_storage_gb ?? null,
    limit_admin_users: plan.limit_admin_users ?? null,
    default_music_transaction_fixed_fee: plan.default_music_transaction_fixed_fee ?? 0,
    default_music_revenue_percentage_fee: plan.default_music_revenue_percentage_fee ?? 0,
    default_music_fee_revenue_type: plan.default_music_fee_revenue_type ?? 'net',
    default_event_transaction_fixed_fee: plan.default_event_transaction_fixed_fee ?? 0,
    default_event_revenue_percentage_fee: plan.default_event_revenue_percentage_fee ?? 0,
    default_event_fee_revenue_type: plan.default_event_fee_revenue_type ?? 'net',
    default_fundraiser_transaction_fixed_fee: plan.default_fundraiser_transaction_fixed_fee ?? 0,
    default_fundraiser_revenue_percentage_fee: plan.default_fundraiser_revenue_percentage_fee ?? 0,
    default_fundraiser_fee_revenue_type: plan.default_fundraiser_fee_revenue_type ?? 'net',
    feature_music_workspace: plan.feature_music_workspace,
    feature_campaigns_workspace: plan.feature_campaigns_workspace,
    feature_sublabels: plan.feature_sublabels,
    feature_artist_profiles: plan.feature_artist_profiles,
    feature_music_releases: plan.feature_music_releases,
    feature_press_campaigns: plan.feature_press_campaigns,
    feature_sync_licensing: plan.feature_sync_licensing,
    feature_events: plan.feature_events,
    feature_fundraisers: plan.feature_fundraisers,
  };
}

function formToInput(form: PlanFormState): PlanInput {
  const nullableNum = (v: number | null): number | null => (v === null || v === undefined || String(v) === '' ? null : Number(v));
  return {
    name: form.name,
    sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
    is_active: form.is_active,
    is_public: form.is_public,
    is_default_free: form.is_default_free,
    price_monthly: form.price_monthly === '' ? 0 : Number(form.price_monthly),
    price_annual: form.price_annual === '' ? 0 : Number(form.price_annual),
    limit_artists: nullableNum(form.limit_artists),
    limit_releases_per_artist: nullableNum(form.limit_releases_per_artist),
    limit_press_campaigns_per_month: nullableNum(form.limit_press_campaigns_per_month),
    limit_sync_pitches_per_month: nullableNum(form.limit_sync_pitches_per_month),
    limit_storage_gb: nullableNum(form.limit_storage_gb),
    limit_admin_users: nullableNum(form.limit_admin_users),
    default_music_transaction_fixed_fee: form.default_music_transaction_fixed_fee === '' ? 0 : Number(form.default_music_transaction_fixed_fee),
    default_music_revenue_percentage_fee: form.default_music_revenue_percentage_fee === '' ? 0 : Number(form.default_music_revenue_percentage_fee),
    default_music_fee_revenue_type: form.default_music_fee_revenue_type,
    default_event_transaction_fixed_fee: form.default_event_transaction_fixed_fee === '' ? 0 : Number(form.default_event_transaction_fixed_fee),
    default_event_revenue_percentage_fee: form.default_event_revenue_percentage_fee === '' ? 0 : Number(form.default_event_revenue_percentage_fee),
    default_event_fee_revenue_type: form.default_event_fee_revenue_type,
    default_fundraiser_transaction_fixed_fee: form.default_fundraiser_transaction_fixed_fee === '' ? 0 : Number(form.default_fundraiser_transaction_fixed_fee),
    default_fundraiser_revenue_percentage_fee: form.default_fundraiser_revenue_percentage_fee === '' ? 0 : Number(form.default_fundraiser_revenue_percentage_fee),
    default_fundraiser_fee_revenue_type: form.default_fundraiser_fee_revenue_type,
    feature_music_workspace: form.feature_music_workspace,
    feature_campaigns_workspace: form.feature_campaigns_workspace,
    feature_sublabels: form.feature_sublabels,
    feature_artist_profiles: form.feature_artist_profiles,
    feature_music_releases: form.feature_music_releases,
    feature_press_campaigns: form.feature_press_campaigns,
    feature_sync_licensing: form.feature_sync_licensing,
    feature_events: form.feature_events,
    feature_fundraisers: form.feature_fundraisers,
  };
}

@Component({
  selector: 'app-plan-management',
  imports: [CommonModule, FormsModule, BreadcrumbComponent, IconComponent],
  templateUrl: './plan-management.component.html',
})
export class PlanManagementComponent implements OnInit {
  loading = true;
  plans: PlanRow[] = [];

  // New plan creation state
  showNewForm = false;
  newForm: PlanFormState = blankForm();
  newFormSaving = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.subscriptionService.getAdminPlans().subscribe({
      next: ({ plans }) => {
        this.plans = plans.map(p => ({
          ...p,
          _isEditing: false,
          _saving: false,
          _form: planToForm(p),
        }));
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load plans');
        this.loading = false;
      },
    });
  }

  get publicPlans(): PlanRow[] {
    return this.plans.filter(p => p.is_public);
  }

  get hiddenPlans(): PlanRow[] {
    return this.plans.filter(p => !p.is_public);
  }

  startEdit(plan: PlanRow): void {
    plan._form = planToForm(plan);
    plan._isEditing = true;
  }

  cancelEdit(plan: PlanRow): void {
    plan._isEditing = false;
  }

  savePlan(plan: PlanRow): void {
    if (!plan._form.name.trim()) {
      this.notificationService.showError('Plan name is required');
      return;
    }
    plan._saving = true;
    this.subscriptionService.updateAdminPlan(plan.id, formToInput(plan._form)).subscribe({
      next: ({ plan: updated }) => {
        Object.assign(plan, updated, { _isEditing: false, _saving: false, _form: planToForm(updated) });
        this.notificationService.showSuccess('Plan saved');
      },
      error: () => {
        this.notificationService.showError('Failed to save plan');
        plan._saving = false;
      },
    });
  }

  openNewForm(): void {
    this.newForm = blankForm();
    this.showNewForm = true;
  }

  cancelNew(): void {
    this.showNewForm = false;
  }

  createPlan(): void {
    if (!this.newForm.name.trim()) {
      this.notificationService.showError('Plan name is required');
      return;
    }
    this.newFormSaving = true;
    this.subscriptionService.createAdminPlan(formToInput(this.newForm)).subscribe({
      next: ({ plan: created }) => {
        this.plans.push({
          ...created,
          _isEditing: false,
          _saving: false,
          _form: planToForm(created),
        });
        this.plans.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        this.showNewForm = false;
        this.newFormSaving = false;
        this.notificationService.showSuccess('Plan created');
      },
      error: () => {
        this.notificationService.showError('Failed to create plan');
        this.newFormSaving = false;
      },
    });
  }

  limitDisplay(val: number | null): string {
    return val === null ? '∞' : String(val);
  }
}
