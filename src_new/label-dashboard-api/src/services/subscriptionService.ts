import axios from 'axios';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
import Brand from '../models/Brand';
import User from '../models/User';

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';
const PAYMONGO_TIMEOUT_MS = 15_000;

function paymongoClient() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not configured');
  return axios.create({
    baseURL: PAYMONGO_BASE_URL,
    timeout: PAYMONGO_TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });
}

// ---------------------------------------------------------------------------
// PayMongo Customer
// ---------------------------------------------------------------------------

export async function createPayMongoCustomer(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<string> {
  try {
    const response = await paymongoClient().post('/customers', {
      data: {
        attributes: {
          email: params.email,
          first_name: params.firstName || undefined,
          last_name: params.lastName || undefined,
          phone: params.phone || undefined,
          default_device: 'email',
        },
      },
    });
    return response.data.data.id as string;
  } catch (err: any) {
    const paymongoErrors = err?.response?.data?.errors;
    console.error('PayMongo createCustomer failed:', JSON.stringify(paymongoErrors, null, 2));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// PayMongo Plan (reusable billing template)
// ---------------------------------------------------------------------------

async function createPayMongoPlan(params: {
  name: string;
  amountCentavos: number;
  interval: 'month' | 'year';
  intervalCount: number;
}): Promise<string> {
  const response = await paymongoClient().post('/plans', {
    data: {
      attributes: {
        name: params.name,
        amount: params.amountCentavos,
        currency: 'PHP',
        interval: params.interval,
        interval_count: params.intervalCount,
      },
    },
  });
  return response.data.data.id as string;
}

/**
 * Ensures the PayMongo plan exists for the given billing cycle.
 * Creates it on first use and persists the ID back to the plan row.
 *
 * Uses SELECT FOR UPDATE to prevent concurrent checkouts for the same plan from
 * creating duplicate PayMongo plan objects (orphaned billing templates).
 */
export async function syncPlanToPayMongo(
  plan: Plan,
  billingCycle: 'monthly' | 'annual'
): Promise<string> {
  // Phase 1: read under lock — short transaction, no external calls.
  // Returns the existing PayMongo plan ID if already created, or the plan
  // data needed to create one.
  const existing = await sequelize.transaction(async (t: Transaction) => {
    const lockedPlan = await Plan.findByPk(plan.id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!lockedPlan) throw new Error(`Plan ${plan.id} not found`);

    const existingId =
      billingCycle === 'monthly'
        ? lockedPlan.paymongo_plan_id_monthly
        : lockedPlan.paymongo_plan_id_annual;

    if (existingId) return { done: true as const, id: existingId };

    return {
      done: false as const,
      name: lockedPlan.name,
      amountCentavos:
        billingCycle === 'monthly'
          ? Math.round(lockedPlan.price_monthly * 100)
          : Math.round(lockedPlan.price_annual * 100),
    };
  });

  if (existing.done) return existing.id;

  // Phase 2: call PayMongo outside any transaction — lock is released.
  const label = billingCycle === 'monthly' ? 'Monthly' : 'Annual';
  const paymongoId = await createPayMongoPlan({
    name: `${existing.name} (${label})`,
    amountCentavos: existing.amountCentavos,
    interval: billingCycle === 'monthly' ? 'month' : 'year',
    intervalCount: 1,
  });

  // Phase 3: write the new ID back under a fresh lock. Re-check first in case a
  // concurrent caller already wrote it while we were waiting on PayMongo.
  return sequelize.transaction(async (t: Transaction) => {
    const lockedPlan = await Plan.findByPk(plan.id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!lockedPlan) throw new Error(`Plan ${plan.id} not found`);

    const raceId =
      billingCycle === 'monthly'
        ? lockedPlan.paymongo_plan_id_monthly
        : lockedPlan.paymongo_plan_id_annual;

    if (raceId) {
      // Another caller beat us — use their ID (paymongoId is an orphan but harmless)
      return raceId;
    }

    if (billingCycle === 'monthly') {
      lockedPlan.paymongo_plan_id_monthly = paymongoId;
    } else {
      lockedPlan.paymongo_plan_id_annual = paymongoId;
    }
    await lockedPlan.save({ transaction: t });
    return paymongoId;
  });
}

// ---------------------------------------------------------------------------
// PayMongo Subscription
// ---------------------------------------------------------------------------

export async function createPayMongoSubscription(params: {
  customerId: string;
  planId: string;
  returnUrl: string;
}): Promise<{ subscriptionId: string; checkoutUrl: string }> {
  const response = await paymongoClient().post('/subscriptions', {
    data: {
      attributes: {
        customer_id: params.customerId,
        plan_id: params.planId,
        return_url: params.returnUrl,
      },
    },
  });
  const attrs = response.data.data.attributes;
  return {
    subscriptionId: response.data.data.id as string,
    checkoutUrl: attrs.latest_invoice?.attributes?.hosted_url as string,
  };
}

export async function cancelPayMongoSubscription(subscriptionId: string): Promise<void> {
  await paymongoClient().post(`/subscriptions/${subscriptionId}/cancel`, {
    data: { attributes: { cancellation_reason: 'other' } },
  });
}

// ---------------------------------------------------------------------------
// Effective limits resolver
// Resolves the actual limit a brand should see, applying overrides over plan defaults.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fetch effective limits for a brand by ID (used by controllers for enforcement)
// ---------------------------------------------------------------------------

export async function getEffectiveLimitsForBrand(brandId: number) {
  const brandPlan = await BrandPlan.findOne({
    where: { brand_id: brandId },
    include: [{ model: Plan, as: 'plan' }],
    order: [['createdAt', 'DESC']],
  });
  if (!brandPlan || !brandPlan.plan) return null;
  return resolveEffectiveLimits(brandPlan.plan, brandPlan);
}

export function resolveEffectiveLimits(plan: Plan, brandPlan: BrandPlan) {
  return {
    limit_artists:
      brandPlan.override_limit_artists !== undefined && brandPlan.override_limit_artists !== null
        ? brandPlan.override_limit_artists
        : plan.limit_artists,
    limit_releases_per_artist:
      brandPlan.override_limit_releases_per_artist !== undefined && brandPlan.override_limit_releases_per_artist !== null
        ? brandPlan.override_limit_releases_per_artist
        : plan.limit_releases_per_artist,
    limit_press_campaigns_per_month:
      brandPlan.override_limit_press_campaigns_per_month !== undefined && brandPlan.override_limit_press_campaigns_per_month !== null
        ? brandPlan.override_limit_press_campaigns_per_month
        : plan.limit_press_campaigns_per_month,
    limit_sync_pitches_per_month:
      brandPlan.override_limit_sync_pitches_per_month !== undefined && brandPlan.override_limit_sync_pitches_per_month !== null
        ? brandPlan.override_limit_sync_pitches_per_month
        : plan.limit_sync_pitches_per_month,
    limit_storage_gb:
      brandPlan.override_limit_storage_gb !== undefined && brandPlan.override_limit_storage_gb !== null
        ? brandPlan.override_limit_storage_gb
        : plan.limit_storage_gb,
    limit_admin_users:
      brandPlan.override_limit_admin_users !== undefined && brandPlan.override_limit_admin_users !== null
        ? brandPlan.override_limit_admin_users
        : plan.limit_admin_users,
  };
}
