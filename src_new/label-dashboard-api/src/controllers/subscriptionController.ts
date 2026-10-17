import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
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
} from '../services/subscriptionService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { sendSubscriptionActivatedEmail } from '../utils/emailService';

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

    // Paid plan: create PayPal subscription
    // Ensure PayPal billing plan exists for this billing cycle
    const paypalPlanId = await syncPlanToPayPal(plan, billing_cycle);

    // Build return and cancel URLs
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const returnUrl = `${frontendUrl}/admin/subscription?checkout=success`;
    const cancelUrl = `${frontendUrl}/admin/subscription?checkout=cancelled`;

    const { subscriptionId, approvalUrl } = await createPayPalSubscription({
      planId: paypalPlanId,
      returnUrl,
      cancelUrl,
    });

    // Store the pending subscription record (status: incomplete until webhook confirms)
    const [paidBrandPlan] = await BrandPlan.findOrCreate({
      where: { brand_id: brandId },
      defaults: {
        plan_id: plan.id,
        billing_cycle,
        started_at: new Date(),
        ends_at: null,
        status: 'incomplete',
        paypal_subscription_id: subscriptionId,
      } as any,
    });
    await paidBrandPlan.update({
      plan_id: plan.id,
      billing_cycle,
      started_at: new Date(),
      ends_at: null,
      status: 'incomplete',
      paypal_subscription_id: subscriptionId,
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

    // Call PayPal to cancel. If this throws, the subscription is still active —
    // DB is untouched and the brand is not affected.
    if (brandPlan.paypal_subscription_id) {
      await cancelPayPalSubscription(brandPlan.paypal_subscription_id);
    }

    // Do not eagerly downgrade the DB here. The BILLING.SUBSCRIPTION.CANCELLED webhook
    // that PayPal fires after cancellation is the single source of truth — it will
    // downgrade the brand to Free atomically via the webhook handler.

    res.json({ success: true });
  } catch (error: any) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
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

    // BILLING.SUBSCRIPTION.ACTIVATED → mark active
    // Guard: only move forward from incomplete/past_due — ignore if already active.
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        let activatedBrandPlan: BrandPlan | null = null;
        await sequelize.transaction(async (t) => {
          const [count] = await BrandPlan.update(
            { status: 'active' },
            {
              where: {
                paypal_subscription_id: subscriptionId,
                status: { [Op.in]: ['incomplete', 'past_due', 'unpaid'] },
              },
              transaction: t,
            }
          );
          if (count > 0) {
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

    // PAYMENT.SALE.COMPLETED → payment received, ensure subscription is active.
    // billing_agreement_id is the subscription ID on sale events.
    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId: string = resource.billing_agreement_id;
      if (subscriptionId) {
        await sequelize.transaction(async (t) => {
          await BrandPlan.update(
            { status: 'active' },
            {
              where: {
                paypal_subscription_id: subscriptionId,
                status: { [Op.in]: ['incomplete', 'past_due', 'unpaid'] },
              },
              transaction: t,
            }
          );
        });
      }
    }

    // BILLING.SUBSCRIPTION.PAYMENT.FAILED → mark past_due
    if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        await sequelize.transaction(async (t) => {
          await BrandPlan.update(
            { status: 'past_due' },
            {
              where: {
                paypal_subscription_id: subscriptionId,
                status: { [Op.in]: ['active', 'incomplete'] },
              },
              transaction: t,
            }
          );
        });
      }
    }

    // BILLING.SUBSCRIPTION.SUSPENDED → treat as past_due
    if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
        await sequelize.transaction(async (t) => {
          await BrandPlan.update(
            { status: 'past_due' },
            {
              where: {
                paypal_subscription_id: subscriptionId,
                status: { [Op.ne]: 'cancelled' },
              },
              transaction: t,
            }
          );
        });
      }
    }

    // BILLING.SUBSCRIPTION.CANCELLED → downgrade to Free
    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const subscriptionId: string = resource.id;
      if (subscriptionId) {
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
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('handleSubscriptionWebhook error:', error);
    // Return 500 so PayPal retries on genuine infrastructure/DB failures.
    res.sendStatus(500);
  }
};
