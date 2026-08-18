import { Request, Response } from 'express';
import crypto from 'crypto';
import { Op, fn, col, literal } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
import User from '../models/User';
import Artist from '../models/Artist';
import { ReleaseArtist, Release } from '../models';
import {
  createPayMongoCustomer,
  syncPlanToPayMongo,
  createPayMongoSubscription,
  cancelPayMongoSubscription,
  resolveEffectiveLimits,
  getEffectiveLimitsForBrand,
} from '../services/subscriptionService';
import { getBrandFrontendUrl } from '../utils/brandUtils';

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
      attributes: { exclude: ['paymongo_plan_id_monthly', 'paymongo_plan_id_annual'] },
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

    res.json({
      limits,
      usage: {
        artists: artistCount,
        admin_users: adminUserCount,
        releases_per_artist: releasesPerArtist,
      },
    });
  } catch (error: any) {
    console.error('getUsage error:', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/checkout
// Initiates upgrade/switch to a paid plan. Returns a PayMongo checkout URL.
// For the Free plan, switches immediately without PayMongo.
// ---------------------------------------------------------------------------
export const initiateCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const brandId = (req as any).user?.brand_id;
    const userId = (req as any).user?.id;
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

    // Free plan: switch immediately, no PayMongo involved
    if (plan.price_monthly === 0 && plan.price_annual === 0) {
      const [freeBrandPlan] = await BrandPlan.findOrCreate({
        where: { brand_id: brandId },
        defaults: {
          plan_id: plan.id,
          billing_cycle,
          started_at: new Date(),
          ends_at: null,
          status: 'active',
          paymongo_customer_id: null,
          paymongo_subscription_id: null,
        } as any,
      });
      await freeBrandPlan.update({
        plan_id: plan.id,
        billing_cycle,
        started_at: new Date(),
        ends_at: null,
        status: 'active',
        paymongo_customer_id: null,
        paymongo_subscription_id: null,
      });
      res.json({ immediate: true });
      return;
    }

    // Paid plan: need PayMongo subscription
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Resolve or create PayMongo customer
    let existingBrandPlan = await BrandPlan.findOne({ where: { brand_id: brandId } });
    let customerId = existingBrandPlan?.paymongo_customer_id ?? null;

    if (!customerId) {
      customerId = await createPayMongoCustomer({
        email: (user as any).email_address,
        firstName: (user as any).first_name ?? '',
        lastName: (user as any).last_name ?? '',
        phone: (user as any).phone ?? undefined,
      });
    }

    // Ensure PayMongo plan exists for this billing cycle
    const paymongoplanId = await syncPlanToPayMongo(plan, billing_cycle);

    // Build return URL
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const returnUrl = `${frontendUrl}/admin/subscription`;

    const { subscriptionId, checkoutUrl } = await createPayMongoSubscription({
      customerId,
      planId: paymongoplanId,
      returnUrl,
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
        paymongo_customer_id: customerId,
        paymongo_subscription_id: subscriptionId,
      } as any,
    });
    await paidBrandPlan.update({
      plan_id: plan.id,
      billing_cycle,
      started_at: new Date(),
      ends_at: null,
      status: 'incomplete',
      paymongo_customer_id: customerId,
      paymongo_subscription_id: subscriptionId,
    });

    res.json({ checkout_url: checkoutUrl });
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

    // Call PayMongo to cancel. If this throws, the subscription is still active —
    // DB is untouched and the brand is not affected.
    if (brandPlan.paymongo_subscription_id) {
      await cancelPayMongoSubscription(brandPlan.paymongo_subscription_id);
    }

    // Do not eagerly downgrade the DB here. The subscription.updated webhook that
    // PayMongo fires after cancellation is the single source of truth — it will
    // downgrade the brand to Free atomically via the webhook handler.

    res.json({ success: true });
  } catch (error: any) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/dev-override  (development only)
