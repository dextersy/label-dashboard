import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../config/database';
import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
import Brand from '../models/Brand';
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
// GET /api/subscription/invoices/:id/pdf
// Downloads a subscription invoice as a PDF for the authenticated brand.
// ---------------------------------------------------------------------------

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, (imgRes) => {
        const chunks: Buffer[] = [];
        imgRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        imgRes.on('end', () => resolve(Buffer.concat(chunks)));
        imgRes.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** Interpolate two hex colours for the gradient accent band. */
function lerpHex(from: string, to: string, t: number): string {
  const f = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = f(from);
  const [r2, g2, b2] = f(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Draw a simulated left→right gradient rect using thin vertical slices. */
function drawGradientRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  colorFrom: string, colorTo: string,
  steps = 60,
): void {
  const sliceW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.rect(x + i * sliceW, y, sliceW + 0.5, h)
      .fill(lerpHex(colorFrom, colorTo, t));
  }
}

/** Format a currency amount. Uses thousands separators; avoids non-ASCII symbols. */
function formatMoney(amount: number, currency: string): string {
  // Intl formats with the currency code — ASCII-safe for PDFKit built-in fonts
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',   // e.g. "PHP 1,290.03" — all ASCII
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/** Short date: Oct 20, 2026 */
function fmtShort(d: Date | string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Draw a small filled circle (replaces Unicode bullet which breaks built-in fonts). */
function drawDot(doc: InstanceType<typeof PDFDocument>, cx: number, cy: number, r: number, color: string): void {
  doc.save().circle(cx, cy, r).fill(color).restore();
}

/** Draw a horizontal hairline. */
function hairline(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, color = '#E7E4F0'): void {
  doc.save().strokeColor(color).lineWidth(0.75).moveTo(x, y).lineTo(x + w, y).stroke().restore();
}

// ── Shared PDF buffer builder (used by download endpoint + email attachments) ─

export async function buildInvoicePdfBuffer(invoiceId: number, brandId: number): Promise<Buffer | null> {
  try {
    // ── Fetch invoice + plan ─────────────────────────────────────────────────
    const invoice = await SubscriptionInvoice.findOne({
      where: { id: invoiceId, brand_id: brandId },
      include: [{ model: Plan, as: 'plan', attributes: ['id', 'name'] }],
    });
    if (!invoice) return null;

    // ── Most recent succeeded payment ────────────────────────────────────────
    const payment = await SubscriptionPayment.findOne({
      where: { invoice_id: invoiceId, status: 'succeeded' },
      order: [['processed_at', 'DESC']],
    });

    // ── Issuer brand (walk to parent) ────────────────────────────────────────
    const currentBrand = await Brand.findByPk(brandId, { attributes: ['id', 'brand_name', 'logo_url', 'brand_color', 'parent_brand', 'billing_company_name', 'billing_address', 'billing_tin'] });
    let issuerBrand = currentBrand;
    if (currentBrand?.parent_brand) {
      const parentBrand = await Brand.findByPk(currentBrand.parent_brand, { attributes: ['id', 'brand_name', 'logo_url', 'brand_color', 'billing_company_name', 'billing_address', 'billing_tin'] });
      if (parentBrand) issuerBrand = parentBrand;
    }
    const issuerOfficialName = (issuerBrand as any)?.billing_company_name ?? null;
    const issuerName    = issuerOfficialName ?? issuerBrand?.brand_name ?? 'Platform';
    const issuerLogoUrl = issuerBrand?.logo_url ?? null;
    const rawBrandColor = issuerBrand?.brand_color ?? null;
    const ACCENT        = rawBrandColor
      ? (rawBrandColor.startsWith('#') ? rawBrandColor : `#${rawBrandColor}`)
      : '#2D2D2D';

    // ── Admin user for "Billed to" ────────────────────────────────────────────
    const adminUser = await User.findOne({
      where: { brand_id: brandId, is_admin: true },
      order: [['id', 'ASC']],
      attributes: ['first_name', 'last_name', 'email_address'],
    });
    const billedToName  = adminUser
      ? [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ') || issuerName
      : issuerName;
    const billedToEmail = (adminUser as any)?.email_address ?? null;

    // ── Env config (fallbacks if issuer brand has no billing details) ─────────
    const issuerAddress = (issuerBrand as any)?.billing_address ?? process.env.INVOICE_ISSUER_ADDRESS ?? null;
    const issuerTin     = (issuerBrand as any)?.billing_tin     ?? process.env.INVOICE_ISSUER_TIN     ?? null;
    const supportEmail  = process.env.INVOICE_SUPPORT_EMAIL  ?? (process.env.FROM_EMAIL ?? null);

    // ── Logo ─────────────────────────────────────────────────────────────────
    let logoBuffer: Buffer | null = null;
    if (issuerLogoUrl) logoBuffer = await fetchImageBuffer(issuerLogoUrl);

    // ── Amounts ───────────────────────────────────────────────────────────────
    const totalAmount = Number(invoice.amount);
    const taxRate     = 0;
    const subtotal    = taxRate > 0 ? totalAmount / (1 + taxRate) : totalAmount;
    const taxAmount   = totalAmount - subtotal;
    const currency    = invoice.currency;

    // ── Labels ────────────────────────────────────────────────────────────────
    const billingReasonLabel: Record<string, string> = {
      subscription_create: 'New subscription',
      subscription_cycle:  `${invoice.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} subscription renewal`,
      subscription_update: 'Plan change',
    };
    const lineItemSubtitle = billingReasonLabel[invoice.billing_reason] ?? invoice.billing_reason;
    const planName         = (invoice as any).plan?.name ?? 'Subscription';
    const isPaid           = invoice.status === 'paid';
    const isVoid           = invoice.status === 'void';

    const paymentMethodDisplay = payment
      ? payment.payment_method.charAt(0).toUpperCase() + payment.payment_method.slice(1)
      : '-';
    const transactionRef = payment?.paypal_transaction_id ?? '-';
    const paidOnDate     = payment?.processed_at ?? invoice.paid_at ?? null;

    // ══════════════════════════════════════════════════════════════════════════
    // BUILD PDF
    // ══════════════════════════════════════════════════════════════════════════
    return await new Promise<Buffer>((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const PW = doc.page.width;
      const PH = doc.page.height;
      const ML = 48;
      const CW = PW - ML * 2;
      const INK   = '#1D1A2B';
      const MUTED = '#6B6780';
      const TINT  = '#F5F5F7';
      const ACCENT_LIGHT = lerpHex(ACCENT, '#FFFFFF', 0.35);

      // 1. Accent band
      drawGradientRect(doc, 0, 0, PW, 6, ACCENT, ACCENT_LIGHT);
      let curY = 6;

      // 2. Header row
      curY += 28;
      const headerRowY = curY;
      const logoSize   = 52;
      if (logoBuffer) {
        const lx = ML, ly = headerRowY, r = 8;
        // Draw background in brand color first so light/white logos are always visible
        doc.roundedRect(lx, ly, logoSize, logoSize, r).fill(ACCENT);
        doc.save()
          .moveTo(lx + r, ly).lineTo(lx + logoSize - r, ly)
          .quadraticCurveTo(lx + logoSize, ly, lx + logoSize, ly + r)
          .lineTo(lx + logoSize, ly + logoSize - r)
          .quadraticCurveTo(lx + logoSize, ly + logoSize, lx + logoSize - r, ly + logoSize)
          .lineTo(lx + r, ly + logoSize)
          .quadraticCurveTo(lx, ly + logoSize, lx, ly + logoSize - r)
          .lineTo(lx, ly + r)
          .quadraticCurveTo(lx, ly, lx + r, ly)
          .closePath().clip()
          .image(logoBuffer, lx, ly, { fit: [logoSize, logoSize], align: 'center', valign: 'center' })
          .restore();
      }
      const nameX    = logoBuffer ? ML + logoSize + 10 : ML;
      const nameMaxW = CW * 0.5;
      const nameFs   = 11, emailFs = 9, lineGap = 5;
      const textBlockH = supportEmail ? nameFs + lineGap + emailFs : nameFs;
      const nameY    = headerRowY + Math.round((logoSize - textBlockH) / 2);
      doc.font('Helvetica-Bold').fontSize(nameFs).fillColor(INK)
        .text(issuerName, nameX, nameY, { width: nameMaxW, lineBreak: false });
      if (supportEmail) {
        doc.font('Helvetica').fontSize(emailFs).fillColor(MUTED)
          .text(supportEmail, nameX, nameY + nameFs + lineGap, { width: nameMaxW, lineBreak: false });
      }

      const rightColW = CW * 0.45;
      const rightColX = PW - ML - rightColW;
      doc.font('Helvetica').fontSize(28).fillColor(INK)
        .text('Invoice', rightColX, headerRowY - 4, { width: rightColW, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(invoice.invoice_number ?? String(invoiceId), rightColX, headerRowY + 28, { width: rightColW, align: 'right', lineBreak: false });

      // Status pill
      const pillY     = headerRowY + 44;
      const pillLabel = isPaid ? 'Paid' : isVoid ? 'Void' : 'Unpaid';
      const pillBg    = isPaid ? '#E4F5EC' : isVoid ? '#F3F4F6' : '#FEF3C7';
      const pillFg    = isPaid ? '#17744B' : isVoid ? '#6B7280' : '#92400E';
      const dotR      = 3, dotGap = 5;
      doc.font('Helvetica-Bold').fontSize(9);
      const pillLabelW = doc.widthOfString(pillLabel);
      const pillPadX = 9, pillPadY = 4;
      const pillInnerW = dotR * 2 + dotGap + pillLabelW;
      const pillW = pillInnerW + pillPadX * 2;
      const pillH = 9 + pillPadY * 2;
      const pillX = PW - ML - pillW;
      doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(pillBg);
      drawDot(doc, pillX + pillPadX + dotR, pillY + pillH / 2, dotR, pillFg);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(pillFg)
        .text(pillLabel, pillX + pillPadX + dotR * 2 + dotGap, pillY + pillPadY, { width: pillLabelW, lineBreak: false });

      curY = Math.max(headerRowY + logoSize, pillY + pillH) + 24;

      // 3. Info row
      hairline(doc, ML, curY, CW);
      curY += 14;
      const colW3 = CW / 3, labelFs = 8, valueFs = 10;
      const infoCol = (x: number, label: string, lines: (string | null)[]): number => {
        doc.font('Helvetica').fontSize(labelFs).fillColor(MUTED)
          .text(label, x, curY, { width: colW3 - 6, lineBreak: false });
        let yy = curY + 16;
        for (const line of lines) {
          if (!line) continue;
          doc.font('Helvetica').fontSize(valueFs).fillColor(INK).text(line, x, yy, { width: colW3 - 6 });
          yy = doc.y + 2;
        }
        return yy;
      };
      const periodText = `${fmtShort(invoice.period_start)} to ${invoice.period_end ? fmtShort(invoice.period_end) : 'Ongoing'}`;
      const renewsText = invoice.billing_cycle === 'annual' ? 'Renews annually' : 'Renews monthly';
      const billedToCompany  = currentBrand?.billing_company_name ?? null;
      const billedToAddress  = currentBrand?.billing_address ?? null;
      const billedToBrandTin = currentBrand?.billing_tin ?? null;

      const colBottoms = [
        infoCol(ML,             'From',           [issuerName, issuerAddress, issuerTin ? `TIN: ${issuerTin}` : null]),
        infoCol(ML + colW3,     'Billed to',      [billedToCompany ?? billedToName, billedToCompany ? billedToName : null, billedToEmail, billedToAddress, billedToBrandTin ? `TIN: ${billedToBrandTin}` : null]),
        infoCol(ML + colW3 * 2, 'Billing period', [periodText, renewsText]),
      ];
      curY = Math.max(...colBottoms) + 14;
      hairline(doc, ML, curY, CW);
      curY += 12;

      // 4. Dates line
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Issued  ', ML, curY, { continued: true, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(INK)
        .text(fmtShort(invoice.createdAt), { continued: isPaid, lineBreak: false });
      if (isPaid && paidOnDate) {
        doc.font('Helvetica').fillColor(MUTED).text('      Paid  ', { continued: true, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(INK).text(fmtShort(paidOnDate), { lineBreak: false });
      }
      curY += 22;

      // 5. Line items table
      hairline(doc, ML, curY, CW);
      curY += 2;
      const tableHdrH = 28;
      doc.roundedRect(ML, curY, CW, tableHdrH, 4).fill(TINT);
      const tblPad    = 10;
      const amtRight  = ML + CW - tblPad;
      const amtW      = 96;
      const unitRight = amtRight - amtW - 14;
      const unitW     = 100;
      const qtyRight  = unitRight - unitW - 14;
      const qtyW      = 36;
      const colDesc   = ML + tblPad;
      const descW     = qtyRight - qtyW - colDesc - 8;
      const tblHdrY   = curY + (tableHdrH - 10) / 2;
      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      doc.text('Description', colDesc,           tblHdrY, { width: descW,  lineBreak: false });
      doc.text('Qty',         qtyRight - qtyW,   tblHdrY, { width: qtyW,   align: 'right', lineBreak: false });
      doc.text('Unit price',  unitRight - unitW, tblHdrY, { width: unitW,  align: 'right', lineBreak: false });
      doc.text('Amount',      amtRight - amtW,   tblHdrY, { width: amtW,   align: 'right', lineBreak: false });
      curY += tableHdrH + 8;

      const rowStartY = curY;
      const amtStr    = formatMoney(subtotal, currency);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
        .text(`${planName} plan`, colDesc, rowStartY, { width: descW, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(lineItemSubtitle, colDesc, rowStartY + 15, { width: descW, lineBreak: false });
      doc.font('Helvetica').fontSize(11).fillColor(INK)
        .text('1',    qtyRight - qtyW,   rowStartY, { width: qtyW,  align: 'right', lineBreak: false });
      doc.text(amtStr, unitRight - unitW, rowStartY, { width: unitW, align: 'right', lineBreak: false });
      doc.text(amtStr, amtRight - amtW,   rowStartY, { width: amtW,  align: 'right', lineBreak: false });
      curY = rowStartY + 36;
      hairline(doc, ML, curY, CW);
      curY += 14;

      // 6. Totals block
      const totW      = 320;
      const totX      = PW - ML - totW;
      const totLabelW = 110;
      const totValW   = totW - totLabelW;
      const totRow    = (label: string, value: string, labelColor = MUTED, valueColor = INK, fs = 10): void => {
        doc.font('Helvetica').fontSize(fs).fillColor(labelColor)
          .text(label, totX, curY, { width: totLabelW, lineBreak: false });
        doc.font('Helvetica').fontSize(fs).fillColor(valueColor)
          .text(value, totX + totLabelW, curY, { width: totValW, align: 'right', lineBreak: false });
        curY += fs + 8;
      };
      totRow('Subtotal', formatMoney(subtotal, currency));
      totRow(`VAT (${(taxRate * 100).toFixed(0)}%)`, formatMoney(taxAmount, currency));
      curY += 4;
      doc.save().strokeColor(ACCENT).lineWidth(2)
        .moveTo(totX, curY).lineTo(PW - ML, curY).stroke().restore();
      curY += 12;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
        .text('Total', totX, curY + 4, { width: totLabelW, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(18).fillColor(INK)
        .text(formatMoney(totalAmount, currency), totX + totLabelW, curY, { width: totValW, align: 'right', lineBreak: false });
      curY += 28;
      const amountLineColor = isPaid ? '#17744B' : '#92400E';
      const amountLineLabel = isPaid ? 'Amount paid' : 'Amount due';
      doc.font('Helvetica-Bold').fontSize(10).fillColor(amountLineColor)
        .text(`${amountLineLabel}  ${formatMoney(totalAmount, currency)}`, totX, curY, { width: totW, align: 'right', lineBreak: false });
      curY += 28;

      // 7. Payment box
      if (payment) {
        const boxH = 64, boxPad = 16;
        doc.roundedRect(ML, curY, CW, boxH, 6).fill(TINT);
        const payColW = CW / 3;
        const payY    = curY + boxPad;
        const payCell = (x: number, label: string, value: string): void => {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
            .text(label, x, payY, { width: payColW - 8, lineBreak: false });
          doc.font('Helvetica').fontSize(10).fillColor(INK)
            .text(value, x, payY + 13, { width: payColW - 8, lineBreak: false });
        };
        payCell(ML + boxPad,               'Payment method', paymentMethodDisplay);
        payCell(ML + boxPad + payColW,     'Paid on',        isPaid && paidOnDate ? fmtShort(paidOnDate) : '-');
        payCell(ML + boxPad + payColW * 2, 'Reference',      transactionRef);
        curY += boxH + 20;
      } else {
        curY += 8;
      }

      // 8. Footer
      const footerY = Math.max(curY, PH - 60);
      hairline(doc, ML, footerY, CW);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Thank you for your business.', ML, footerY + 10, { width: CW * 0.6, lineBreak: false });
      if (supportEmail) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED)
          .text(`Questions? ${supportEmail}`, ML + CW * 0.4, footerY + 10, { width: CW * 0.6, align: 'right', lineBreak: false });
      }

      doc.end();
    });
  } catch (err) {
    console.error('buildInvoicePdfBuffer error:', err);
    return null;
  }
}

// ── Controller ───────────────────────────────────────────────────────────────

export const downloadInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId   = (req as any).user?.brand_id as number;
    const invoiceId = parseInt(req.params.id as string, 10);

    // Verify the invoice belongs to this brand before serving it
    const exists = await SubscriptionInvoice.findOne({ where: { id: invoiceId, brand_id: brandId }, attributes: ['id', 'invoice_number'] });
    if (!exists) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const pdfBuffer = await buildInvoicePdfBuffer(invoiceId, brandId);
    if (!pdfBuffer) {
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
      return;
    }

    const sanitizedNum = (exists.invoice_number ?? String(invoiceId)).replace(/[^A-Z0-9\-]/gi, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${sanitizedNum}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('downloadInvoicePdf error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
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
): Promise<number | null> {
  // Idempotency: skip if this PayPal transaction was already recorded.
  const existing = await SubscriptionPayment.findOne({ where: { paypal_transaction_id: paypalTransactionId } });
  if (existing) return existing.invoice_id;

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

  return invoice.id;
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
          // Record invoice + payment first so we have the ID for the email attachment
          let activationInvoiceId: number | null | undefined;
          if (resource.id && resource.amount?.total) {
            activationInvoiceId = await recordSuccessfulPayment(
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
            ).catch((err) => { console.error('recordSuccessfulPayment (activation) error:', err); return null; });
          }
          sendSubscriptionActivatedEmail(
            bp.brand_id,
            bp.plan?.name ?? 'Paid',
            bp.billing_cycle as 'monthly' | 'annual',
            price,
            activationInvoiceId ?? undefined,
          ).catch((err) => console.error('sendSubscriptionActivatedEmail error:', err));
        }
        if (renewedBrandPlan) {
          const bp = renewedBrandPlan as BrandPlan & { plan?: Plan };
          const price = bp.billing_cycle === 'monthly'
            ? (bp.plan?.price_monthly ?? 0)
            : (bp.plan?.price_annual ?? 0);
          // Record invoice + payment first so we have the ID for the email attachment
          let renewalInvoiceId: number | null | undefined;
          if (resource.id && resource.amount?.total) {
            const periodStart = new Date(resource.create_time ?? Date.now());
            renewalInvoiceId = await recordSuccessfulPayment(
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
            ).catch((err) => { console.error('recordSuccessfulPayment (renewal) error:', err); return null; });
          }
          sendSubscriptionRenewalEmail(
            bp.brand_id,
            bp.plan?.name ?? 'Paid',
            bp.billing_cycle as 'monthly' | 'annual',
            price,
            bp.ends_at ? new Date(bp.ends_at) : null,
            renewalInvoiceId ?? undefined,
          ).catch((err) => console.error('sendSubscriptionRenewalEmail error:', err));
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

// ── Billing details ───────────────────────────────────────────────────────────

export const getBillingDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;
    if (!brandId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const brand = await Brand.findByPk(brandId, {
      attributes: ['billing_company_name', 'billing_address', 'billing_tin'],
    });
    if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }

    res.json({
      billing_company_name: brand.billing_company_name ?? null,
      billing_address: brand.billing_address ?? null,
      billing_tin: brand.billing_tin ?? null,
    });
  } catch (error) {
    console.error('getBillingDetails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBillingDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;
    if (!brandId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { billing_company_name, billing_address, billing_tin } = req.body;

    const brand = await Brand.findByPk(brandId);
    if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }

    await brand.update({
      billing_company_name: billing_company_name !== undefined ? (billing_company_name || null) : brand.billing_company_name,
      billing_address: billing_address !== undefined ? (billing_address || null) : brand.billing_address,
      billing_tin: billing_tin !== undefined ? (billing_tin || null) : brand.billing_tin,
    });

    res.json({
      billing_company_name: brand.billing_company_name ?? null,
      billing_address: brand.billing_address ?? null,
      billing_tin: brand.billing_tin ?? null,
    });
  } catch (error) {
    console.error('updateBillingDetails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
