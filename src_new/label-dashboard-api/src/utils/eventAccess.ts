import { Request } from 'express';
import { Event, EventAccess, EventBrandCollaboration } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Resolve the effective role a user has on an event.
 * Returns 'owner' | 'manager' | 'viewer', or null if no access.
 *
 * Priority:
 *  1. Brand owns the event + user is admin → 'owner'
 *  2. User-level EventAccess (accepted) → that role
 *  3. Brand-level EventBrandCollaboration (accepted) → that role
 */
export const resolveEventRole = async (
  req: AuthRequest,
  eventId: number,
): Promise<'owner' | 'manager' | 'viewer' | null> => {
  const ownerEvent = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
  if (ownerEvent && req.user.is_admin) return 'owner';
  // Non-admin users whose brand owns the event still need an explicit EventAccess row —
  // fall through to the user-level and brand-level checks below.

  const userAccess = await EventAccess.findOne({
    where: { event_id: eventId, user_id: req.user.id, status: 'Accepted' },
  });
  if (userAccess) return (userAccess as any).role as 'manager' | 'viewer';

  // Priority 3: Brand-level EventBrandCollaboration — only applies to admins of the collab brand.
  // Non-admin users of a collab brand must be individually invited via EventAccess.
  if (req.user.is_admin) {
    const brandAccess = await EventBrandCollaboration.findOne({
      where: { event_id: eventId, brand_id: req.user.brand_id, status: 'Accepted' },
    });
    if (brandAccess) return (brandAccess as any).role as 'manager' | 'viewer';
  }

  return null;
};

/**
 * Find an event the user can access (owned, user-level EventAccess, or brand-collab).
 * Mirrors the priority order of resolveEventRole.
 * Returns the event or null. Pass `include` for eager loads.
 */
export const findEventForUser = async (
  req: AuthRequest,
  eventId: number,
  include?: any[],
): Promise<any | null> => {
  const brandId: number = req.user.brand_id;
  const userId: number = req.user.id;
  const opts = include ? { include } : {};

  // Priority 1: Brand owns the event (admin users only — non-admins fall through to EventAccess check)
  const owned = await Event.findOne({ where: { id: eventId, brand_id: brandId }, ...opts });
  if (owned && req.user.is_admin) return owned;

  // Priority 2: User-level EventAccess
  const userAccess = await EventAccess.findOne({ where: { event_id: eventId, user_id: userId, status: 'Accepted' } });
  if (userAccess) return Event.findOne({ where: { id: eventId }, ...opts });

  // Priority 3: Brand-level EventBrandCollaboration — only for admins of the collab brand
  if (req.user.is_admin) {
    const collab = await EventBrandCollaboration.findOne({ where: { event_id: eventId, brand_id: brandId, status: 'Accepted' } });
    if (collab) return Event.findOne({ where: { id: eventId }, ...opts });
  }

  return null;
};