// Directly sets the brand's plan without PayMongo — for local testing only.
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
        paymongo_customer_id: null,
        paymongo_subscription_id: null,
      } as any,
    });
    await devBrandPlan.update({
      plan_id: plan.id,
      billing_cycle,
      started_at: new Date(),
      ends_at: null,
      status: 'active',
      paymongo_customer_id: null,
      paymongo_subscription_id: null,
    });

    res.json({ success: true, plan: plan.name, billing_cycle });
  } catch (error: any) {
    console.error('devOverridePlan error:', error);
    res.status(500).json({ error: 'Failed to override plan' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/subscription/webhook
// Public endpoint — PayMongo subscription lifecycle webhook.
// ---------------------------------------------------------------------------
export const handleSubscriptionWebhook = async (req: Request, res: Response): Promise<void> => {
  // Verify PayMongo signature
  const signature = req.headers['paymongo-signature'] as string | undefined;
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret) {
    const tMatch = signature?.match(/t=([^,]+)/);
    const teMatch = signature?.match(/te=([^,]+)/);
    const liMatch = signature?.match(/li=([^,]+)/);
    const timestamp = tMatch?.[1];
    const receivedSig = teMatch?.[1] ?? liMatch?.[1];

    // Reject if the header is missing or unparseable — don't silently skip verification
    if (!timestamp || !receivedSig) {
      res.status(400).json({ error: 'Missing or malformed signature header' });
      return;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('Webhook signature verification failed: rawBody is missing. Ensure the webhook route has the raw body capture middleware applied.');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (expectedSig !== receivedSig) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
  }

  try {

    const event = req.body?.data?.attributes;
    const eventType: string = event?.type ?? '';
    const resourceData = event?.data;

    if (!resourceData) {
      res.sendStatus(200);
      return;
    }

    const attrs = resourceData.attributes;

    // Invoice paid → activate subscription.
    // Guard: only move forward from incomplete/past_due — ignore if already active
    // (protects against duplicate or out-of-order delivery).
    if (eventType === 'subscription.invoice.paid') {
      const subscriptionId: string = attrs?.subscription_id;
      if (subscriptionId) {
        await sequelize.transaction(async (t) => {
          await BrandPlan.update(
            { status: 'active' },
            {
              where: {
                paymongo_subscription_id: subscriptionId,
                status: { [Op.in]: ['incomplete', 'past_due', 'unpaid'] },
              },
              transaction: t,
            }
          );
        });
      }
    }

    // Invoice payment failed → mark past_due.
    // Guard: only move forward from active/incomplete.
    if (eventType === 'subscription.invoice.payment_failed') {
      const subscriptionId: string = attrs?.subscription_id;
      if (subscriptionId) {
        await sequelize.transaction(async (t) => {
          await BrandPlan.update(
            { status: 'past_due' },
            {
              where: {
                paymongo_subscription_id: subscriptionId,
                status: { [Op.in]: ['active', 'incomplete'] },
              },
              transaction: t,
            }
          );
        });
      }
    }

    // Subscription updated (catches cancellations and unpaid).
    // Guard: don't overwrite a terminal state (cancelled) with an earlier state.
    if (eventType === 'subscription.updated' || eventType === 'subscription.unpaid') {
      const subscriptionId: string = resourceData.id;
      const newStatus: string = attrs?.status;

      if (subscriptionId && newStatus) {
        const statusMap: Record<string, BrandPlan['status']> = {
          active: 'active',
          incomplete: 'incomplete',
          incomplete_cancelled: 'cancelled',
          past_due: 'past_due',
          unpaid: 'unpaid',
          cancelled: 'cancelled',
        };
        const mappedStatus = statusMap[newStatus];
        if (mappedStatus) {
          await sequelize.transaction(async (t) => {
            // Don't regress out of a terminal state
            await BrandPlan.update(
              { status: mappedStatus },
              {
                where: {
                  paymongo_subscription_id: subscriptionId,
                  status: { [Op.ne]: 'cancelled' },
                },
                transaction: t,
              }
            );

            // If cancelled or unpaid, downgrade to Free within the same transaction
            if (mappedStatus === 'cancelled' || mappedStatus === 'unpaid') {
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
                    paymongo_subscription_id: null,
                  },
                  {
                    where: { paymongo_subscription_id: subscriptionId },
                    transaction: t,
                  }
                );
              }
            }
          });
        }
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('handleSubscriptionWebhook error:', error);
    // Return 500 so PayMongo retries on genuine infrastructure/DB failures.
    // Signature rejections (400) are handled before the try block and are not retried.
    res.sendStatus(500);
  }
};
