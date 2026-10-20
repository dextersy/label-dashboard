import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
import SubscriptionInvoice, { BillingReason } from '../models/SubscriptionInvoice';
import SubscriptionPayment from '../models/SubscriptionPayment';
import User from '../models/User';
import Artist from '../models/Artist';
import { ReleaseArtist, Release, PressCampaign, SyncLicensingPitch } from '../models';
import {
  syncPlanToPayPal,
  createPayPalSubscription,
  cancelPayPalSubscription,
  verifyPayPalWebhook,
  resolveEffectiveLimits,
  getEffectiveLimitsForBrand,
  getStorageUsedBytesForBrand,
  calculateProration,
  getPayPalSubscriptionNextBillingTime,
} from '../services/subscriptionService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { sendSubscriptionActivatedEmail, sendSubscriptionRenewalEmail, sendSubscriptionRestoredEmail, sendSubscriptionPastDueEmail, sendSubscriptionDowngradedEmail, sendSubscriptionDowngradeScheduledEmail, sendSubscriptionCancelledEmail } from '../utils/emailService';

// ---------------------------------------------------------------------------
// GET /api/subscription/plans/public
// Returns all active public plans — no auth required (used by marketing site)
// ---------------------------------------------------------------------------
export const getPublicPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.findAll({
      where: { is_active: true, is_public: true },
      order: [['sort_order', 'ASC']],
      attributes: { exclude: ['paypal_plan_id_monthly', 'paypal_plan_id_annual'] },
    });
    res.json({ plans });
  } catch (error: any) {
    console.error('getPublicPlans error:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/subscription/plans
// Returns all active plans (public ones visible to self-serve + current brand's plan)
// ---------------------------------------------------------------------------
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;

    // Get current brand plan so we always include it even if private
    const currentBrandPlan = await BrandPlan.findOne({
      where: { brand_id: brandId },
      include: [{ model: Plan, as: 'plan' }],
      order: [['createdAt', 'DESC']],
    });
    const currentPlanId = currentBrandPlan?.plan?.id;

    const plans = await Plan.findAll({
      where: {
        is_active: true,
        [Op.or]: [
          { is_public: true },
          ...(currentPlanId ? [{ id: currentPlanId }] : []),
        ],
      },
      order: [['sort_order', 'ASC']],
      attributes: { exclude: ['paypal_plan_id_monthly', 'paypal_plan_id_annual'] },
    });

    res.json({
      plans,
      currentSubscription: currentBrandPlan
        ? {
            plan_id: currentPlanId,
            billing_cycle: currentBrandPlan.billing_cycle,
            status: currentBrandPlan.status,
            started_at: currentBrandPlan.started_at,
            ends_at: currentBrandPlan.ends_at,
            pending_plan_id: currentBrandPlan.pending_plan_id ?? null,
            pending_billing_cycle: currentBrandPlan.pending_billing_cycle ?? null,
            effective_limits: resolveEffectiveLimits(
              currentBrandPlan.plan,
              currentBrandPlan
            ),
          }
        : null,
    });
  } catch (error: any) {
    console.error('getPlans error:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/subscription/usage
// Returns current usage counts alongside effective limits for the brand.
// Used by the frontend to gate creation screens before the user fills a form.
// ---------------------------------------------------------------------------
export const getUsage = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;
    const limits = await getEffectiveLimitsForBrand(brandId);

    // Count active artists for this brand (inactive artists don't consume a slot)
    const artistCount = await Artist.count({ where: { brand_id: brandId, status: 'Active' } });

    // Count admin users for this brand
    const adminUserCount = await User.count({ where: { brand_id: brandId, is_admin: true } });

    // Get this brand's artist IDs, then count releases per artist in one GROUP BY query
    const artistIds = (await Artist.findAll({
      where: { brand_id: brandId },
      attributes: ['id'],
      raw: true,
    }) as any[]).map((a: any) => a.id);

    const releasesPerArtist: Record<number, number> = {};
    if (artistIds.length > 0) {
      const releaseCounts = await ReleaseArtist.findAll({
        attributes: ['artist_id', [fn('COUNT', literal('*')), 'release_count']],
        where: { artist_id: { [Op.in]: artistIds } },
        include: [{ model: Release, as: 'release', attributes: [], where: { status: { [Op.in]: ['Live', 'Pending'] } }, required: true }],
        group: [literal('"ReleaseArtist"."artist_id"') as any],
        raw: true,
      }) as any[];
      for (const row of releaseCounts) {
        releasesPerArtist[row.artist_id] = parseInt(row.release_count, 10);
      }
    }

    // Count press campaigns and sync pitches created this calendar month (excluding Deleted)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const pressCampaignsThisMonth = await PressCampaign.count({
      where: {
        brand_id: brandId,
        createdAt: { [Op.gte]: monthStart, [Op.lt]: monthEnd },
      },
    });

    const syncPitchesThisMonth = await SyncLicensingPitch.count({
      where: {
        brand_id: brandId,
        status: { [Op.notIn]: ['Deleted'] },
        createdAt: { [Op.gte]: monthStart, [Op.lt]: monthEnd },
      },
    });

    const storageUsedBytes = await getStorageUsedBytesForBrand(brandId);

    res.json({
      limits,
      usage: {
        artists: artistCount,
        admin_users: adminUserCount,
        releases_per_artist: releasesPerArtist,
        press_campaigns_this_month: pressCampaignsThisMonth,
        sync_pitches_this_month: syncPitchesThisMonth,
        storage_used_bytes: storageUsedBytes,
      },
    });
  } catch (error: any) {
    console.error('getUsage error:', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/checkout
// Initiates upgrade/switch to a paid plan. Returns a PayPal approval URL.
// For the Free plan, switches immediately without PayPal.
// ---------------------------------------------------------------------------
export const initiateCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { plan_id, billing_cycle } = req.body as {
      plan_id: number;
      billing_cycle: 'monthly' | 'annual';
    };

    if (!plan_id || !billing_cycle) {
      res.status(400).json({ error: 'plan_id and billing_cycle are required' });
      return;
    }

    const plan = await Plan.findOne({
      where: { id: plan_id, is_active: true },
    });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Free plan: switch immediately, no PayPal involved
    if (plan.price_monthly === 0 && plan.price_annual === 0) {
      const [freeBrandPlan] = await BrandPlan.findOrCreate({
        where: { brand_id: brandId },
        defaults: {
          plan_id: plan.id,
          billing_cycle,
          started_at: new Date(),
          ends_at: null,
          status: 'active',
          paypal_subscription_id: null,
        } as any,
      });
      await freeBrandPlan.update({
        plan_id: plan.id,
        billing_cycle,
        started_at: new Date(),
        ends_at: null,
        status: 'active',
        paypal_subscription_id: null,
      });
      res.json({ immediate: true });
      return;
    }

    // Load the brand's current plan record
    const currentBrandPlan = await BrandPlan.findOne({
      where: { brand_id: brandId },
      include: [{ model: Plan, as: 'plan' }],
    });
    const currentPlan = currentBrandPlan?.plan ?? null;

    // If there's an existing pending downgrade subscription, cancel it before proceeding.
    // Capture the flag first — it tells us the current plan is already paid through ends_at.
    // Clear the DB field before calling PayPal so the CANCELLED webhook is a no-op.
    const hadPendingDowngrade = !!currentBrandPlan?.pending_paypal_subscription_id;
    if (hadPendingDowngrade) {
      const oldPendingSubId = currentBrandPlan!.pending_paypal_subscription_id!;
      await currentBrandPlan!.update({
        pending_paypal_subscription_id: null,
        pending_plan_id: null,
        pending_billing_cycle: null,
      });
      await cancelPayPalSubscription(oldPendingSubId);
    }

    // Compare total payment amounts (full cycle price) to determine upgrade vs downgrade.
    const currentPrice = currentBrandPlan
      ? (currentBrandPlan.billing_cycle === 'monthly' ? (currentPlan?.price_monthly ?? 0) : (currentPlan?.price_annual ?? 0))
      : 0;
    const newPrice = billing_cycle === 'monthly' ? plan.price_monthly : plan.price_annual;

    // Same plan billing cycle flip: annual→monthly is always a downgrade; monthly→annual is an upgrade.
    const isAnnualToMonthly = currentBrandPlan?.billing_cycle === 'annual' && billing_cycle === 'monthly' && currentBrandPlan?.plan_id === plan.id;
    const isMonthlyToAnnual = currentBrandPlan?.billing_cycle === 'monthly' && billing_cycle === 'annual' && currentBrandPlan?.plan_id === plan.id;
    const isDowngrade = isAnnualToMonthly || (!isMonthlyToAnnual && newPrice < currentPrice);

    // "Has an active paid period" — a live PayPal sub, a future ends_at, or a pending
    // downgrade that was just cleared (the current plan is paid through to ends_at).
    const hasActivePaidPeriod =
      (currentBrandPlan?.status === 'active' || currentBrandPlan?.status === 'past_due' || currentBrandPlan?.status === 'incomplete') &&
      (!!currentBrandPlan?.paypal_subscription_id ||
        (currentBrandPlan?.ends_at != null && new Date(currentBrandPlan.ends_at) > new Date()) ||
        hadPendingDowngrade);

    // Build return and cancel URLs
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const returnUrl = `${frontendUrl}/admin/subscription?checkout=success`;
    const cancelUrl = `${frontendUrl}/admin/subscription?checkout=cancelled`;

    console.log('[checkout] decision:', { currentPlanId: currentPlan?.id, currentPrice, newPlanId: plan.id, newPrice, isDowngrade, hasActivePaidPeriod, hadPendingDowngrade, paypalSubId: currentBrandPlan?.paypal_subscription_id, endsAt: currentBrandPlan?.ends_at, status: currentBrandPlan?.status });

    if (isDowngrade && hasActivePaidPeriod) {
      // -----------------------------------------------------------------------
      // DOWNGRADE: Keep old PayPal subscription active until ends_at.
      // Create a new pending PayPal subscription starting at ends_at so the
      // user can pre-authorize future billing now (no payment today).
      // The process-pending-downgrades job activates it after ends_at.
      // -----------------------------------------------------------------------

      // Estimate ends_at if not set (e.g. subscription activated before webhook fix)
      let endsAt = currentBrandPlan!.ends_at;
      if (!endsAt) {
        const estimated = new Date(currentBrandPlan!.started_at);
        if (currentBrandPlan!.billing_cycle === 'annual') {
          estimated.setFullYear(estimated.getFullYear() + 1);
        } else {
          estimated.setMonth(estimated.getMonth() + 1);
        }
        endsAt = estimated;
      }

      // Cancel the current PayPal subscription so it doesn't renew at ends_at.
      // The brand retains access until ends_at via our DB — PayPal is just stopped.
      if (currentBrandPlan!.paypal_subscription_id) {
        await cancelPayPalSubscription(currentBrandPlan!.paypal_subscription_id);
        await currentBrandPlan!.update({ paypal_subscription_id: null });
      }

      // Ensure PayPal billing plan exists for the new (lower) plan
      const paypalPlanId = await syncPlanToPayPal(plan, billing_cycle);

      // Create the future subscription — no charge today, starts at endsAt
      const { subscriptionId: pendingSubId, approvalUrl } = await createPayPalSubscription({
        planId: paypalPlanId,
        returnUrl,
        cancelUrl,
        startTime: endsAt,
      });

      await currentBrandPlan!.update({
        pending_plan_id: plan.id,
        pending_billing_cycle: billing_cycle,
        pending_paypal_subscription_id: pendingSubId,
      });

      res.json({ checkout_url: approvalUrl, downgrade_scheduled: true, effective_at: endsAt });
      return;
    }

    // -----------------------------------------------------------------------
    // UPGRADE (or new subscription): create PayPal subscription.
    // If upgrading from an active subscription, cancel the old one and charge
    // a prorated setup fee covering the remainder of the current period.
    // -----------------------------------------------------------------------
    let setupFee: number | undefined;
    let upgradeStartTime: Date | undefined;

    if (hasActivePaidPeriod && currentBrandPlan && currentPlan) {
      // Cancel old subscription before creating the new one (may already be null if previously cancelled)
      if (currentBrandPlan.paypal_subscription_id) {
        await cancelPayPalSubscription(currentBrandPlan.paypal_subscription_id);
      }

      // Estimate ends_at from billing cycle if PayPal hasn't provided it yet
      let endsAt = currentBrandPlan.ends_at;
      if (!endsAt) {
        const estimated = new Date(currentBrandPlan.started_at);
        if (currentBrandPlan.billing_cycle === 'annual') {
          estimated.setFullYear(estimated.getFullYear() + 1);
        } else {
          estimated.setMonth(estimated.getMonth() + 1);
        }
        endsAt = estimated;
      }

      // Only prorate when moving to a higher-priced plan from an existing paid plan.
      // Free → paid: no setup fee. Same plan / same price: no setup fee.
      if (currentPrice > 0 && newPrice > currentPrice) {
        setupFee = calculateProration({
          startedAt: currentBrandPlan.started_at,
          endsAt,
          oldPrice: currentPrice,
          newPrice,
        });
        if (currentBrandPlan?.billing_cycle === 'monthly' && billing_cycle === 'annual') {
          // For monthly → annual the proration covers the remaining days of the current
          // month. Recurring annual billing should start 1 year from now — NOT from
          // endsAt (which is only ~1 month away and would bill "next month" for an annual plan).
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
          upgradeStartTime = oneYearFromNow;
        } else {
          // Same-cycle upgrade: defer to end of current period so only the prorated
          // setup fee is charged today. Skip if endsAt is in the past.
          const endsAtDate = new Date(endsAt);
          if (endsAtDate > new Date()) {
            upgradeStartTime = endsAtDate;
          }
        }
      }
    }

    // Ensure PayPal billing plan exists for this billing cycle
    const paypalPlanId = await syncPlanToPayPal(plan, billing_cycle);

    const { subscriptionId, approvalUrl } = await createPayPalSubscription({
      planId: paypalPlanId,
      returnUrl,
      cancelUrl,
      setupFee,
      startTime: upgradeStartTime,
    });

    // Store the pending subscription record.
    // plan_id / billing_cycle are NOT committed yet — they move over in the
    // ACTIVATED webhook so an abandoned PayPal flow leaves the current plan intact.
    const [paidBrandPlan] = await BrandPlan.findOrCreate({
      where: { brand_id: brandId },
      defaults: {
        plan_id: plan.id,
        billing_cycle,
        started_at: new Date(),
        status: 'incomplete',
        paypal_subscription_id: subscriptionId,
        pending_plan_id: plan.id,
        pending_billing_cycle: billing_cycle,
      } as any,
    });
    await paidBrandPlan.update({
      // ends_at intentionally NOT cleared — if the user abandons the PayPal flow,
      // the CANCELLED webhook reverts to this record and the brand retains access
      // for the period they already paid for. Webhooks update ends_at on completion.
      pre_checkout_status: paidBrandPlan.status,
      status: 'incomplete',
      paypal_subscription_id: subscriptionId,
      pending_plan_id: plan.id,
      pending_billing_cycle: billing_cycle,
    });

    res.json({ checkout_url: approvalUrl });
  } catch (error: any) {
    console.error('initiateCheckout error:', error);
    res.status(500).json({ error: 'Failed to initiate subscription checkout' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/cancel
// Cancels the current paid subscription and downgrades to Free.
// ---------------------------------------------------------------------------
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;

    const brandPlan = await BrandPlan.findOne({
      where: { brand_id: brandId },
      include: [{ model: Plan, as: 'plan' }],
    });

    if (!brandPlan) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    // Look up the Free plan to schedule as the pending plan
    const freePlan = await Plan.findOne({ where: { is_default_free: true, is_active: true } });
    if (!freePlan) {
      res.status(500).json({ error: 'Free plan not found' });
      return;
    }

    // Cancel pending downgrade subscription first. Cancel on PayPal before clearing
    // DB — the CANCELLED webhook checks pending_paypal_subscription_id === subscriptionId
    // and will no-op once we clear it in the line below.
    if (brandPlan.pending_paypal_subscription_id) {
      const pendingSubId = brandPlan.pending_paypal_subscription_id;
      await cancelPayPalSubscription(pendingSubId);
      await brandPlan.update({ pending_paypal_subscription_id: null, pending_plan_id: null, pending_billing_cycle: null });
      console.log(`cancelSubscription: cancelled pending PayPal sub ${pendingSubId} for brand ${brandId}`);
    }

    // Cancel the active PayPal subscription. If this throws, the subscription is
    // still active — DB is untouched and the brand is not affected.
    if (brandPlan.paypal_subscription_id) {
      await cancelPayPalSubscription(brandPlan.paypal_subscription_id);
      console.log(`cancelSubscription: cancelled active PayPal sub ${brandPlan.paypal_subscription_id} for brand ${brandId}`);
    }

    const currentPlan = (brandPlan as BrandPlan & { plan?: Plan }).plan;
    const endsAt = brandPlan.ends_at;

    if (endsAt && new Date(endsAt) > new Date()) {
      // Brand has a known future period end — schedule Free to activate at ends_at.
      // The CANCELLED webhook will see pending_plan_id is set and skip an immediate drop.
      // The process-pending-downgrades Lambda activates Free at ends_at.
      await brandPlan.update({
        paypal_subscription_id: null,
        pending_plan_id: freePlan.id,
        pending_billing_cycle: 'monthly',
        pending_paypal_subscription_id: null,
      });

      if (currentPlan) {
        sendSubscriptionCancelledEmail(
          brandId,
          currentPlan.name,
          new Date(endsAt),
        ).catch((err) => console.error('sendSubscriptionCancelledEmail error:', err));
      }
    } else {
      // ends_at is null or already past — drop to Free immediately so the brand
      // is never stuck in a pending state the Lambda cannot resolve.
      await brandPlan.update({
        plan_id: freePlan.id,
        billing_cycle: 'monthly',
        paypal_subscription_id: null,
        pending_plan_id: null,
        pending_billing_cycle: null,
        pending_paypal_subscription_id: null,
        status: 'active',
        ends_at: null,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/cancel-pending-change
// Cancels the pending plan change and reinstates the current plan.
// Handles two cases:
//
//  A. Pending downgrade/cancel-change with a pending_paypal_subscription_id:
//     Cancel that sub, create a new one for the current plan starting at ends_at.
//
//  B. Subscription cancellation undo (pending_plan_id = Free, no pending sub):
//     Just create a new PayPal sub for the current plan starting at ends_at —
//     no charge today, billing resumes at period end.
//
// In both cases the new sub is stored as pending_paypal_subscription_id so the
// Lambda activates it at ends_at (same mechanism as a scheduled downgrade).
// ---------------------------------------------------------------------------
export const cancelPendingChange = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;

    const brandPlan = await BrandPlan.findOne({
      where: { brand_id: brandId },
      include: [{ model: Plan, as: 'plan' }],
    });

    if (!brandPlan || !brandPlan.pending_plan_id) {
      res.status(400).json({ error: 'No pending plan change to cancel' });
      return;
    }

    if (!brandPlan.ends_at || new Date(brandPlan.ends_at) <= new Date()) {
      res.status(400).json({ error: 'Cannot cancel pending change: current period end date unknown or already past' });
      return;
    }

    const currentPlan = (brandPlan as BrandPlan & { plan?: Plan }).plan;
    if (!currentPlan) {
      res.status(400).json({ error: 'Current plan not found' });
      return;
    }

    // If there is an existing pending PayPal subscription, cancel it first.
    // Cancel on PayPal before clearing DB — the CANCELLED webhook checks
    // pending_paypal_subscription_id === subscriptionId and will no-op once we clear it below.
    if (brandPlan.pending_paypal_subscription_id) {
      const oldPendingSubId = brandPlan.pending_paypal_subscription_id;
      await cancelPayPalSubscription(oldPendingSubId);
      await brandPlan.update({
        pending_paypal_subscription_id: null,
        pending_plan_id: null,
        pending_billing_cycle: null,
      });
    }

    // Create a new subscription for the current plan starting at ends_at.
    // No charge today — billing resumes at the end of the already-paid period.
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const returnUrl = `${frontendUrl}/admin/subscription?checkout=success`;
    const cancelUrl = `${frontendUrl}/admin/subscription?checkout=cancelled`;

    const paypalPlanId = await syncPlanToPayPal(currentPlan, brandPlan.billing_cycle as 'monthly' | 'annual');
    const { subscriptionId: newPendingSubId, approvalUrl } = await createPayPalSubscription({
      planId: paypalPlanId,
      returnUrl,
      cancelUrl,
      startTime: new Date(brandPlan.ends_at),
    });

    // Store as a pending sub for the current plan — Lambda activates it at ends_at.
    await brandPlan.update({
      pending_plan_id: currentPlan.id,
      pending_billing_cycle: brandPlan.billing_cycle,
      pending_paypal_subscription_id: newPendingSubId,
    });

    res.json({ checkout_url: approvalUrl });
  } catch (error: any) {
    console.error('cancelPendingChange error:', error);
    res.status(500).json({ error: 'Failed to cancel pending plan change' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/dev-override  (development only)
// Directly sets the brand's plan without PayPal — for local testing only.
// ---------------------------------------------------------------------------
export const devOverridePlan = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Not available in this environment' });
    return;
  }

  try {
    const brandId = (req as any).user?.brand_id;
    const { plan_id, billing_cycle } = req.body as { plan_id: number; billing_cycle: 'monthly' | 'annual' };

    if (!plan_id || !billing_cycle) {
      res.status(400).json({ error: 'plan_id and billing_cycle are required' });
      return;
    }

    const plan = await Plan.findOne({ where: { id: plan_id, is_active: true } });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const [devBrandPlan] = await BrandPlan.findOrCreate({
      where: { brand_id: brandId },
      defaults: {
        plan_id: plan.id,
        billing_cycle,
        started_at: new Date(),
        ends_at: null,
        status: 'active',
        paypal_subscription_id: null,
      } as any,
    });
    await devBrandPlan.update({
      plan_id: plan.id,
      billing_cycle,
      started_at: new Date(),
      ends_at: null,
      status: 'active',
      paypal_subscription_id: null,
    });

    res.json({ success: true, plan: plan.name, billing_cycle });
  } catch (error: any) {
    console.error('devOverridePlan error:', error);
    res.status(500).json({ error: 'Failed to override plan' });
  }
};

// Fields that may be set by the superadmin UI. PayPal plan IDs are intentionally
// excluded — they are managed internally by syncPlanToPayPal and must never be
// overwritten via the API.
const PLAN_EDITABLE_FIELDS = [
  'name',
  'sort_order',
  'is_active',
  'is_public',
  'is_default_free',
  'price_monthly',
  'price_annual',
  'limit_artists',
  'limit_releases_per_artist',
  'limit_press_campaigns_per_month',
  'limit_sync_pitches_per_month',
  'limit_storage_gb',
  'limit_admin_users',
  'default_music_transaction_fixed_fee',
  'default_music_revenue_percentage_fee',
  'default_music_fee_revenue_type',
  'default_event_transaction_fixed_fee',
  'default_event_revenue_percentage_fee',
  'default_event_fee_revenue_type',
  'default_fundraiser_transaction_fixed_fee',
  'default_fundraiser_revenue_percentage_fee',
  'default_fundraiser_fee_revenue_type',
  'feature_music_workspace',
  'feature_campaigns_workspace',
  'feature_sublabels',
  'feature_artist_profiles',
  'feature_music_releases',
  'feature_press_campaigns',
  'feature_sync_licensing',
  'feature_events',
  'feature_fundraisers',
] as const;

function pickEditableFields(body: any): Partial<Record<typeof PLAN_EDITABLE_FIELDS[number], any>> {
  const result: any = {};
  for (const field of PLAN_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/subscription/admin/plans  (superadmin only)
// Returns ALL plans (public and non-public, active and inactive) for management.
// PayPal plan IDs are excluded from the response.
// ---------------------------------------------------------------------------
export const getAdminPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      attributes: { exclude: ['paypal_plan_id_monthly', 'paypal_plan_id_annual'] },
    });
    res.json({ plans });
  } catch (error: any) {
    console.error('getAdminPlans error:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/admin/plans  (superadmin only)
// Creates a new plan. Only whitelisted fields are accepted.
// ---------------------------------------------------------------------------
export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await Plan.create(pickEditableFields(req.body) as any);
    res.status(201).json({ plan });
  } catch (error: any) {
    console.error('createPlan error:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/subscription/admin/plans/:id  (superadmin only)
// Updates an existing plan. Only whitelisted fields are accepted.
// ---------------------------------------------------------------------------
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByPk(id as string);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    await plan.update(pickEditableFields(req.body));
    res.json({ plan });
  } catch (error: any) {
    console.error('updatePlan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/subscription/invoices
// Returns paginated subscription invoices for the authenticated brand.
// ---------------------------------------------------------------------------
export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId: number = (req as any).user?.brand_id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await SubscriptionInvoice.findAndCountAll({
      where: { brand_id: brandId },
      include: [{ model: Plan, as: 'plan', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({ invoices: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (error: any) {
    console.error('getInvoices error:', error);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/subscription/payments
// Returns paginated subscription payments for the authenticated brand.
// ---------------------------------------------------------------------------
export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId: number = (req as any).user?.brand_id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await SubscriptionPayment.findAndCountAll({
      where: { brand_id: brandId },
      include: [
        {
          model: SubscriptionInvoice,
          as: 'invoice',
          attributes: ['id', 'invoice_number', 'period_start', 'period_end', 'billing_reason'],
          include: [{ model: Plan, as: 'plan', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({ payments: rows, total: count, page, totalPages: Math.ceil(count / limit) });
  } catch (error: any) {
    console.error('getPayments error:', error);
    res.status(500).json({ error: 'Failed to load payments' });
  }
};

// ---------------------------------------------------------------------------
// Internal helper — generate a sequential invoice number for a brand.
// Format: INV-{brandId}-{YYYY}-{zero-padded seq}
// ---------------------------------------------------------------------------
async function generateInvoiceNumber(brandId: number): Promise<string> {
  const year = new Date().getFullYear();
  const count = await SubscriptionInvoice.count({ where: { brand_id: brandId } });
  const seq = String(count + 1).padStart(4, '0');
  return `INV-${brandId}-${year}-${seq}`;
}

// ---------------------------------------------------------------------------
// Internal helper — record an invoice + successful payment from a PayPal sale.
// Idempotent: skips if a payment with the same paypal_transaction_id exists.
// ---------------------------------------------------------------------------
async function recordSuccessfulPayment(
  brandId: number,
  planId: number,
  billingCycle: 'monthly' | 'annual',
  amount: number,
  currency: string,
  billingReason: BillingReason,
  periodStart: Date,
  periodEnd: Date | null,
  paypalSubscriptionId: string,
  paypalTransactionId: string,
  paidAt: Date,
): Promise<void> {
  // Idempotency: skip if this PayPal transaction was already recorded.
  const existing = await SubscriptionPayment.findOne({ where: { paypal_transaction_id: paypalTransactionId } });
  if (existing) return;

  const invoiceNumber = await generateInvoiceNumber(brandId);
  const invoice = await SubscriptionInvoice.create({
    brand_id: brandId,
    plan_id: planId,
    billing_cycle: billingCycle,
    invoice_number: invoiceNumber,
    amount,
    currency,
    status: 'paid',
    billing_reason: billingReason,
    period_start: periodStart,
    period_end: periodEnd,
    paypal_subscription_id: paypalSubscriptionId,
    paid_at: paidAt,
  });

  await SubscriptionPayment.create({
    brand_id: brandId,
    invoice_id: invoice.id,
    amount,
    currency,
    status: 'succeeded',
    payment_method: 'paypal',
    paypal_transaction_id: paypalTransactionId,
    paypal_subscription_id: paypalSubscriptionId,
    processed_at: paidAt,
  });
}

// ---------------------------------------------------------------------------
// Internal helper — record an invoice + failed payment from a PayPal failure.
// Idempotent: skips if a payment with same subscription+processed_at exists.
// ---------------------------------------------------------------------------
async function recordFailedPayment(
  brandId: number,
  planId: number,
  billingCycle: 'monthly' | 'annual',
  amount: number,
  currency: string,
  paypalSubscriptionId: string,
  failedAt: Date,
): Promise<void> {
  const invoiceNumber = await generateInvoiceNumber(brandId);
  const invoice = await SubscriptionInvoice.create({
    brand_id: brandId,
    plan_id: planId,
    billing_cycle: billingCycle,
    invoice_number: invoiceNumber,
    amount,
    currency,
    status: 'open',
    billing_reason: 'subscription_cycle',
    period_start: failedAt,
    period_end: null,
    paypal_subscription_id: paypalSubscriptionId,
    paid_at: null,
  });

  await SubscriptionPayment.create({
    brand_id: brandId,
    invoice_id: invoice.id,
    amount,
    currency,
    status: 'failed',
    payment_method: 'paypal',
    paypal_transaction_id: null,
    paypal_subscription_id: paypalSubscriptionId,
    failure_reason: 'Payment declined by PayPal',
    processed_at: failedAt,
  });
}

// ---------------------------------------------------------------------------
// POST /api/subscription/webhook
// Public endpoint — PayPal subscription lifecycle webhook.
// ---------------------------------------------------------------------------
export const handleSubscriptionWebhook = async (req: Request, res: Response): Promise<void> => {
  // Verify PayPal webhook signature via their API
  const authAlgo = req.headers['paypal-auth-algo'] as string | undefined;
  const certUrl = req.headers['paypal-cert-url'] as string | undefined;
  const transmissionId = req.headers['paypal-transmission-id'] as string | undefined;
  const transmissionSig = req.headers['paypal-transmission-sig'] as string | undefined;
  const transmissionTime = req.headers['paypal-transmission-time'] as string | undefined;

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    res.status(400).json({ error: 'Missing PayPal webhook signature headers' });
    return;
  }

  const VALID_PAYPAL_CERT_HOSTNAMES = [
    'api.paypal.com',
    'api.sandbox.paypal.com',
    'api-m.paypal.com',
    'api-m.sandbox.paypal.com',
  ];
  let certUrlHostname: string;
  try {
    certUrlHostname = new URL(certUrl).hostname;
  } catch {
    console.warn('handleSubscriptionWebhook: unparseable certUrl, rejecting:', certUrl);
    res.status(400).json({ error: 'Invalid webhook cert URL' });
    return;
  }
  if (!VALID_PAYPAL_CERT_HOSTNAMES.includes(certUrlHostname)) {
    console.warn('handleSubscriptionWebhook: invalid certUrl hostname, rejecting:', certUrlHostname);
    res.status(400).json({ error: 'Invalid webhook cert URL' });
    return;
  }

  const isValid = await verifyPayPalWebhook({
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
    webhookEvent: req.body,
  });
  if (!isValid) {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  try {
    const eventType: string = req.body?.event_type ?? '';
    const resource = req.body?.resource;

    if (!resource) {
      res.sendStatus(200);
      return;
    }

    // BILLING.SUBSCRIPTION.ACTIVATED → mark active, persist ends_at from PayPal.
    // Guard: only move forward from incomplete/past_due — ignore if already active.
    // Special case: if this is the pending downgrade subscription (matched via
    // pending_paypal_subscription_id), do NOT activate the plan yet — just
    // acknowledge so PayPal doesn't retry. The Lambda will activate it at ends_at.
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        // Check if this is a pending downgrade subscription
        const pendingDowngradePlan = await BrandPlan.findOne({
          where: { pending_paypal_subscription_id: subscriptionId },
          include: [{ model: Plan, as: 'plan' }],
        });
        if (pendingDowngradePlan) {
          // Pending downgrade subscription authorized — nothing to do yet.
          // The Lambda activates it at ends_at.
          const pdp = pendingDowngradePlan as BrandPlan & { plan?: Plan };
          if (pdp.ends_at && pdp.pending_plan_id) {
            const isRestore = pdp.pending_plan_id === pdp.plan_id && pdp.pending_billing_cycle === pdp.billing_cycle;
            if (isRestore) {
              const restorePrice = pdp.billing_cycle === 'annual'
                ? (pdp.plan?.price_annual ?? 0)
                : (pdp.plan?.price_monthly ?? 0);
              sendSubscriptionRestoredEmail(
                pdp.brand_id,
                pdp.plan?.name ?? 'Current Plan',
                (pdp.billing_cycle ?? 'monthly') as 'monthly' | 'annual',
                restorePrice,
                new Date(pdp.ends_at!),
              ).catch((err) => console.error('sendSubscriptionRestoredEmail error:', err));
            } else {
              Plan.findByPk(pdp.pending_plan_id).then((newPlan) => {
                const newPrice = newPlan
                  ? (pdp.pending_billing_cycle === 'annual' ? newPlan.price_annual : newPlan.price_monthly)
                  : 0;
                return sendSubscriptionDowngradeScheduledEmail(
                  pdp.brand_id,
                  pdp.plan?.name ?? 'Current Plan',
                  newPlan?.name ?? 'New Plan',
                  new Date(pdp.ends_at!),
                  newPrice,
                  (pdp.pending_billing_cycle ?? 'monthly') as 'monthly' | 'annual',
                );
              }).catch((err) => console.error('sendSubscriptionDowngradeScheduledEmail error:', err));
            }
          }
          res.sendStatus(200);
          return;
        }

        // Fetch next_billing_time from PayPal outside the transaction (network call)
        let nextBillingTime: Date | null = null;
        try {
          nextBillingTime = await getPayPalSubscriptionNextBillingTime(subscriptionId);
        } catch (err) {
          console.error('Failed to fetch PayPal subscription details for ends_at:', err);
        }

        let activatedBrandPlan: BrandPlan | null = null;
        await sequelize.transaction(async (t) => {
          // No status filter — PAYMENT.SALE.COMPLETED may have already set status
          // to 'active' before this event fires, leaving pending_plan_id un-committed.
          const bp = await BrandPlan.findOne({
            where: { paypal_subscription_id: subscriptionId },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          if (!bp) return;

          const wasInactive = ['incomplete', 'past_due', 'unpaid'].includes(bp.status);

          // Commit the pending plan choice now that payment is confirmed.
          const newPlanId = bp.pending_plan_id ?? bp.plan_id;
          const newBillingCycle = bp.pending_billing_cycle ?? bp.billing_cycle;
          await bp.update(
            {
              plan_id: newPlanId,
              billing_cycle: newBillingCycle,
              ...(wasInactive ? { started_at: new Date() } : {}),
              status: 'active',
              ends_at: nextBillingTime ?? bp.ends_at ?? null,
              pending_plan_id: null,
              pending_billing_cycle: null,
            },
            { transaction: t }
          );

          // Only treat as a fresh activation for email purposes if it wasn't already active.
          if (wasInactive) {
            activatedBrandPlan = await BrandPlan.findOne({
              where: { paypal_subscription_id: subscriptionId },
              include: [{ model: Plan, as: 'plan' }],
              transaction: t,
            });
          }
        });
        if (activatedBrandPlan) {
          const bp = activatedBrandPlan as BrandPlan & { plan?: Plan };
          const price = bp.billing_cycle === 'monthly'
            ? (bp.plan?.price_monthly ?? 0)
            : (bp.plan?.price_annual ?? 0);
          sendSubscriptionActivatedEmail(
            bp.brand_id,
            bp.plan?.name ?? 'Paid',
            bp.billing_cycle as 'monthly' | 'annual',
            price,
          ).catch((err) => console.error('sendSubscriptionActivatedEmail error:', err));
        }
      }
    }

    // PAYMENT.SALE.COMPLETED → payment received.
    // Two cases:
    //   1. First payment (status incomplete/past_due/unpaid): commit pending plan, mark active.
    //   2. Renewal payment (status already active): refresh ends_at from PayPal.
    // billing_agreement_id is the subscription ID on sale events.
    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId: string = resource.billing_agreement_id;
      if (subscriptionId) {
        // Fetch updated next_billing_time outside the transaction (network call).
        let nextBillingTime: Date | null = null;
        try {
          nextBillingTime = await getPayPalSubscriptionNextBillingTime(subscriptionId);
        } catch (err) {
          console.error('PAYMENT.SALE.COMPLETED: failed to fetch next_billing_time:', err);
        }

        let activatedBrandPlanFromSale: BrandPlan | null = null;
        let renewedBrandPlan: BrandPlan | null = null;
        await sequelize.transaction(async (t) => {
          const bp = await BrandPlan.findOne({
            where: { paypal_subscription_id: subscriptionId },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });
          if (!bp) return;

          if (['incomplete', 'past_due', 'unpaid'].includes(bp.status)) {
            // First payment — commit pending plan choice and mark active.
            const newPlanId = bp.pending_plan_id ?? bp.plan_id;
            const newBillingCycle = bp.pending_billing_cycle ?? bp.billing_cycle;
            await bp.update(
              {
                plan_id: newPlanId,
                billing_cycle: newBillingCycle,
                started_at: new Date(),
                status: 'active',
                ends_at: nextBillingTime ?? null,
                pending_plan_id: null,
                pending_billing_cycle: null,
              },
              { transaction: t }
            );
            activatedBrandPlanFromSale = await BrandPlan.findOne({
              where: { paypal_subscription_id: subscriptionId },
              include: [{ model: Plan, as: 'plan' }],
              transaction: t,
            });
          } else if (bp.status === 'active' && nextBillingTime) {
            // Renewal — keep plan unchanged, just refresh ends_at.
            await bp.update({ ends_at: nextBillingTime }, { transaction: t });
            renewedBrandPlan = await BrandPlan.findOne({
              where: { paypal_subscription_id: subscriptionId },
              include: [{ model: Plan, as: 'plan' }],
              transaction: t,
            });
          }
        });
        if (activatedBrandPlanFromSale) {
          const bp = activatedBrandPlanFromSale as BrandPlan & { plan?: Plan };
          const price = bp.billing_cycle === 'monthly'
            ? (bp.plan?.price_monthly ?? 0)
            : (bp.plan?.price_annual ?? 0);
          sendSubscriptionActivatedEmail(
            bp.brand_id,
            bp.plan?.name ?? 'Paid',
            bp.billing_cycle as 'monthly' | 'annual',
            price,
          ).catch((err) => console.error('sendSubscriptionActivatedEmail error:', err));
          // Record invoice + payment for first activation
          if (resource.id && resource.amount?.total) {
            recordSuccessfulPayment(
              bp.brand_id,
              bp.plan_id,
              bp.billing_cycle as 'monthly' | 'annual',
              parseFloat(resource.amount.total),
              resource.amount.currency ?? 'PHP',
              'subscription_create',
              bp.started_at ? new Date(bp.started_at) : new Date(),
              bp.ends_at ? new Date(bp.ends_at) : null,
              subscriptionId,
              resource.id,
              new Date(resource.create_time ?? Date.now()),
            ).catch((err) => console.error('recordSuccessfulPayment (activation) error:', err));
          }
        }
        if (renewedBrandPlan) {
          const bp = renewedBrandPlan as BrandPlan & { plan?: Plan };
          const price = bp.billing_cycle === 'monthly'
            ? (bp.plan?.price_monthly ?? 0)
            : (bp.plan?.price_annual ?? 0);
          sendSubscriptionRenewalEmail(
            bp.brand_id,
            bp.plan?.name ?? 'Paid',
            bp.billing_cycle as 'monthly' | 'annual',
            price,
            bp.ends_at ? new Date(bp.ends_at) : null,
          ).catch((err) => console.error('sendSubscriptionRenewalEmail error:', err));
          // Record invoice + payment for renewal
          if (resource.id && resource.amount?.total) {
            // period_start is the previous ends_at before this renewal refreshed it
            const periodStart = new Date(resource.create_time ?? Date.now());
            recordSuccessfulPayment(
              bp.brand_id,
              bp.plan_id,
              bp.billing_cycle as 'monthly' | 'annual',
              parseFloat(resource.amount.total),
              resource.amount.currency ?? 'PHP',
              'subscription_cycle',
              periodStart,
              bp.ends_at ? new Date(bp.ends_at) : null,
              subscriptionId,
              resource.id,
              new Date(resource.create_time ?? Date.now()),
            ).catch((err) => console.error('recordSuccessfulPayment (renewal) error:', err));
          }
        }
      }
    }

    // BILLING.SUBSCRIPTION.PAYMENT.FAILED → mark past_due
    if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        let affectedBrandPlan: BrandPlan & { plan?: Plan } | null = null;
        await sequelize.transaction(async (t) => {
          const [count] = await BrandPlan.update(
            { status: 'past_due' },
            {
              where: {
                paypal_subscription_id: subscriptionId,
                status: { [Op.in]: ['active', 'incomplete'] },
              },
              transaction: t,
            }
          );
          if (count > 0) {
            affectedBrandPlan = await BrandPlan.findOne({
              where: { paypal_subscription_id: subscriptionId },
              include: [{ model: Plan, as: 'plan' }],
              transaction: t,
            }) as BrandPlan & { plan?: Plan } | null;
          }
        });
        if (affectedBrandPlan) {
          sendSubscriptionPastDueEmail(
            affectedBrandPlan.brand_id,
            affectedBrandPlan.plan?.name ?? 'Paid',
          ).catch((err) => console.error('sendSubscriptionPastDueEmail error:', err));
          // Record an open invoice + failed payment
          const bp = affectedBrandPlan;
          const price = bp.billing_cycle === 'monthly'
            ? (bp.plan?.price_monthly ?? 0)
            : (bp.plan?.price_annual ?? 0);
          recordFailedPayment(
            bp.brand_id,
            bp.plan_id,
            bp.billing_cycle as 'monthly' | 'annual',
            price,
            'PHP',
            subscriptionId,
            new Date(),
          ).catch((err) => console.error('recordFailedPayment error:', err));
        }
      }
    }

    // BILLING.SUBSCRIPTION.SUSPENDED → downgrade to Free.
    // PayPal may skip CANCELLED after SUSPENDED on some plan configs, so treat
    // SUSPENDED as terminal and downgrade immediately rather than staying past_due.
    if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        let affectedBrandPlan: BrandPlan & { plan?: Plan } | null = null;
        // Fetch before updating so we still have the plan name
        affectedBrandPlan = await BrandPlan.findOne({
          where: { paypal_subscription_id: subscriptionId },
          include: [{ model: Plan, as: 'plan' }],
        }) as BrandPlan & { plan?: Plan } | null;
        await sequelize.transaction(async (t) => {
          const freePlan = await Plan.findOne({
            where: { is_default_free: true, is_active: true },
            transaction: t,
          });
          if (freePlan) {
            await BrandPlan.update(
              {
                plan_id: freePlan.id,
                billing_cycle: 'monthly',
                status: 'active',
                paypal_subscription_id: null,
              },
              {
                where: { paypal_subscription_id: subscriptionId },
                transaction: t,
              }
            );
          }
        });
        if (affectedBrandPlan) {
          sendSubscriptionDowngradedEmail(
            affectedBrandPlan.brand_id,
            affectedBrandPlan.plan?.name ?? 'Paid',
            'suspended',
          ).catch((err) => console.error('sendSubscriptionDowngradedEmail error:', err));
        }
      }
    }

    // BILLING.SUBSCRIPTION.CANCELLED → handle three cases:
    // 1. pending_paypal_subscription_id cancelled — user declined a pending downgrade/
    //    cancel-pending-change at PayPal. Clear pending fields; current plan stays.
    // 2. paypal_subscription_id cancelled with status 'incomplete' — user abandoned
    //    the PayPal checkout. Revert pending intent, restore status to active.
    // 3. paypal_subscription_id cancelled with status 'active' — PayPal-initiated
    //    cancel (payment failure, external termination). Drop to Free immediately.
    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        // Case 1: pending downgrade subscription cancelled by user
        const pendingDowngradePlan = await BrandPlan.findOne({
          where: { pending_paypal_subscription_id: subscriptionId },
        });
        if (pendingDowngradePlan) {
          await pendingDowngradePlan.update({
            pending_plan_id: null,
            pending_billing_cycle: null,
            pending_paypal_subscription_id: null,
          });
          res.sendStatus(200);
          return;
        }

        let affectedBrandPlan: BrandPlan & { plan?: Plan } | null = null;
        affectedBrandPlan = await BrandPlan.findOne({
          where: { paypal_subscription_id: subscriptionId },
          include: [{ model: Plan, as: 'plan' }],
        }) as BrandPlan & { plan?: Plan } | null;

        if (!affectedBrandPlan) {
          res.sendStatus(200);
          return;
        }

        if (affectedBrandPlan.status === 'incomplete') {
          // Case 2: User abandoned the PayPal checkout flow (cancelled from PayPal UI).
          // Revert the pending checkout — keep plan_id as-is (it was never changed),
          // clear the pending intent fields, and restore the status that existed before
          // the checkout attempt (e.g. past_due should not be promoted to active).
          const restoredStatus = affectedBrandPlan.pre_checkout_status ?? 'active';
          await affectedBrandPlan.update({
            paypal_subscription_id: null,
            pending_plan_id: null,
            pending_billing_cycle: null,
            pre_checkout_status: null,
            status: restoredStatus,
          });
        } else {
          // Case 3: PayPal-initiated cancel (payment failure, external termination, etc.)
          // Drop to Free immediately.
          await sequelize.transaction(async (t) => {
            const freePlan = await Plan.findOne({
              where: { is_default_free: true, is_active: true },
              transaction: t,
            });
            if (freePlan) {
              await BrandPlan.update(
                {
                  plan_id: freePlan.id,
                  billing_cycle: 'monthly',
                  status: 'active',
                  paypal_subscription_id: null,
                  pending_plan_id: null,
                  pending_billing_cycle: null,
                  ends_at: null,
                },
                {
                  where: { paypal_subscription_id: subscriptionId },
                  transaction: t,
                }
              );
            }
          });
          sendSubscriptionDowngradedEmail(
            affectedBrandPlan.brand_id,
            affectedBrandPlan.plan?.name ?? 'Paid',
            'cancelled',
          ).catch((err) => console.error('sendSubscriptionDowngradedEmail error:', err));
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('handleSubscriptionWebhook error:', error);
    // Return 500 so PayPal retries on genuine infrastructure/DB failures.
    res.sendStatus(500);
  }
};
