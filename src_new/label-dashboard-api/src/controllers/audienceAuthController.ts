import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { Op } from 'sequelize';
import { AudienceUser, Ticket } from '../models';
import { hashPassword, validatePassword } from '../utils/passwordUtils';
import { generateSecureToken } from '../utils/tokenUtils';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendAudienceEmail = async (to: string, subject: string, html: string): Promise<void> => {
  const fromName = process.env.PLATFORM_NAME || 'Your Scene';
  const fromEmail = process.env.FROM_EMAIL;
  await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to, subject, html });
};

// ─── One-time Google OAuth exchange codes for audience users ──────────────────
interface AudienceExchangeEntry {
  audienceUserId: number;
  expiresAt: number;
}
const audienceOAuthCodes = new Map<string, AudienceExchangeEntry>();
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of audienceOAuthCodes) {
    if (entry.expiresAt < now) audienceOAuthCodes.delete(code);
  }
}, 60_000);

function createAudienceExchangeCode(audienceUserId: number): string {
  const code = crypto.randomBytes(32).toString('hex');
  audienceOAuthCodes.set(code, { audienceUserId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return code;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Links all unowned tickets with a matching email address to the given audience user.
 * Returns the count of newly claimed tickets.
 */
export const claimTicketsByEmailInternal = async (
  audienceUserId: number,
  email: string
): Promise<number> => {
  const [affectedCount] = await Ticket.update(
    { audience_user_id: audienceUserId },
    {
      where: {
        email_address: email,
        audience_user_id: null,
        status: { [Op.notIn]: ['Canceled', 'Refunded'] },
      },
    }
  );
  return affectedCount;
};

// ─── Sign JWT ─────────────────────────────────────────────────────────────────

const signAudienceToken = (audienceUserId: number): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return jwt.sign(
    { audienceUserId, type: 'audience' },
    process.env.JWT_SECRET,
    { expiresIn: '90d' }
  );
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const audienceSignup = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    const existing = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await hashPassword(password);
    const user = await AudienceUser.create({
      email_address: email.toLowerCase(),
      password_hash,
      first_name,
      last_name,
    });

    const claimed_tickets_count = await claimTicketsByEmailInternal(user.id, user.email_address);
    const token = signAudienceToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      claimed_tickets_count,
    });
  } catch (error) {
    console.error('Audience signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const claimed_tickets_count = await claimTicketsByEmailInternal(user.id, user.email_address);
    const token = signAudienceToken(user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      claimed_tickets_count,
    });
  } catch (error) {
    console.error('Audience login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceGetMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    return res.json({
      id: user.id,
      email_address: user.email_address,
      first_name: user.first_name,
      last_name: user.last_name,
    });
  } catch (error) {
    console.error('Audience getMe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceForgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const reset_hash = generateSecureToken();
    const reset_hash_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.update({ reset_hash, reset_hash_expires_at });

    const resetUrl = `${process.env.AUDIENCE_RESET_URL || process.env.FRONTEND_URL}/reset-password?hash=${reset_hash}&mode=audience`;

    await sendAudienceEmail(
      user.email_address,
      'Reset your password',
      `
        <p>Hi ${user.first_name || 'there'},</p>
        <p>Click the link below to reset your password. This link expires in 24 hours.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `
    );

    return res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Audience forgotPassword error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceResetPassword = async (req: Request, res: Response) => {
  try {
    const { hash, password } = req.body;

    if (!hash || !password) {
      return res.status(400).json({ error: 'Hash and password are required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    const user = await AudienceUser.findOne({ where: { reset_hash: hash } });
    if (!user || !user.reset_hash_expires_at || user.reset_hash_expires_at < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const password_hash = await hashPassword(password);
    await user.update({ password_hash, reset_hash: null as any, reset_hash_expires_at: null as any });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Audience resetPassword error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceValidateResetHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const user = await AudienceUser.findOne({ where: { reset_hash: hash } });
    if (!user || !user.reset_hash_expires_at || user.reset_hash_expires_at < new Date()) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset link' });
    }
    return res.json({ valid: true });
  } catch (error) {
    console.error('Audience validateResetHash error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Google OAuth for audience users ─────────────────────────────────────────

/** Derives the ticketing frontend URL from env config */
function getAudienceFrontendUrl(): string {
  return process.env.TICKETING_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:4201';
}

/** Step 1 — redirect the browser to Google's OAuth consent screen */
export const audienceGoogleRedirect = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(501).json({ error: 'Google Sign-In is not configured on this server' });
    }

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    const returnTo = (req.query.return_to as string) || '';

    const state = jwt.sign(
      { nonce: crypto.randomBytes(16).toString('hex'), returnTo },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/audience/google/callback`;

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('client_id', clientId);
    googleUrl.searchParams.set('redirect_uri', redirectUri);
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('scope', 'openid email profile');
    googleUrl.searchParams.set('state', state);
    googleUrl.searchParams.set('access_type', 'online');

    return res.redirect(googleUrl.toString());
  } catch (error) {
    console.error('Audience Google redirect error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/** Step 2 — handle Google's redirect, find-or-create audience user, issue exchange code */
export const audienceGoogleCallback = async (req: Request, res: Response) => {
  const { code, state, error: googleError } = req.query as Record<string, string>;
  const defaultFrontendUrl = getAudienceFrontendUrl();

  // Extract returnTo from verified state JWT
  let returnTo = '';
  if (state && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET) as any;
      returnTo = decoded.returnTo || '';
    } catch {
      return res.redirect(`${defaultFrontendUrl}/login?mode=audience&error=invalid_state`);
    }
  }

  // Helper: build error redirect that goes back to the origin UI
  const errorRedirect = (err: string) => {
    if (returnTo) {
      const url = new URL(returnTo);
      url.searchParams.set('audience_error', err);
      return res.redirect(url.toString());
    }
    return res.redirect(`${defaultFrontendUrl}/login?mode=audience&error=${err}`);
  };

  if (googleError) return errorRedirect('google_cancelled');
  if (!code) return errorRedirect('missing_code');

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/audience/google/callback`;

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const { email, email_verified, given_name = '', family_name = '' } = userInfoRes.data;

    if (!email_verified) {
      return errorRedirect('google_unverified_email');
    }

    // Find or create audience user
    let user = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });
    if (!user) {
      user = await AudienceUser.create({
        email_address: email.toLowerCase(),
        first_name: given_name,
        last_name: family_name,
      });
    }

    // Auto-claim any unlinked tickets
    await claimTicketsByEmailInternal(user.id, user.email_address);

    const exchangeCode = createAudienceExchangeCode(user.id);

    if (returnTo) {
      const url = new URL(returnTo);
      url.searchParams.set('audience_code', exchangeCode);
      return res.redirect(url.toString());
    }
    return res.redirect(`${defaultFrontendUrl}/login?mode=audience&code=${exchangeCode}`);
  } catch (error) {
    console.error('Audience Google callback error:', error);
    return errorRedirect('google_auth_failed');
  }
};

/** Step 3 — exchange the one-time code for an audience JWT */
export const audienceGoogleExchange = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    const entry = audienceOAuthCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired exchange code' });
    }
    audienceOAuthCodes.delete(code);

    const user = await AudienceUser.findByPk(entry.audienceUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = signAudienceToken(user.id);
    return res.json({
      token,
      user: {
        id: user.id,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.error('Audience Google exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
