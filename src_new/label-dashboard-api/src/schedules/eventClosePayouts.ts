/**
 * Event-close payout scheduler
 *
 * When a brand has `payout_on_event_close = true`, a payout is triggered
 * automatically when the event's close_time (or date_and_time) passes.
 *
 * Uses Node.js setTimeout — no external scheduler dependencies.
 * On server restart, rehydrateEventCloseSchedules() re-queues all pending events.
 */

import { Op, literal } from 'sequelize';
import { Brand, Event, Earning, Ticket, LabelPayment, LabelPaymentMethod, Release, Royalty, EventAddOnPayment, User } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendEmail } from '../utils/emailService';

interface PendingPayout {
  handle: NodeJS.Timeout;
  brandId: number;
  fireAtMs: number;
}

// Map from eventId → pending payout info
const pendingPayouts = new Map<number, PendingPayout>();

async function notifyAdminsInsufficientBalance(
  sublabelId: number,
  sublabelName: string,
  eventId: number,
  balance: number,
  reason: string
): Promise<void> {
  try {
    const admins = await User.findAll({
      where: { brand_id: sublabelId, is_admin: true },
      attributes: ['email']
    });
    const emails = admins.map((u: any) => u.email).filter(Boolean);
    if (emails.length === 0) return;

    const balanceFormatted = balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subject = `Payout skipped for event #${eventId} — ${sublabelName}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f3f4f6;">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" style="max-width:560px;margin:0 auto;background-color:#fff;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="padding:24px 32px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:8px 8px 0 0;">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">⚠️ Event-Close Payout Skipped</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">
              The automatic payout triggered by event <strong>#${eventId}</strong> for <strong>${sublabelName}</strong> was skipped.
            </p>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:6px;margin-bottom:20px;">
              <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">Reason</p>
              <p style="margin:6px 0 0 0;color:#b45309;font-size:14px;">${reason}</p>
            </div>
            <table role="presentation" style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden;">
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Current Balance</td>
                <td style="padding:12px 16px;font-size:18px;font-weight:700;color:#111827;text-align:right;border-bottom:1px solid #e5e7eb;">₱${balanceFormatted}</td>
              </tr>
            </table>
            <p style="margin:20px 0 0 0;color:#6b7280;font-size:13px;">
              Please review your payout settings in the dashboard to ensure future payouts are processed correctly.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f9fafb;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              This is an automated notification from the payout system.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(emails, subject, html, sublabelId);
    console.log(`[eventClosePayouts] Insufficient-balance email sent to ${emails.join(', ')} for sublabel ${sublabelId}`);
  } catch (err) {
    console.error(`[eventClosePayouts] Failed to send insufficient-balance email for sublabel ${sublabelId}:`, err);
  }
}

// Max delay for setTimeout (~24 days). Events further out will be re-hydrated on the next restart.
const MAX_TIMEOUT_MS = 24 * 24 * 60 * 60 * 1000;

async function triggerEventClosePayout(eventId: number, brandId: number): Promise<void> {
  pendingPayouts.delete(eventId);
  console.log(`[eventClosePayouts] ⏰ Timer fired for event ${eventId} (brand ${brandId}) at ${new Date().toISOString()}`);

  try {
    const sublabel = await Brand.findOne({
      where: { id: brandId, parent_brand: { [Op.not]: null }, payout_on_event_close: true },
      include: [{ model: Brand, as: 'parentBrand', required: true }]
    });

    if (!sublabel || !sublabel.parentBrand) {
      console.log(`[eventClosePayouts] Sublabel ${brandId} not found or no longer eligible — skipping.`);
      return;
    }

    const parentBrand = sublabel.parentBrand;

    if (!parentBrand.paymongo_wallet_id) {
      console.log(`[eventClosePayouts] Parent brand ${parentBrand.id} has no Paymongo wallet — skipping.`);
      return;
    }

    // Calculate balance
    const payments = await LabelPayment.sum('amount', {
      where: { brand_id: sublabel.id, status: 'succeeded' }
    }) || 0;

    const releaseIds = (await Release.findAll({
      where: { brand_id: sublabel.id },
      attributes: ['id'],
      raw: true
    })).map((r: any) => r.id);

    let musicEarnings = 0;
    if (releaseIds.length > 0) {
      const totalEarnings = await Earning.sum('amount', { where: { release_id: { [Op.in]: releaseIds } } }) || 0;
      const totalRoyalties = await Royalty.sum('amount', { where: { release_id: { [Op.in]: releaseIds } } }) || 0;
      const totalPlatformFees = await Earning.sum('platform_fee', { where: { release_id: { [Op.in]: releaseIds } } }) || 0;
      musicEarnings = totalEarnings - totalRoyalties - totalPlatformFees;
    }

    const eventSalesQuery = await Ticket.findAll({
      attributes: [[literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales']],
      include: [{ model: Event, as: 'event', where: { brand_id: sublabel.id }, attributes: [] }],
      where: { status: ['Payment Confirmed', 'Ticket sent.'], platform_fee: { [Op.not]: null } },
      raw: true
    });
    const eventFeesQuery = await Ticket.findAll({
      attributes: [[literal('SUM(platform_fee)'), 'total_platform_fee']],
      include: [{ model: Event, as: 'event', where: { brand_id: sublabel.id }, attributes: [] }],
      where: { status: ['Payment Confirmed', 'Ticket sent.', 'Refunded'], platform_fee: { [Op.not]: null } },
      raw: true
    });

    const eventSales = parseFloat((eventSalesQuery[0] as any)?.total_sales) || 0;
    const eventPlatformFees = parseFloat((eventFeesQuery[0] as any)?.total_platform_fee) || 0;
    const eventEarnings = eventSales - eventPlatformFees;

    const eventIds = (await Event.findAll({ where: { brand_id: sublabel.id }, attributes: ['id'], raw: true })).map((e: any) => e.id);
    const totalAddOnBalancePayments = eventIds.length > 0
      ? await EventAddOnPayment.sum('amount', { where: { event_id: { [Op.in]: eventIds }, method: 'balance', status: 'succeeded' } }) || 0
      : 0;

    const balance = parseFloat((musicEarnings + eventEarnings - payments - totalAddOnBalancePayments).toFixed(2));

    if (balance <= 0) {
      const reason = `Balance is ₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} — nothing to pay out.`;
      console.log(`[eventClosePayouts] Sublabel ${sublabel.id} has no positive balance (${balance}) — skipping.`);
      await notifyAdminsInsufficientBalance(sublabel.id, sublabel.brand_name, eventId, balance, reason);
      return;
    }

    const threshold = sublabel.payout_threshold ?? 0;
    if (threshold > 0 && balance < threshold) {
      const reason = `Balance ₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} is below the configured minimum threshold of ₱${threshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`;
      console.log(`[eventClosePayouts] Sublabel ${sublabel.id} balance ${balance} below threshold ${threshold} — skipping.`);
      await notifyAdminsInsufficientBalance(sublabel.id, sublabel.brand_name, eventId, balance, reason);
      return;
    }

    // Check for existing pending payment
    const existingPending = await LabelPayment.findOne({ where: { brand_id: sublabel.id, status: 'pending' } });
    if (existingPending) {
      console.log(`[eventClosePayouts] Sublabel ${sublabel.id} has pending payment — skipping.`);
      return;
    }

    const paymentMethod = await LabelPaymentMethod.findOne({ where: { brand_id: sublabel.id, is_default_for_brand: true } })
      || await LabelPaymentMethod.findOne({ where: { brand_id: sublabel.id } });

    if (!paymentMethod) {
      console.log(`[eventClosePayouts] Sublabel ${sublabel.id} has no payment method — skipping.`);
      return;
    }

    const processingFee = parentBrand.payment_processing_fee_for_payouts || 0;
    const transferAmount = parseFloat((balance - processingFee).toFixed(2));

    if (transferAmount <= 0) {
      console.log(`[eventClosePayouts] Transfer amount after fee is non-positive for sublabel ${sublabel.id} — skipping.`);
      return;
    }

    const paymentService = new PaymentService();
    const callbackUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/public/webhook/transfer`;
    const description = `Automated payout (event close) - ${sublabel.brand_name}`;

    const transferResult = await paymentService.sendMoneyTransfer(
      parentBrand.id,
      paymentMethod.id,
      transferAmount,
      description,
      true,
      callbackUrl
    );

    if (!transferResult) {
      console.error(`[eventClosePayouts] Transfer failed for sublabel ${sublabel.id}`);
      return;
    }

    const payment = await LabelPayment.create({
      brand_id: sublabel.id,
      amount: balance,
      description,
      date_paid: new Date(),
      reference_number: transferResult.referenceNumber,
      payment_processing_fee: processingFee,
      status: 'pending',
      paymongo_transfer_id: transferResult.transferId,
      payment_method_id: paymentMethod.id
    });

    // Notification is sent by the Paymongo webhook (updateLabelPaymentStatus)
    // when the transfer actually settles — do not send here.

    console.log(`[eventClosePayouts] ✅ Payout created for sublabel ${sublabel.id} (event ${eventId}): ₱${balance} → transfer ₱${transferAmount} (fee ₱${processingFee}), payment id=${payment.id}`);
  } catch (err) {
    console.error(`[eventClosePayouts] ❌ Error triggering payout for event ${eventId}:`, err);
  }
}

