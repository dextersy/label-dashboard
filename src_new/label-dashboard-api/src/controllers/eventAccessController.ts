import { Request, Response } from 'express';
import crypto from 'crypto';
import { EventAccess, Event, User, Brand } from '../models';
import { sendBrandedEmail } from '../utils/emailService';
import { createNotification } from '../utils/notificationService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { hasPassword, hashPassword, validatePassword } from '../utils/passwordUtils';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: any;
}

export const listCollaborators = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const collaborators = await EventAccess.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email_address'] }],
      order: [['createdAt', 'ASC']],
    });

    res.json({ collaborators });
  } catch (error) {
    console.error('listCollaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteCollaborator = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }
    if (role !== 'viewer' && role !== 'manager') {
      return res.status(400).json({ error: 'Role must be viewer or manager' });
    }

    const event = await Event.findOne({
      where: { id: eventId, brand_id: req.user.brand_id },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Prevent duplicate active invites for the same email+event
    const existing = await EventAccess.findOne({ where: { event_id: eventId, invite_email: email } });
    if (existing) {
      return res.status(409).json({ error: 'An invite already exists for this email and event' });
    }

    const inviteHash = crypto.randomBytes(32).toString('hex');

    // Find or create a user record for this email, scoped to this brand.
    // Mirrors the artist invite flow: a placeholder user is created immediately so
    // user_id is always populated on EventAccess from the start.
    let user = await User.findOne({ where: { email_address: email, brand_id: req.user.brand_id } });
    if (!user) {
      user = await User.create({
        email_address: email,
        brand_id: req.user.brand_id,
        is_admin: false,
      });
    }

    const brand = await Brand.findByPk(req.user.brand_id);
    const roleLabel = role === 'manager' ? 'Manager' : 'Viewer';

    await EventAccess.create({
      event_id: eventId,
      user_id: user.id as number,
      invite_email: email,
      role,
      status: 'Invited',
      invite_hash: inviteHash,
    });

    // Bell notification so the user sees it before clicking the link
    createNotification(
      user.id as number,
      req.user.brand_id,
      'event_invite',
      `You've been invited to ${event.title}`,
      `You have been invited as a ${roleLabel}. Click to accept.`,
      `/event-invite?hash=${inviteHash}`
    ).catch(() => {});

    const frontendUrl = await getBrandFrontendUrl(req.user.brand_id);
    const inviteUrl = `${frontendUrl}/event-invite?hash=${inviteHash}`;

    await sendBrandedEmail([email], 'event_invite_email', {
      event_title: event.title,
      role_label: roleLabel,
      url: inviteUrl,
      brand_color: brand?.brand_color || '#1595e7',
      logo: brand?.logo_url || '',
      brand_name: brand?.brand_name || '',
    }, req.user.brand_id);

    res.status(201).json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('inviteCollaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const revokeCollaborator = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Load the record before destroying so we can clean up the pre-created user if needed.
    const access = await EventAccess.findOne({
      where: { event_id: eventId, user_id },
      include: [{ model: User, as: 'user' }],
    });
    if (!access) return res.status(404).json({ error: 'Collaborator not found' });

    await access.destroy();

    // If the linked user was a placeholder (no password set), delete them too.
    // A placeholder user with a password has already completed account setup, so keep them.
    const linkedUser = (access as any).user;
    if (linkedUser && !hasPassword(linkedUser)) {
      await linkedUser.destroy();
    }

    res.json({ message: 'Collaborator removed' });
  } catch (error) {
    console.error('revokeCollaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptEventInvite = async (req: Request, res: Response) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Invite hash is required' });

    const access = await EventAccess.findOne({
      where: { invite_hash: hash },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] },
        { model: User, as: 'user' },
      ],
    });

    if (!access) return res.status(404).json({ error: 'Invalid or expired invitation' });
    if (access.status === 'Accepted') return res.status(409).json({ error: 'Invitation already accepted' });

    const user = (access as any).user;

    if (!user || !hasPassword(user)) {
      // User has no password yet (account not fully set up).
      // Mirrors artist invite flow: don't accept yet, don't consume the hash —
      // the hash must stay alive so set-profile can use it to finalise setup.
      return res.json({
        action: 'create_account',
        event_title: (access as any).event?.title,
        role: access.role,
      });
    }

    // Fully set-up user: accept and consume the hash
    await access.update({ status: 'Accepted', invite_hash: null });

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    const token = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      action: 'accepted',
      event_id: access.event_id,
      role: access.role,
      token,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        brand_id: user.brand_id,
      },
    });
  } catch (error) {
    console.error('acceptEventInvite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setupEventInviteProfile = async (req: Request, res: Response) => {
  try {
    const { event_invite_hash, first_name, last_name, username, password } = req.body;

    if (!event_invite_hash || !first_name || !last_name || !password) {
      return res.status(400).json({ error: 'event_invite_hash, first_name, last_name, and password are required' });
    }

    const access = await EventAccess.findOne({
      where: { invite_hash: event_invite_hash },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] },
        { model: User, as: 'user' },
      ],
    });

    if (!access || !(access as any).user) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }
    if (access.status === 'Accepted') {
      return res.status(409).json({ error: 'Invitation already accepted' });
    }

    const user = (access as any).user;

    if (username && username.trim() !== '') {
      const usernamePattern = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernamePattern.test(username.trim())) {
        return res.status(400).json({ errors: { username: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens' } });
      }
      const takenBy = await User.findOne({ where: { username: username.trim(), brand_id: user.brand_id } });
      if (takenBy && (takenBy as any).id !== user.id) {
        return res.status(400).json({ errors: { username: 'Sorry, this username is already in use. Please choose another' } });
      }
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Password does not meet security requirements', details: validation.errors });
    }

    const passwordHash = await hashPassword(password);

    await user.update({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      username: username?.trim() || user.username,
      password_hash: passwordHash,
    });

    await access.update({ status: 'Accepted', invite_hash: null });

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    const token = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        brand_id: user.brand_id,
      },
    });
  } catch (error) {
    console.error('setupEventInviteProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resendCollaboratorInvite = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const access = await EventAccess.findOne({
      where: { event_id: eventId, user_id },
      include: [{ model: User, as: 'user' }],
    });
    if (!access) return res.status(404).json({ error: 'Collaborator not found' });
    if (access.status === 'Accepted') return res.status(400).json({ error: 'Invite already accepted' });

    const inviteHash = crypto.randomBytes(32).toString('hex');
    await access.update({ invite_hash: inviteHash, status: 'Invited' });

    const brand = await Brand.findByPk(req.user.brand_id);
    const roleLabel = access.role === 'manager' ? 'Manager' : 'Viewer';
    const frontendUrl = await getBrandFrontendUrl(req.user.brand_id);
    const inviteUrl = `${frontendUrl}/event-invite?hash=${inviteHash}`;

    await sendBrandedEmail([access.invite_email], 'event_invite_email', {
      event_title: event.title,
      role_label: roleLabel,
      url: inviteUrl,
      brand_color: brand?.brand_color || '#1595e7',
      logo: brand?.logo_url || '',
      brand_name: brand?.brand_name || '',
    }, req.user.brand_id);

    createNotification(
      user_id,
      req.user.brand_id,
      'event_invite',
      `You've been invited to ${event.title}`,
      `You have been invited as a ${roleLabel}. Click to accept.`,
      `/event-invite?hash=${inviteHash}`
    ).catch(() => {});

    res.json({ message: 'Invite resent successfully' });
  } catch (error) {
    console.error('resendCollaboratorInvite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCollaboratorRole = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const { user_id, role } = req.body;

    if (!user_id || !role) return res.status(400).json({ error: 'user_id and role are required' });
    if (role !== 'viewer' && role !== 'manager') return res.status(400).json({ error: 'Role must be viewer or manager' });

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const access = await EventAccess.findOne({ where: { event_id: eventId, user_id } });
    if (!access) return res.status(404).json({ error: 'Collaborator not found' });

    await access.update({ role });

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('updateCollaboratorRole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInviteInfo = async (req: Request, res: Response) => {
  try {
    const hash = req.query.hash as string;
    if (!hash) return res.status(400).json({ error: 'Invite hash is required' });

    const access = await EventAccess.findOne({
      where: { invite_hash: hash },
      include: [
        { model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] },
      ],
    });

    if (!access) return res.status(404).json({ error: 'Invalid or expired invitation' });

    const event = (access as any).event;
    const brand = event ? await Brand.findByPk(event.brand_id, { attributes: ['brand_name', 'logo_url', 'brand_color'] }) : null;

    res.json({
      role: access.role,
      status: access.status,
      event_title: event?.title,
      brand_name: brand?.brand_name,
      brand_logo: brand?.logo_url,
      brand_color: brand?.brand_color,
    });
  } catch (error) {
    console.error('getInviteInfo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
