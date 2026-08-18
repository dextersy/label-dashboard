import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SubscriptionService, Plan, CurrentSubscription } from '../../../services/subscription.service';
import { PlanLimitService, UpgradeModalContext } from '../../../services/plan-limit.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-upgrade-plan-modal',
  imports: [CommonModule, IconComponent],
  templateUrl: './upgrade-plan-modal.component.html',
  styleUrl: './upgrade-plan-modal.component.scss',
})
export class UpgradePlanModalComponent implements OnInit, OnDestroy {
  visible = false;
  context: UpgradeModalContext | null = null;

  plans: Plan[] = [];
  currentSubscription: CurrentSubscription | null = null;
  loading = false;

  private sub = new Subscription();

  constructor(
    private planLimitService: PlanLimitService,
    private subscriptionService: SubscriptionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.planLimitService.upgradeModal$.subscribe(ctx => {
        if (ctx) {
          this.context = ctx;
          this.visible = true;
          this.loadPlans();
        } else {
          this.visible = false;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  loadPlans(): void {
    this.loading = true;
    this.subscriptionService.getPlans().subscribe({
      next: (data) => {
        this.plans = data.plans;
        this.currentSubscription = data.currentSubscription;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  close(): void {
    this.planLimitService.closeModal();
  }

  goToSubscription(): void {
    this.close();
    this.router.navigate(['/admin/subscription']);
  }

  isCurrentPlan(plan: Plan): boolean {
    return this.currentSubscription?.plan_id === plan.id;
  }

  limitLabel(value: number | null): string {
    return value === null ? 'Unlimited' : value.toLocaleString();
  }

  get limitMessage(): string {
    if (!this.context) return '';
    const map: Record<string, string> = {
      artists: 'artist',
      releases_per_artist: 'release for this artist',
      admin_users: 'admin user',
      press_campaigns: 'press campaign this month',
      sync_pitches: 'sync licensing pitch this month',
    };
    return map[this.context.limit_type] ?? this.context.limit_type;
  }

  get freeUpAction(): string {
    if (!this.context) return '';
    const map: Record<string, string> = {
      artists: 'deactivate an existing artist',
      releases_per_artist: 'take down an existing release',
      admin_users: 'remove an existing admin',
      press_campaigns: 'wait until next month or upgrade your plan',
      sync_pitches: 'wait until next month or upgrade your plan',
    };
    return map[this.context.limit_type] ?? 'free up a slot';
  }
}
