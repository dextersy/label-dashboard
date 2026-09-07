import { sequelize } from '../config/database';
import AudienceUser from '../models/AudienceUser';
import AudiencePointTransaction, { PointTransactionType } from '../models/AudiencePointTransaction';
import Ticket from '../models/Ticket';
import { Op } from 'sequelize';

// ─── Card level tiers ─────────────────────────────────────────────────────────

export function getCardLevel(points: number): string {
  if (points >= 700) return 'Platinum';
  if (points >= 300) return 'Gold';
  return 'Silver';
}

// ─── Core award function ──────────────────────────────────────────────────────

/**
 * Awards points to an audience user. Idempotent when reference_id is provided —
 * a duplicate transaction (same user + reference_id + reference_type + type) is
 * silently ignored via the unique constraint. Returns true if points were newly
 * awarded, false if the award was a duplicate.
 */
export async function awardPoints(
  audienceUserId: number,
  type: PointTransactionType,
  points: number,
  referenceId?: number | null,
  referenceType?: string | null,
): Promise<boolean> {
  try {
    // If there is a reference_id, check for an existing transaction first
    // to implement idempotent behavior without relying on DB error handling.
    if (referenceId != null) {
      const existing = await AudiencePointTransaction.findOne({
        where: {
          audience_user_id: audienceUserId,
          type,
          reference_id: referenceId,
          reference_type: referenceType || null,
        },
      });
      if (existing) return false;
    }

    await sequelize.transaction(async (t) => {
      await AudiencePointTransaction.create(
        {
          audience_user_id: audienceUserId,
          type,
          points,
          reference_id: referenceId ?? null,
          reference_type: referenceType ?? null,
        },
        { transaction: t },
      );

      await AudienceUser.update(
        { points_total: sequelize.literal(`points_total + ${points}`) as any },
        { where: { id: audienceUserId }, transaction: t },
      );
    });

    return true;
  } catch (err: any) {
    // Swallow unique-constraint violations (race condition edge case) — return false
    if (err?.name === 'SequelizeUniqueConstraintError') return false;
    console.error('awardPoints error:', err);
    return false;
  }
}

// ─── Ticket points ────────────────────────────────────────────────────────────

/**
 * Awards points for an array of tickets. Each ticket is referenced individually.
 * Paid tickets earn 5 pts; free tickets earn 3 pts.
 */
export async function awardTicketPoints(
  audienceUserId: number,
  tickets: Ticket[],
): Promise<void> {
  for (const ticket of tickets) {
    const pts = Number(ticket.price_per_ticket) > 0 ? 5 : 3;
    await awardPoints(audienceUserId, 'ticket_purchase', pts, ticket.id, 'ticket');
  }
}

/**
 * Retroactively awards points for all of the user's confirmed/sent tickets that
 * have not yet been credited. Safe to call multiple times.
 */
export async function awardRetroactiveTicketPoints(audienceUserId: number): Promise<void> {
  try {
    const tickets = await Ticket.findAll({
      where: {
        audience_user_id: audienceUserId,
        status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.'] },
      },
      attributes: ['id', 'price_per_ticket'],
    });

    if (tickets.length === 0) return;

    // Find which ticket IDs already have a transaction
    const existingTransactions = await AudiencePointTransaction.findAll({
      where: {
        audience_user_id: audienceUserId,
        type: 'ticket_purchase',
        reference_type: 'ticket',
        reference_id: { [Op.in]: tickets.map((t) => t.id) },
      },
      attributes: ['reference_id'],
    });

    const credited = new Set(existingTransactions.map((tx) => tx.reference_id));

    for (const ticket of tickets) {
      if (!credited.has(ticket.id)) {
        const pts = Number(ticket.price_per_ticket) > 0 ? 5 : 3;
        await awardPoints(audienceUserId, 'ticket_purchase', pts, ticket.id, 'ticket');
      }
    }
  } catch (err) {
    console.error('awardRetroactiveTicketPoints error:', err);
  }
}

// ─── Share points ─────────────────────────────────────────────────────────────

/**
 * Awards +2 points for sharing an event. Once per user per event.
 * Returns true if points were newly awarded.
 */
export async function awardSharePoints(
  audienceUserId: number,
  eventId: number,
): Promise<boolean> {
  return awardPoints(audienceUserId, 'event_share', 2, eventId, 'event');
}

// ─── Profile completion points ────────────────────────────────────────────────

/**
 * Returns true if all 6 extended profile fields are filled in.
 */
export function isProfileComplete(user: {
  city?: string | null;
  country?: string | null;
  date_of_birth?: Date | null;
  gender_identity?: string | null;
  music_genres?: string[] | null;
  event_frequency?: string | null;
}): boolean {
  return !!(
    user.city &&
    user.country &&
    user.date_of_birth &&
    user.gender_identity &&
    user.music_genres && user.music_genres.length > 0 &&
    user.event_frequency
  );
}

/**
 * Awards +10 points for completing the extended profile. Idempotent — uses the
 * user's own id as reference_id with type 'profile' so it can only fire once.
 * Returns true if points were newly awarded.
 */
export async function awardProfileCompletePoints(audienceUserId: number): Promise<boolean> {
  return awardPoints(audienceUserId, 'profile_complete', 10, audienceUserId, 'profile');
}

// ─── Referral points ──────────────────────────────────────────────────────────

/**
 * Awards +10 points to the referrer when a referred user verifies their email.
 * referredUserId is used as the reference_id to prevent double-awarding.
 */
export async function awardReferralPoints(
  referrerUserId: number,
  referredUserId: number,
): Promise<void> {
  await awardPoints(referrerUserId, 'referral', 10, referredUserId, 'audience_user');
}