export function scheduleEventClosePayout(eventId: number, brandId: number, closeTime: Date): void {
  // Cancel any existing timeout for this specific event
  const existing = pendingPayouts.get(eventId);
  if (existing) {
    clearTimeout(existing.handle);
    pendingPayouts.delete(eventId);
    console.log(`[eventClosePayouts] Replaced existing timer for event ${eventId}`);
  }

  const now = Date.now();
  const delay = closeTime.getTime() - now;

  if (delay <= 0) {
    // Already passed — do nothing (would have been handled on close)
    console.log(`[eventClosePayouts] Event ${eventId} close_time ${closeTime.toISOString()} is already past — not scheduling`);
    return;
  }

  if (delay > MAX_TIMEOUT_MS) {
    // Too far out — will be re-hydrated on next restart
    const daysOut = (delay / (24 * 60 * 60 * 1000)).toFixed(1);
    console.log(`[eventClosePayouts] Event ${eventId} close_time ${closeTime.toISOString()} is ${daysOut} days out — too far for setTimeout, will re-hydrate on next restart`);
    return;
  }

  const fireAtMs = now + delay;

  // Check if another event for the same brand already has a timer at the same time (within 1s tolerance).
  // Two events for the same brand closing simultaneously only need one payout run.
  for (const [otherEventId, pending] of pendingPayouts) {
    if (pending.brandId === brandId && Math.abs(pending.fireAtMs - fireAtMs) <= 1000) {
      console.log(`[eventClosePayouts] Event ${eventId} skipped — brand ${brandId} already has a timer at ${new Date(pending.fireAtMs).toISOString()} (event ${otherEventId})`);
      return;
    }
  }

  const fireAt = new Date(fireAtMs);
  const handle = setTimeout(() => triggerEventClosePayout(eventId, brandId), delay);
  pendingPayouts.set(eventId, { handle, brandId, fireAtMs });
  console.log(`[eventClosePayouts] ✅ Scheduled event ${eventId} (brand ${brandId}) — fires at ${fireAt.toISOString()} (in ${Math.round(delay / 1000)}s / ${(delay / 60000).toFixed(1)}min)`);
}

