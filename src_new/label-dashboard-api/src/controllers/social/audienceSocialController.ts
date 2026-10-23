import { Request, Response } from 'express';
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import AudienceConnection, { ConnectionStatus } from '../../models/AudienceConnection';
import AudienceNotification from '../../models/AudienceNotification';
import AudienceUser from '../../models/AudienceUser';
import { AudienceEmailPreference } from '../../models';
import Ticket from '../../models/Ticket';
import { awardPoints } from '../../utils/audiencePoints';

// ─── Email helpers ────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function getAudienceFrontendUrl(): string {
  return process.env.TICKETING_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:4201';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendConnectionEmail(
  recipientId: number,
  actorName: string,
  type: 'request' | 'accepted',
): Promise<void> {
  const recipient = await AudienceUser.findByPk(recipientId, {
    attributes: ['id', 'email_address', 'first_name'],
  });
  if (!recipient) return;

  const [pref] = await AudienceEmailPreference.findOrCreate({
    where: { audience_user_id: recipientId },
    defaults: { audience_user_id: recipientId, marketing_promos: true, event_recommendations: true, organizer_updates: true, points_rewards: true, connection_emails: true },
  });
  if (!pref.connection_emails) return;

  const safeActorName = escapeHtml(actorName);
  const safeFirstName = escapeHtml(recipient.first_name || 'there');
  const platformName = process.env.PLATFORM_NAME || 'Your Scene';
  const logoUrl = `${process.env.AUDIENCE_APP_URL || ''}/assets/logo-dark-bg.png`;
  const connectionsUrl = `${getAudienceFrontendUrl()}/my-connections`;
  const prefsUrl = `${getAudienceFrontendUrl()}/my-email-preferences`;

  const templatePath = path.join(__dirname, '../../assets/templates/audience_connection_email.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const subject = type === 'request'
    ? `${safeActorName} wants to connect with you on ${platformName}`
    : `${safeActorName} accepted your connection request`;

  html = html
    .replace(/%PLATFORM_NAME%/g, platformName)
    .replace(/%LOGO_URL%/g, logoUrl)
    .replace(/%FIRST_NAME%/g, safeFirstName)
    .replace(/%HEADLINE%/g, type === 'request' ? `${safeActorName} wants to connect` : `You're now connected with ${safeActorName}!`)
    .replace(/%BODY_TEXT%/g, type === 'request' ? 'Head to your connections page to accept or decline the request.' : 'You can now see each other at upcoming shows.')
    .replace(/%CTA_LABEL%/g, type === 'request' ? 'View Request' : 'View Connections')
    .replace(/%CONNECTIONS_URL%/g, connectionsUrl)
    .replace(/%NOTIFICATIONS_URL%/g, prefsUrl);

  const fromName = platformName;
  const fromEmail = process.env.FROM_EMAIL;
  await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: recipient.email_address, subject, html });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function publicProfile(user: AudienceUser) {
  const level = user.points_total >= 700 ? 'Platinum' : user.points_total >= 300 ? 'Gold' : 'Silver';
  const showFullName = user.is_public || user.social_discoverable;
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: showFullName ? (user.last_name ?? null) : null,
    last_name_initial: !showFullName && user.last_name ? user.last_name.charAt(0) + '.' : null,
    profile_photo_url: user.profile_photo_url ?? null,
    membership_tier: level,
    city: user.city ?? null,
    music_genres: user.music_genres ?? [],
  };
}

/**
 * Finds the connection record between two users regardless of direction.
 * Returns null if none exists.
 */
async function findConnection(
  userAId: number,
  userBId: number,
): Promise<AudienceConnection | null> {
  return AudienceConnection.findOne({
    where: {
      [Op.or]: [
        { requester_id: userAId, addressee_id: userBId },
        { requester_id: userBId, addressee_id: userAId },
      ],
    },
  });
}

/**
 * Creates an accepted connection between two users (used for auto-connect on
 * invite acceptance). Idempotent — silently returns if a connection already
 * exists in any state.
 */
export async function createAcceptedConnection(
  userAId: number,
  userBId: number,
): Promise<void> {
  try {
    const existing = await findConnection(userAId, userBId);
    if (existing) return;

    await AudienceConnection.create({
      requester_id: userAId,
      addressee_id: userBId,
      status: 'accepted',
    });

    // Award first-connection points to both users (idempotent — once per user)
    await awardPoints(userAId, 'first_connection' as any, 5, userAId, 'first_connection');
    await awardPoints(userBId, 'first_connection' as any, 5, userBId, 'first_connection');
  } catch (err) {
    console.error('createAcceptedConnection error:', err);
  }
}

// ─── Send connection request ──────────────────────────────────────────────────

/**
 * Core logic for creating a pending connection request from `sender` to `target`.
 * Shared by the HTTP handler and the invite-friend flow (when the invited email
 * already belongs to an existing user).
 */
