import axios from 'axios';
import { Transaction, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import Plan from '../models/Plan';
import BrandPlan from '../models/BrandPlan';
import Brand from '../models/Brand';
import User from '../models/User';

// ---------------------------------------------------------------------------
// PayPal OAuth2 token cache
// ---------------------------------------------------------------------------

let _cachedToken: { token: string; expiresAt: number } | null = null;

function paypalBaseUrl(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token;
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured');
  }

  const response = await axios.post(
    `${paypalBaseUrl()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    }
  );

  const { access_token, expires_in } = response.data;
  _cachedToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in as number) * 1000,
  };
  return access_token;
}

async function paypalClient() {
  const token = await getPayPalAccessToken();
  return axios.create({
    baseURL: paypalBaseUrl(),
    timeout: 15_000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// ---------------------------------------------------------------------------
// PayPal Billing Plan (reusable billing template)
// ---------------------------------------------------------------------------

async function createPayPalBillingPlan(params: {
  name: string;
  amount: number;
  interval: 'MONTH' | 'YEAR';
  intervalCount: number;
}): Promise<string> {
  const productId = process.env.PAYPAL_PRODUCT_ID;
  if (!productId) throw new Error('PAYPAL_PRODUCT_ID is not configured');

  const currency = process.env.PAYPAL_CURRENCY || 'PHP';
  const client = await paypalClient();

  const response = await client.post('/v1/billing/plans', {
    product_id: productId,
    name: params.name,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: {
          interval_unit: params.interval,
          interval_count: params.intervalCount,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 = never expires (ongoing subscription)
        pricing_scheme: {
          fixed_price: {
            value: params.amount.toFixed(2),
            currency_code: currency,
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  });

  return response.data.id as string;
}

/**
 * Ensures the PayPal billing plan exists for the given billing cycle.
 * Creates it on first use and persists the ID back to the plan row.
 *
 * Uses SELECT FOR UPDATE to prevent concurrent checkouts for the same plan from
 * creating duplicate PayPal billing plan objects.
 */
export async function syncPlanToPayPal(
  plan: Plan,
  billingCycle: 'monthly' | 'annual'
): Promise<string> {
  // Phase 1: read under lock — short transaction, no external calls.
  const existing = await sequelize.transaction(async (t: Transaction) => {
    const lockedPlan = await Plan.findByPk(plan.id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!lockedPlan) throw new Error(`Plan ${plan.id} not found`);

    const existingId =
      billingCycle === 'monthly'
        ? lockedPlan.paypal_plan_id_monthly
        : lockedPlan.paypal_plan_id_annual;

    if (existingId) return { done: true as const, id: existingId };

    return {
      done: false as const,
      name: lockedPlan.name,
      amount:
        billingCycle === 'monthly'
          ? lockedPlan.price_monthly
          : lockedPlan.price_annual,
    };
  });

  if (existing.done) return existing.id;

  // Phase 2: call PayPal outside any transaction — lock is released.
  const label = billingCycle === 'monthly' ? 'Monthly' : 'Annual';
  const paypalPlanId = await createPayPalBillingPlan({
    name: `${existing.name} (${label})`,
    amount: existing.amount,
    interval: billingCycle === 'monthly' ? 'MONTH' : 'YEAR',
    intervalCount: 1,
  });

  // Phase 3: write the new ID back under a fresh lock. Re-check first in case a
  // concurrent caller already wrote it while we were waiting on PayPal.
  return sequelize.transaction(async (t: Transaction) => {
    const lockedPlan = await Plan.findByPk(plan.id, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!lockedPlan) throw new Error(`Plan ${plan.id} not found`);

    const raceId =
      billingCycle === 'monthly'
        ? lockedPlan.paypal_plan_id_monthly
        : lockedPlan.paypal_plan_id_annual;

    if (raceId) {
      // Another caller beat us — use their ID (paypalPlanId is an orphan but harmless)
      return raceId;
    }

    if (billingCycle === 'monthly') {
      lockedPlan.paypal_plan_id_monthly = paypalPlanId;
    } else {
      lockedPlan.paypal_plan_id_annual = paypalPlanId;
    }
    await lockedPlan.save({ transaction: t });
    return paypalPlanId;
  });
}

// ---------------------------------------------------------------------------
// PayPal Subscription
// ---------------------------------------------------------------------------

export async function createPayPalSubscription(params: {
  planId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const client = await paypalClient();
  const response = await client.post('/v1/billing/subscriptions', {
    plan_id: params.planId,
    application_context: {
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      landing_page: 'BILLING',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  });

  const subscription = response.data;
  const approvalLink = (subscription.links as any[]).find((l: any) => l.rel === 'approve');
  if (!approvalLink) {
    throw new Error('PayPal subscription approval URL not found in response');
  }

  return {
    subscriptionId: subscription.id as string,
    approvalUrl: approvalLink.href as string,
  };
}

export async function cancelPayPalSubscription(subscriptionId: string): Promise<void> {
  const client = await paypalClient();
  await client.post(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    reason: 'Cancelled by user',
  });
}

// ---------------------------------------------------------------------------
// PayPal Webhook Signature Verification
// ---------------------------------------------------------------------------

export async function verifyPayPalWebhook(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookEvent: any;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('PAYPAL_WEBHOOK_ID not set — skipping webhook signature verification');
    return true;
  }

  try {
    const client = await paypalClient();
    const response = await client.post('/v1/notifications/verify-webhook-signature', {
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: webhookId,
      webhook_event: params.webhookEvent,
    });
    return response.data.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('PayPal webhook verification request failed:', err);
    return false;
  }
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

/**
 * Returns the total storage used (in bytes) by a brand across all tracked models.
 *
 * Tracked models (per product decision):
 *   ArtistImage, ArtistDocument, Release.cover_art,
 *   Song (audio_file + audio_file_mp3), PressCampaign (cover_art + mp3_file),
 *   PressCampaignArtistPhoto
 */
export async function getStorageUsedBytesForBrand(brandId: number): Promise<number> {
  const [result]: any[] = await sequelize.query(
    `
    SELECT COALESCE(SUM(bytes), 0)::BIGINT AS total_bytes
    FROM (
      -- Artist images (via artist.brand_id)
      SELECT COALESCE(ai.file_size, 0) AS bytes
      FROM artist_image ai
      JOIN artist a ON a.id = ai.artist_id
      WHERE a.brand_id = :brandId AND ai.file_size IS NOT NULL

      UNION ALL

      -- Artist documents (via artist.brand_id)
      SELECT COALESCE(ad.file_size, 0) AS bytes
      FROM artist_documents ad
      JOIN artist a ON a.id = ad.artist_id
      WHERE a.brand_id = :brandId AND ad.file_size IS NOT NULL

      UNION ALL

      -- Release cover art
      SELECT COALESCE(cover_art_file_size, 0) AS bytes
      FROM release
      WHERE brand_id = :brandId AND cover_art_file_size IS NOT NULL

      UNION ALL

      -- Song audio files
      SELECT COALESCE(audio_file_size, 0) + COALESCE(audio_file_mp3_size, 0) AS bytes
      FROM song
      WHERE brand_id = :brandId
        AND (audio_file_size IS NOT NULL OR audio_file_mp3_size IS NOT NULL)

      UNION ALL

      -- Press campaign cover art and mp3
      SELECT COALESCE(cover_art_file_size, 0) + COALESCE(mp3_file_size, 0) AS bytes
      FROM press_campaign
      WHERE brand_id = :brandId
        AND (cover_art_file_size IS NOT NULL OR mp3_file_size IS NOT NULL)

      UNION ALL

      -- Press campaign artist photos (via press_campaign.brand_id)
      SELECT COALESCE(pcap.file_size, 0) AS bytes
      FROM press_campaign_artist_photo pcap
      JOIN press_campaign pc ON pc.id = pcap.campaign_id
      WHERE pc.brand_id = :brandId AND pcap.file_size IS NOT NULL
    ) AS storage_rows
    `,
    {
      replacements: { brandId },
      type: QueryTypes.SELECT,
    }
  );
  return Number(result?.total_bytes ?? 0);
}

/**
 * Checks whether adding additionalBytes to a brand's storage would exceed its plan limit.
 * Returns the limit in bytes (null = unlimited), and whether the action is blocked.
 */
export async function checkStorageLimitForBrand(
  brandId: number,
  additionalBytes: number
): Promise<{ allowed: boolean; usedBytes: number; limitBytes: number | null }> {
  const limits = await getEffectiveLimitsForBrand(brandId);
  const limitGb = limits?.limit_storage_gb ?? null;
  const limitBytes = limitGb !== null ? Math.round(limitGb * 1024 * 1024 * 1024) : null;
  const usedBytes = await getStorageUsedBytesForBrand(brandId);
  const allowed = limitBytes === null || usedBytes + additionalBytes <= limitBytes;
  return { allowed, usedBytes, limitBytes };
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