export function cancelEventClosePayout(eventId: number): void {
  const existing = pendingPayouts.get(eventId);
  if (existing) {
    clearTimeout(existing.handle);
    pendingPayouts.delete(eventId);
    console.log(`[eventClosePayouts] ❌ Cancelled timer for event ${eventId}`);
  }
  // No-op if not scheduled — intentionally silent
}

export async function rehydrateEventCloseSchedules(): Promise<void> {
  console.log('[eventClosePayouts] Starting rehydration of event-close payout schedules...');
  try {
    const now = new Date();

    // Find all brands with payout_on_event_close = true
    const eligibleBrands = await Brand.findAll({
      where: { payout_on_event_close: true, parent_brand: { [Op.not]: null } },
      attributes: ['id']
    });

    if (eligibleBrands.length === 0) {
      console.log('[eventClosePayouts] No brands with payout_on_event_close=true — nothing to rehydrate');
      return;
    }

    const brandIds = eligibleBrands.map(b => b.id);
    console.log(`[eventClosePayouts] Found ${brandIds.length} brand(s) with payout_on_event_close=true: [${brandIds.join(', ')}]`);

    // Find all future events for these brands
    const events = await Event.findAll({
      where: {
        brand_id: { [Op.in]: brandIds },
        [Op.or]: [
          { close_time: { [Op.gt]: now } },
          { date_and_time: { [Op.gt]: now } }
        ]
      },
      attributes: ['id', 'brand_id', 'close_time', 'date_and_time']
    });

    console.log(`[eventClosePayouts] Found ${events.length} future event(s) to rehydrate`);

    let scheduled = 0;
    let skipped = 0;
    for (const event of events) {
      const closeTime = event.close_time ? new Date(event.close_time) : new Date(event.date_and_time);
      if (closeTime > now) {
        scheduleEventClosePayout(event.id, event.brand_id, closeTime);
        scheduled++;
      } else {
        console.log(`[eventClosePayouts] Skipping event ${event.id} — close_time ${closeTime.toISOString()} is in the past`);
        skipped++;
      }
    }

    console.log(`[eventClosePayouts] Rehydration complete: ${scheduled} scheduled, ${skipped} skipped (past)`);
  } catch (err) {
    console.error('[eventClosePayouts] Error during rehydration:', err);
  }
}

// Re-hydrate every 12 hours so events that were previously beyond MAX_TIMEOUT_MS
// (~24 days) get scheduled without requiring a server restart.
const REHYDRATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startPeriodicRehydration(): void {
  setInterval(() => {
    console.log('[eventClosePayouts] Running periodic rehydration...');
    rehydrateEventCloseSchedules().catch(err =>
      console.error('[eventClosePayouts] Periodic rehydration error:', err)
    );
  }, REHYDRATION_INTERVAL_MS);
  console.log(`[eventClosePayouts] Periodic rehydration scheduled every ${REHYDRATION_INTERVAL_MS / 3600000}h`);
}