export async function createPendingConnectionRequest(
  sender: AudienceUser,
  target: AudienceUser,
  res: Response,
): Promise<Response> {
  const existing = await findConnection(sender.id, target.id);
  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(409).json({ error: 'Already connected.' });
    }
    if (existing.status === 'blocked') {
      return res.status(409).json({ error: 'Unable to send request.' });
    }
    return res.status(409).json({ error: 'Request already sent.' });
  }

  const connection = await AudienceConnection.create({
    requester_id: sender.id,
    addressee_id: target.id,
    status: 'pending',
  });

  const senderName = sender.first_name
    ? `${sender.first_name}${sender.last_name ? ' ' + sender.last_name.charAt(0) + '.' : ''}`
    : 'Someone';

  await AudienceNotification.create({
    audience_user_id: target.id,
    type: 'connection_request',
    title: `${senderName} wants to connect`,
    link: '/my-connections',
    actor_id: sender.id,
  });

  sendConnectionEmail(target.id, senderName, 'request').catch(() => {});

  return res.json({ connection_id: connection.id, status: 'pending' });
}

export const sendConnectionRequest = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const { user_id } = req.body;

    if (!user_id || typeof user_id !== 'number') {
      return res.status(400).json({ error: 'user_id is required.' });
    }
    if (user_id === me.id) {
      return res.status(400).json({ error: 'You cannot connect with yourself.' });
    }

    const target = await AudienceUser.findByPk(user_id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (!target.social_discoverable) {
      return res.status(403).json({ error: 'This user is not accepting connection requests.' });
    }

    return createPendingConnectionRequest(me, target, res);
  } catch (error) {
    console.error('sendConnectionRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Accept connection request ────────────────────────────────────────────────

export const acceptConnectionRequest = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const connectionId = parseInt(req.params.id as string, 10);

    const connection = await AudienceConnection.findByPk(connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found.' });
    if (connection.addressee_id !== me.id) return res.status(403).json({ error: 'Forbidden.' });
    if (connection.status !== 'pending') {
      return res.status(409).json({ error: 'Connection is not pending.' });
    }

    // Atomic check-and-update: only succeeds if the row is still pending,
    // preventing a TOCTOU race where another request modifies it between the
    // findByPk above and this update.
    const [affected] = await AudienceConnection.update(
      { status: 'accepted' },
      { where: { id: connectionId, status: 'pending' } },
    );
    if (affected === 0) {
      return res.status(409).json({ error: 'Connection is no longer pending.' });
    }

    const accepterName = me.first_name
      ? `${me.first_name}${me.last_name ? ' ' + me.last_name.charAt(0) + '.' : ''}`
      : 'Someone';

    await AudienceNotification.create({
      audience_user_id: connection.requester_id,
      type: 'connection_accepted',
      title: `${accepterName} accepted your connection request`,
      link: '/my-connections',
      actor_id: me.id,
    });

    sendConnectionEmail(connection.requester_id, accepterName, 'accepted').catch(() => {});

    // Award first-connection points (idempotent — once per user lifetime)
    awardPoints(me.id, 'first_connection' as any, 5, me.id, 'first_connection').catch(() => {});
    awardPoints(connection.requester_id, 'first_connection' as any, 5, connection.requester_id, 'first_connection').catch(() => {});

    return res.json({ status: 'accepted' });
  } catch (error) {
    console.error('acceptConnectionRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Decline / cancel connection request ─────────────────────────────────────

export const declineConnectionRequest = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const connectionId = parseInt(req.params.id as string, 10);

    const connection = await AudienceConnection.findByPk(connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found.' });

    const isAddressee = connection.addressee_id === me.id;
    const isRequester = connection.requester_id === me.id;

    if (!isAddressee && !isRequester) return res.status(403).json({ error: 'Forbidden.' });
    if (connection.status !== 'pending') {
      return res.status(409).json({ error: 'Connection is not pending.' });
    }

    await connection.destroy();
    return res.json({ message: 'Request removed.' });
  } catch (error) {
    console.error('declineConnectionRequest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Remove connection ────────────────────────────────────────────────────────

export const removeConnection = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const connectionId = parseInt(req.params.id as string, 10);

    const connection = await AudienceConnection.findByPk(connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found.' });

    const isMember =
      connection.requester_id === me.id || connection.addressee_id === me.id;
    if (!isMember) return res.status(403).json({ error: 'Forbidden.' });

    await connection.destroy();
    return res.json({ message: 'Connection removed.' });
  } catch (error) {
    console.error('removeConnection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Block ────────────────────────────────────────────────────────────────────

export const blockUser = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const connectionId = parseInt(req.params.id as string, 10);

    const connection = await AudienceConnection.findByPk(connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found.' });

    const isMember =
      connection.requester_id === me.id || connection.addressee_id === me.id;
    if (!isMember) return res.status(403).json({ error: 'Forbidden.' });

    // Record who blocked whom via a dedicated column; preserve original requester/addressee for audit trail.
    await connection.update({ blocker_id: me.id, status: 'blocked' });
    return res.json({ status: 'blocked' });
  } catch (error) {
    console.error('blockUser error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── List my connections ──────────────────────────────────────────────────────

export const getMyConnections = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;

    const connections = await AudienceConnection.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [{ requester_id: me.id }, { addressee_id: me.id }],
      },
      include: [
        { model: AudienceUser, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'profile_photo_url', 'city', 'music_genres', 'points_total', 'is_public', 'social_discoverable'] },
        { model: AudienceUser, as: 'addressee', attributes: ['id', 'first_name', 'last_name', 'profile_photo_url', 'city', 'music_genres', 'points_total', 'is_public', 'social_discoverable'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const friends = connections.map((c) => {
      const other = c.requester_id === me.id
        ? (c as any).addressee
        : (c as any).requester;
      return { connection_id: c.id, user: publicProfile(other) };
    });

    return res.json({ connections: friends });
  } catch (error) {
    console.error('getMyConnections error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Pending incoming requests ────────────────────────────────────────────────

export const getPendingRequests = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;

    const pending = await AudienceConnection.findAll({
      where: { addressee_id: me.id, status: 'pending' },
      include: [
        { model: AudienceUser, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'profile_photo_url', 'city', 'music_genres', 'points_total', 'is_public', 'social_discoverable'] },
      ],
      order: [['created_at', 'DESC']],
    });

    return res.json({
      pending: pending.map((c) => ({
        connection_id: c.id,
        user: publicProfile((c as any).requester),
      })),
    });
  } catch (error) {
    console.error('getPendingRequests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Event attendee discovery ─────────────────────────────────────────────────

export const discoverAtEvent = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const eventId = parseInt(req.params.eventId as string, 10);

    // Cross-domain read: Ticket belongs to ticketing domain.
    // If this social module is ever extracted, this becomes an internal API call.
    console.log(`[discoverAtEvent] eventId=${eventId} requesterId=${me.id}`);

    const allTicketsForEvent = await Ticket.findAll({
      where: { event_id: eventId },
      attributes: ['id', 'audience_user_id'],
    });
    console.log(`[discoverAtEvent] total tickets for event: ${allTicketsForEvent.length}`);

    const tickets = allTicketsForEvent.filter(
      (t) => t.audience_user_id !== null && t.audience_user_id !== undefined && t.audience_user_id !== me.id
    );
    console.log(`[discoverAtEvent] tickets with other audience_user_id: ${tickets.length}`);

    const attendeeIds = [...new Set(tickets.map((t) => t.audience_user_id as number))];
    if (attendeeIds.length === 0) return res.json({ attendees: [] });

    const users = await AudienceUser.findAll({
      where: { id: { [Op.in]: attendeeIds }, social_discoverable: true },
      attributes: ['id', 'first_name', 'last_name', 'profile_photo_url', 'city', 'music_genres', 'points_total', 'is_public', 'social_discoverable'],
    });

    // Fetch existing connections to annotate connection_status
    const connections = await AudienceConnection.findAll({
      where: {
        [Op.or]: [
          { requester_id: me.id, addressee_id: { [Op.in]: attendeeIds } },
          { addressee_id: me.id, requester_id: { [Op.in]: attendeeIds } },
        ],
      },
    });

    const connectionMap = new Map<number, { connection_id: number; status: ConnectionStatus; i_am_requester: boolean }>();
    for (const c of connections) {
      const otherId = c.requester_id === me.id ? c.addressee_id : c.requester_id;
      connectionMap.set(otherId, {
        connection_id: c.id,
        status: c.status,
        i_am_requester: c.requester_id === me.id,
      });
    }

    const attendees = users
      .filter((u) => {
        const conn = connectionMap.get(u.id);
        // Exclude blocked relationships
        return !conn || conn.status !== 'blocked';
      })
      .map((u) => {
        const conn = connectionMap.get(u.id);
        return {
          user: publicProfile(u),
          connection: conn ?? null,
        };
      });

    return res.json({ attendees });
  } catch (error) {
    console.error('discoverAtEvent error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Public user profile ──────────────────────────────────────────────────────

export const getAudienceUserProfile = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const targetId = parseInt(req.params.id as string, 10);

    const target = await AudienceUser.findByPk(targetId, {
      attributes: ['id', 'first_name', 'last_name', 'profile_photo_url', 'city', 'music_genres', 'points_total', 'is_public', 'social_discoverable'],
    });
    if (!target || !target.social_discoverable) return res.status(404).json({ error: 'User not found.' });

    const connection = await findConnection(me.id, targetId);
    const connData = connection
      ? { connection_id: connection.id, status: connection.status, i_am_requester: connection.requester_id === me.id }
      : null;

    return res.json({ user: publicProfile(target), connection: connData });
  } catch (error) {
    console.error('getAudienceUserProfile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
