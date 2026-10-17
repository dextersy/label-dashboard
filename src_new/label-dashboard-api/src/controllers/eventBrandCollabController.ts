import { Request, Response } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { EventBrandCollaboration, Event, Brand, User } from '../models';
import { sendBrandedEmail } from '../utils/emailService';
import { createNotificationsForUsers, getBrandAdminUserIds } from '../utils/notificationService';
import { getBrandFrontendUrl } from '../utils/brandUtils';

interface AuthRequest extends Request {
  user?: any;
}

// ─── List brand collaborators for an event (owner-only) ──────────────────────

export const listBrandCollaborators = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const collabs = await EventBrandCollaboration.findAll({
      where: { event_id: eventId },
      include: [{ model: Brand, as: 'brand', attributes: ['id', 'brand_name', 'logo_url', 'brand_color'] }],
      order: [['createdAt', 'ASC']],
    });

    res.json({ brandCollaborators: collabs });
  } catch (error) {
    console.error('listBrandCollaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Invite a brand as collaborator (owner-only) ─────────────────────────────

export const inviteBrandCollaborator = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { brand_id: brand_id_raw, role } = req.body;
    const brand_id = parseInt(brand_id_raw as string, 10);

    if (!brand_id_raw || !role) {
      return res.status(400).json({ error: 'brand_id and role are required' });
    }
    if (isNaN(brand_id)) {
      return res.status(400).json({ error: 'Invalid brand_id' });
    }
    if (role !== 'viewer' && role !== 'manager') {
      return res.status(400).json({ error: 'Role must be viewer or manager' });
    }
    if (brand_id === req.user.brand_id) {
      return res.status(400).json({ error: 'Cannot invite your own brand' });
    }

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const targetBrand = await Brand.findByPk(brand_id);
    if (!targetBrand) return res.status(404).json({ error: 'Brand not found' });

    const inviteHash = crypto.randomBytes(32).toString('hex');

    const [, created] = await EventBrandCollaboration.findOrCreate({
      where: { event_id: eventId, brand_id },
      defaults: { role, status: 'Pending', invite_hash: inviteHash },
    });

    if (!created) {
      return res.status(409).json({ error: 'This brand is already a collaborator or has a pending invite' });
    }

    const ownerBrand = await Brand.findByPk(req.user.brand_id);
    const roleLabel = role === 'manager' ? 'Manager' : 'Viewer';

    // Get all admins of the target brand to notify
    const adminUsers = await User.findAll({
      where: { brand_id, is_admin: true },
      attributes: ['id', 'email_address'],
    });

    if (adminUsers.length > 0) {
      // Ticketing sub-brands have no domain of their own — use TICKETING_FRONTEND_URL instead of
      // falling back through getBrandFrontendUrl, which would resolve to the wrong app.
      const ticketingParentId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
      const isTicketingBrand = ticketingParentId > 0 && (targetBrand as any).parent_brand === ticketingParentId;
      const frontendUrl = isTicketingBrand
        ? (process.env.TICKETING_FRONTEND_URL || '').replace(/\/$/, '')
        : await getBrandFrontendUrl(brand_id);
      const inviteUrl = `${frontendUrl}/event-brand-collab-invite?hash=${inviteHash}`;

      // Send email to all admins of the target brand
      const adminEmails = adminUsers.map((u: any) => u.email_address).filter(Boolean);
      if (adminEmails.length > 0) {
        await sendBrandedEmail(adminEmails, 'event_brand_collab_invite_email', {
          event_title: event.title,
          role_label: roleLabel,
          inviting_brand_name: ownerBrand?.brand_name || '',
          url: inviteUrl,
          brand_color: ownerBrand?.brand_color || '#1595e7',
          logo: ownerBrand?.logo_url || '',
          brand_name: ownerBrand?.brand_name || '',
        }, req.user.brand_id);
      }

      // In-app notifications for all admins of the target brand
      const adminIds = adminUsers.map((u: any) => u.id as number);
      createNotificationsForUsers(
        adminIds,
        brand_id,
        'event_brand_collab_invite',
        `${ownerBrand?.brand_name || 'A brand'} invited you to collaborate on ${event.title}`,
        `You've been invited as a ${roleLabel}. Click to accept.`,
        `/event-brand-collab-invite?hash=${inviteHash}`
      ).catch(() => {});
    }

    res.status(201).json({ message: 'Brand collaboration invite sent successfully' });
  } catch (error) {
    console.error('inviteBrandCollaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Revoke a brand collaborator (owner-only, or self-removal by collaborator) ─

export const revokeBrandCollaborator = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { brand_id: brand_id_raw } = req.body;
    const brand_id = parseInt(brand_id_raw as string, 10);

    if (!brand_id_raw) return res.status(400).json({ error: 'brand_id is required' });
    if (isNaN(brand_id)) return res.status(400).json({ error: 'Invalid brand_id' });

    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isSelfRemoval = req.user.brand_id === brand_id;
    const isOwner = event.brand_id === req.user.brand_id;

    if (!isSelfRemoval && !isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (isSelfRemoval && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only brand admins can leave a collaboration' });
    }

    if (isSelfRemoval && event.brand_id === brand_id) {
      return res.status(400).json({ error: 'Event owner cannot remove themselves as collaborator' });
    }

    const collab = await EventBrandCollaboration.findOne({ where: { event_id: eventId, brand_id } });
    if (!collab) return res.status(404).json({ error: 'Brand collaborator not found' });

    await collab.destroy();

    res.json({ message: 'Brand collaborator removed' });
  } catch (error) {
    console.error('revokeBrandCollaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Get invite info (public) ─────────────────────────────────────────────────

export const getBrandCollabInviteInfo = async (req: Request, res: Response) => {
  try {
    const hash = req.query.hash as string;
    if (!hash) return res.status(400).json({ error: 'Invite hash is required' });

    const collab = await EventBrandCollaboration.findOne({
      where: { invite_hash: hash },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] },
        { model: Brand, as: 'brand', attributes: ['id', 'brand_name', 'logo_url', 'brand_color'] },
      ],
    });

    if (!collab) return res.status(404).json({ error: 'Invalid or expired invitation' });

    const event = (collab as any).event;
    const ownerBrand = event
      ? await Brand.findByPk(event.brand_id, { attributes: ['brand_name', 'logo_url', 'brand_color'] })
      : null;

    res.json({
      role: collab.role,
      status: collab.status,
      event_title: event?.title,
      collaborator_brand_name: (collab as any).brand?.brand_name,
      owner_brand_name: ownerBrand?.brand_name,
      owner_brand_logo: ownerBrand?.logo_url,
      owner_brand_color: ownerBrand?.brand_color,
    });
  } catch (error) {
    console.error('getBrandCollabInviteInfo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Accept brand collab invite (any admin of the target brand) ───────────────

export const acceptBrandCollabInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Invite hash is required' });

    const collab = await EventBrandCollaboration.findOne({
      where: { invite_hash: hash },
      include: [{ model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] }],
    });

    if (!collab) return res.status(404).json({ error: 'Invalid or expired invitation' });
    if (collab.status === 'Accepted') return res.status(409).json({ error: 'Invitation already accepted' });

    // Verify the accepting user belongs to the invited brand
    if (req.user.brand_id !== collab.brand_id) {
      return res.status(403).json({ error: 'You do not belong to the invited brand' });
    }

    // Only admins of the target brand can accept
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only brand admins can accept collaboration invites' });
    }

    await collab.update({ status: 'Accepted', invite_hash: null });

    const event = (collab as any).event;
    res.json({
      message: 'Collaboration accepted',
      event_id: collab.event_id,
      event_title: event?.title,
      role: collab.role,
    });
  } catch (error) {
    console.error('acceptBrandCollabInvite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Search brands for invite dropdown (authenticated) ────────────────────────

export const searchBrands = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const q = (req.query.q as string || '').trim();

    if (!q || q.length < 2) {
      return res.json({ brands: [] });
    }

    // Find brands already added (or pending) for this event
    const existingCollabs = await EventBrandCollaboration.findAll({
      where: { event_id: eventId },
      attributes: ['brand_id'],
    });
    const excludedIds = [
      req.user.brand_id,
      ...existingCollabs.map((c: any) => c.brand_id),
    ];

    const brands = await Brand.findAll({
      where: {
        id: { [Op.notIn]: excludedIds },
        brand_name: { [Op.iLike]: `%${q}%` },
      },
      attributes: ['id', 'brand_name', 'logo_url'],
      limit: 10,
    });

    res.json({ brands });
  } catch (error) {
    console.error('searchBrands error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Get accepted brand collaborators for an event (public) ──────────────────
// Used by the ticket buy page to display all collaborating brands.

export const getPublicBrandCollaborators = async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

    const collabs = await EventBrandCollaboration.findAll({
      where: { event_id: eventId, status: 'Accepted' },
      include: [{ model: Brand, as: 'brand', attributes: ['id', 'brand_name', 'logo_url'] }],
    });

    const brands = collabs.map((c: any) => c.brand).filter(Boolean);
    res.json({ brands });
  } catch (error) {
    console.error('getPublicBrandCollaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
