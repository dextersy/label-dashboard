import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import { AudienceUser, AudienceEmailPreference, Event, Ticket } from '../models';
import { hashPassword, validatePassword } from '../utils/passwordUtils';
import { getCardLevel, awardRetroactiveTicketPoints, awardReferralPoints, isProfileComplete, awardProfileCompletePoints } from '../utils/audiencePoints';
import { generateSecureToken } from '../utils/tokenUtils';
import { uploadToS3, deleteFromS3, getS3PublicUrl } from '../utils/s3Service';
import { extension as mimeExtension } from 'mime-types';
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

// ─── One-time OAuth exchange codes stored in the database ─────────────────────
// Storing these in the DB (rather than process memory) makes the exchange
// work correctly across multiple API instances / PM2 cluster processes.

async function createAudienceExchangeCode(audienceUserId: number): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await AudienceUser.update(
    { oauth_exchange_code: code, oauth_exchange_code_expires_at: expiresAt },
    { where: { id: audienceUserId } },
  );
  return code;
}

async function consumeAudienceExchangeCode(
  code: string,
): Promise<number | null> {
  const user = await AudienceUser.findOne({
    where: {
      oauth_exchange_code: code,
      oauth_exchange_code_expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!user) return null;
  await user.update({ oauth_exchange_code: null, oauth_exchange_code_expires_at: null });
  return user.id;
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function sendVerificationEmail(user: AudienceUser): Promise<void> {
  const email_verification_token = generateSecureToken();
  const email_verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.update({ email_verification_token, email_verification_expires_at });
  const verifyUrl = `${getAudienceFrontendUrl()}/verify-email?token=${email_verification_token}`;
  const platformName = process.env.PLATFORM_NAME || 'Your Scene';

  const templatePath = path.join(__dirname, '../assets/templates/audience_verify_email.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  const logoUrl = `${process.env.AUDIENCE_APP_URL || ''}/assets/logo-dark-bg.png`;
  html = html
    .replace(/%PLATFORM_NAME%/g, platformName)
    .replace(/%FIRST_NAME%/g, user.first_name || 'there')
    .replace(/%URL%/g, verifyUrl)
    .replace(/%LOGO_URL%/g, logoUrl);

  await sendAudienceEmail(user.email_address, 'Verify your email address', html);
}

async function sendWelcomeEmail(user: AudienceUser): Promise<void> {
  const platformName = process.env.PLATFORM_NAME || 'Your Scene';
  const audienceUrl = getAudienceFrontendUrl();

  // Fetch the next 2 upcoming published events listed on the ticketing platform
  const upcomingEvents = await Event.findAll({
    where: {
      status: 'published',
      listed_on_ticketing: true,
      date_and_time: { [Op.gte]: new Date() },
    },
    order: [['date_and_time', 'ASC']],
    limit: 2,
    attributes: ['id', 'title', 'date_and_time', 'venue', 'poster_url'],
  });

  const templatePath = path.join(__dirname, '../assets/templates/audience_welcome_email.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  const logoUrl = `${process.env.AUDIENCE_APP_URL || ''}/assets/logo-dark-bg.png`;

  let upcomingShowsSection = '';
  if (upcomingEvents.length > 0) {
    const eventCards = upcomingEvents.map((event) => {
      const eventUrl = `${audienceUrl}/events/${event.id}`;
      const dateStr = new Date(event.date_and_time).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = new Date(event.date_and_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const posterBlock = event.poster_url
        ? `<img src="${event.poster_url}" width="80" height="80" alt="${event.title}" style="display: block; border-radius: 6px; object-fit: cover; width: 80px; height: 80px;" />`
        : `<div style="width: 80px; height: 80px; border-radius: 6px; background-color: #2a2a2a; display: inline-block;"></div>`;
      return `
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"
            style="background-color: #222222; border-radius: 8px; border: 1px solid #2a2a2a; margin-bottom: 12px;">
          <tr>
            <td style="padding: 16px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="80" valign="top" style="padding-right: 16px;">
                    ${posterBlock}
                  </td>
                  <td valign="top">
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; line-height: 20px; padding-bottom: 4px;">
                      <a href="${eventUrl}" target="_blank" style="color: #ffffff; text-decoration: none;">${event.title}</a>
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #aaaaaa; line-height: 18px; padding-bottom: 4px;">
                      ${dateStr} &middot; ${timeStr}
                    </div>
                    ${event.venue ? `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #888888; line-height: 18px; padding-bottom: 10px;">${event.venue}</div>` : ''}
                    <!--[if mso]>
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td valign="middle" align="center" style="border-radius: 6px; background-color: #facc15; padding: 8px 20px;" bgcolor="#facc15">
                          <a class="pc-font-alt" style="display: inline-block; text-decoration: none; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 13px; color: #000000;" href="${eventUrl}" target="_blank">See More</a>
                        </td>
                      </tr>
                    </table>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${eventUrl}" target="_blank"
                        style="display: inline-block; border-radius: 6px; background-color: #facc15; padding: 8px 20px; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 13px; color: #000000; text-decoration: none; -webkit-text-size-adjust: none;">
                      See More
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
    }).join('');

    upcomingShowsSection = `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; line-height: 18px; color: #facc15; text-align: center; letter-spacing: 2px; text-transform: uppercase;">
              Here are a few upcoming shows to check out!
            </div>
          </td>
        </tr>
        <tr>
          <td>
            ${eventCards}
          </td>
        </tr>
      </table>`;
  } else {
    upcomingShowsSection = `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center" style="padding-bottom: 8px;">
            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 400; line-height: 26px; color: #aaaaaa; text-align: center;">
              There are no upcoming shows right now &mdash; check back soon!
            </div>
          </td>
        </tr>
      </table>`;
  }

  const showsUrl = `${audienceUrl}/#shows`;
  const notificationsUrl = `${audienceUrl}/my-notifications`;
  const profileUrl = `${audienceUrl}/my-profile`;

  html = html
    .replace(/%PLATFORM_NAME%/g, platformName)
    .replace(/%FIRST_NAME%/g, user.first_name || 'there')
    .replace(/%LOGO_URL%/g, logoUrl)
    .replace(/%UPCOMING_SHOWS_SECTION%/g, upcomingShowsSection)
    .replace(/%SHOWS_URL%/g, showsUrl)
    .replace(/%PROFILE_URL%/g, profileUrl)
    .replace(/%NOTIFICATIONS_URL%/g, notificationsUrl);

  await sendAudienceEmail(user.email_address, `Welcome to ${platformName} — complete your profile to earn points!`, html);
}

/**
 * Sends the "complete your profile to earn 10 points" email.
 * Respects the user's marketing_promos email preference (defaults to true if no row exists).
 */
async function sendCompleteProfileEmail(user: AudienceUser): Promise<void> {
  // Check email preference — default to send if no row yet
  const pref = await AudienceEmailPreference.findOne({ where: { audience_user_id: user.id } });
  if (pref && !pref.marketing_promos) return;

  const platformName = process.env.PLATFORM_NAME || 'Your Scene';
  const audienceUrl = getAudienceFrontendUrl();
  const profileUrl = `${audienceUrl}/my-profile`;
  const notificationsUrl = `${audienceUrl}/my-notifications`;
  const logoUrl = `${process.env.AUDIENCE_APP_URL || ''}/assets/logo-dark-bg.png`;

  const templatePath = path.join(__dirname, '../assets/templates/audience_complete_profile_email.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  html = html
    .replace(/%PLATFORM_NAME%/g, platformName)
    .replace(/%FIRST_NAME%/g, user.first_name || 'there')
    .replace(/%LOGO_URL%/g, logoUrl)
    .replace(/%PROFILE_URL%/g, profileUrl)
    .replace(/%NOTIFICATIONS_URL%/g, notificationsUrl);

  await sendAudienceEmail(user.email_address, `Complete your profile — earn 10 points`, html);
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const audienceSignup = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, terms_accepted, privacy_accepted, age_confirmed, signed_up_from, signup_reference, referral_code: incomingReferralCode } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    if (!terms_accepted) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions to create an account' });
    }
    if (!privacy_accepted) {
      return res.status(400).json({ error: 'You must accept the Privacy Policy to create an account' });
    }
    if (!age_confirmed) {
      return res.status(400).json({ error: 'You must confirm you are at least 13 years old to create an account' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.errors[0] });
    }

    const existing = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Resolve referral code to a user ID if provided
    let referred_by_user_id: number | null = null;
    if (incomingReferralCode) {
      const referrer = await AudienceUser.findOne({ where: { referral_code: incomingReferralCode } });
      if (referrer) {
        referred_by_user_id = referrer.id;
      }
    }

    const now = new Date();
    const password_hash = await hashPassword(password);
    const membership_id = await generateMembershipId();
    const referral_code = await generateReferralCode();
    const user = await AudienceUser.create({
      email_address: email.toLowerCase(),
      password_hash,
      first_name,
      last_name,
      email_verified: false,
      membership_id,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      age_confirmed_at: now,
      signed_up_from: signed_up_from || null,
      signup_reference: signup_reference ? String(signup_reference) : null,
      referral_code,
      referred_by_user_id,
    });

    // Send verification email (non-blocking — don't fail signup if email fails)
    sendVerificationEmail(user).catch(err => console.error('Failed to send verification email:', err));

    return res.json({
      message: 'Account created. Please check your email to verify your address before signing in.',
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

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email address before signing in. Check your inbox for a verification link.', code: 'EMAIL_NOT_VERIFIED' });
    }

    // Only claim tickets for verified accounts
    const claimed_tickets_count = user.email_verified
      ? await claimTicketsByEmailInternal(user.id, user.email_address)
      : 0;

    // Award retroactive points for any newly claimed (or previously uncredited) tickets
    if (user.email_verified) {
      awardRetroactiveTicketPoints(user.id).catch(err =>
        console.error('Failed to award retroactive ticket points on login:', err)
      );
    }

    // Lazily assign membership ID to pre-existing accounts that don't have one
    if (!user.membership_id) {
      const membership_id = await generateMembershipId();
      await user.update({ membership_id });
    }

    const token = signAudienceToken(user.id);
    const needs_terms_acceptance = !user.terms_accepted_at || !user.privacy_accepted_at || !user.age_confirmed_at;

    return res.json({
      token,
      user: buildUserPayload(user),
      claimed_tickets_count,
      needs_terms_acceptance,
    });
  } catch (error) {
    console.error('Audience login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceGetMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    // Lazily assign membership ID to pre-existing accounts that don't have one
    if (!user.membership_id) {
      const membership_id = await generateMembershipId();
      await user.update({ membership_id });
    }
    // Award any uncredited ticket points, then reload from DB so points_total is current
    await awardRetroactiveTicketPoints(user.id);
    const freshUser = await AudienceUser.findByPk(user.id);
    return res.json(buildUserPayload(freshUser ?? user));
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

    const resetUrl = `${process.env.AUDIENCE_APP_URL || process.env.FRONTEND_URL}/reset-password?hash=${reset_hash}&mode=audience`;

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

// ─── OAuth shared helpers ────────────────────────────────────────────────────

/** Derives the ticketing frontend URL from env config */
function getAudienceFrontendUrl(): string {
  return process.env.TICKETING_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:4201';
}

/**
 * Shared: find-or-create an audience user from a verified OAuth identity, claim
 * any unlinked tickets, send a welcome email to new signups, and issue a
 * one-time exchange code that the frontend can POST to redeem for a JWT.
 */
async function findOrCreateAudienceUserAndIssueCode(
  email: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  let user = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });
  if (!user) {
    user = await AudienceUser.create({
      email_address: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      email_verified: true,
      email_verification_token: null as any,
      email_verification_expires_at: null as any,
    });
    sendWelcomeEmail(user).catch((err) => console.error('Failed to send welcome email:', err));
  } else if (!user.email_verified) {
    // The OAuth provider confirmed ownership of this email — mark it verified
    await user.update({
      email_verified: true,
      email_verification_token: null as any,
      email_verification_expires_at: null as any,
    });
  }
  await claimTicketsByEmailInternal(user.id, user.email_address);
  return createAudienceExchangeCode(user.id);
}

/**
 * Shared: verify the state JWT from an OAuth callback and extract the returnTo URL.
 * Returns null and sends an error redirect if the state is invalid.
 */
function verifyOAuthState(
  state: string | undefined,
  res: Response,
  defaultFrontendUrl: string,
): { returnTo: string } | null {
  // A missing state means CSRF protection was bypassed — always reject.
  if (!state) {
    res.redirect(`${defaultFrontendUrl}/login?mode=audience&error=invalid_state`);
    return null;
  }
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET) as any;
    return { returnTo: decoded.returnTo || '' };
  } catch {
    res.redirect(`${defaultFrontendUrl}/login?mode=audience&error=invalid_state`);
    return null;
  }
}

/**
 * Shared: build the final redirect URL for a successful OAuth callback.
 * Appends the exchange code and provider hint so the frontend knows which
 * exchange endpoint to call.
 */
function buildOAuthSuccessRedirect(
  returnTo: string,
  defaultFrontendUrl: string,
  exchangeCode: string,
  provider: string,
): string {
  if (returnTo) {
    const url = new URL(returnTo);
    url.searchParams.set('audience_code', exchangeCode);
    url.searchParams.set('audience_provider', provider);
    return url.toString();
  }
  return `${defaultFrontendUrl}/login?mode=audience&audience_code=${exchangeCode}&audience_provider=${provider}`;
}

// ─── Google OAuth for audience users ─────────────────────────────────────────

/** Step 1 — redirect the browser to Google's OAuth consent screen */
export const audienceGoogleRedirect = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.TICKETING_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.TICKETING_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
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

  const stateResult = verifyOAuthState(state, res, defaultFrontendUrl);
  if (!stateResult) return;
  const { returnTo } = stateResult;

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
    const clientId = (process.env.TICKETING_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)!;
    const clientSecret = (process.env.TICKETING_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)!;
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

    const exchangeCode = await findOrCreateAudienceUserAndIssueCode(email, given_name, family_name);
    return res.redirect(buildOAuthSuccessRedirect(returnTo, defaultFrontendUrl, exchangeCode, 'google'));
  } catch (error) {
    console.error('Audience Google callback error:', error);
    return errorRedirect('google_auth_failed');
  }
};

// ─── Facebook OAuth for audience users ───────────────────────────────────────

/** Step 1 — redirect the browser to Facebook's OAuth consent screen */
export const audienceFacebookRedirect = async (req: Request, res: Response) => {
  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return res.status(501).json({ error: 'Facebook Sign-In is not configured on this server' });
    }

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    const returnTo = (req.query.return_to as string) || '';

    const state = jwt.sign(
      { nonce: crypto.randomBytes(16).toString('hex'), returnTo },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/audience/facebook/callback`;

    const facebookUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    facebookUrl.searchParams.set('client_id', appId);
    facebookUrl.searchParams.set('redirect_uri', redirectUri);
    facebookUrl.searchParams.set('response_type', 'code');
    facebookUrl.searchParams.set('scope', 'email');
    facebookUrl.searchParams.set('state', state);

    return res.redirect(facebookUrl.toString());
  } catch (error) {
    console.error('Audience Facebook redirect error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/** Step 2 — handle Facebook's redirect, find-or-create audience user, issue exchange code */
export const audienceFacebookCallback = async (req: Request, res: Response) => {
  const { code, state, error: fbError } = req.query as Record<string, string>;
  const defaultFrontendUrl = getAudienceFrontendUrl();

  const stateResult = verifyOAuthState(state, res, defaultFrontendUrl);
  if (!stateResult) return;
  const { returnTo } = stateResult;

  const errorRedirect = (err: string) => {
    if (returnTo) {
      const url = new URL(returnTo);
      url.searchParams.set('audience_error', err);
      return res.redirect(url.toString());
    }
    return res.redirect(`${defaultFrontendUrl}/login?mode=audience&error=${err}`);
  };

  if (fbError) return errorRedirect('facebook_cancelled');
  if (!code) return errorRedirect('missing_code');

  try {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/audience/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    // Fetch user profile (email is returned only if user granted it and has a verified FB email)
    const userInfoRes = await axios.get('https://graph.facebook.com/me', {
      params: {
        fields: 'email,first_name,last_name',
        access_token: tokenRes.data.access_token,
      },
    });

    const { email, first_name = '', last_name = '' } = userInfoRes.data;

    if (!email) {
      // Facebook may omit the email if the user's FB account has no verified email
      return errorRedirect('facebook_no_email');
    }

    const exchangeCode = await findOrCreateAudienceUserAndIssueCode(email, first_name, last_name);
    return res.redirect(buildOAuthSuccessRedirect(returnTo, defaultFrontendUrl, exchangeCode, 'facebook'));
  } catch (error) {
    console.error('Audience Facebook callback error:', error);
    return errorRedirect('facebook_auth_failed');
  }
};

// ─── Email verification ───────────────────────────────────────────────────────

export const audienceVerifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await AudienceUser.findOne({ where: { email_verification_token: token } });
    if (!user || !user.email_verification_expires_at || user.email_verification_expires_at < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    await user.update({
      email_verified: true,
      email_verification_token: null as any,
      email_verification_expires_at: null as any,
    });

    // Now that the email is confirmed, claim any tickets purchased with this address
    const claimed_tickets_count = await claimTicketsByEmailInternal(user.id, user.email_address);

    // Award retroactive ticket points (fire-and-forget)
    awardRetroactiveTicketPoints(user.id).catch(err =>
      console.error('Failed to award retroactive ticket points on email verify:', err)
    );

    // Award referral points to referrer if applicable (fire-and-forget)
    if (user.referred_by_user_id) {
      const referredByUserId = user.referred_by_user_id;
      awardReferralPoints(referredByUserId, user.id).catch(err =>
        console.error('Failed to award referral points:', err)
      );
    }

    // Send welcome email — includes the complete-your-profile CTA block for new users (fire-and-forget)
    sendWelcomeEmail(user).catch((err) => console.error('Failed to send welcome email:', err));

    const authToken = signAudienceToken(user.id);
    return res.json({
      message: 'Email verified successfully',
      token: authToken,
      user: buildUserPayload(user),
      claimed_tickets_count,
    });
  } catch (error) {
    console.error('Audience verifyEmail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceResendVerification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    await sendVerificationEmail(user);

    return res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Audience resendVerification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceResendVerificationByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await AudienceUser.findOne({ where: { email_address: email.toLowerCase() } });

    // Always return success to prevent user enumeration
    if (!user || user.email_verified) {
      return res.json({ message: 'If that email exists and is unverified, a new link has been sent' });
    }

    await sendVerificationEmail(user);

    return res.json({ message: 'If that email exists and is unverified, a new link has been sent' });
  } catch (error) {
    console.error('Audience resendVerificationByEmail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/** Step 3 — exchange the one-time OAuth code for an audience JWT (shared by all providers) */
export const audienceOAuthExchange = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    const audienceUserId = await consumeAudienceExchangeCode(code);
    if (!audienceUserId) {
      return res.status(400).json({ error: 'Invalid or expired exchange code' });
    }

    const user = await AudienceUser.findByPk(audienceUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.membership_id) {
      const membership_id = await generateMembershipId();
      await user.update({ membership_id });
    }

    const token = signAudienceToken(user.id);
    const needs_terms_acceptance = !user.terms_accepted_at || !user.privacy_accepted_at || !user.age_confirmed_at;
    return res.json({
      token,
      user: buildUserPayload(user),
      needs_terms_acceptance,
    });
  } catch (error) {
    console.error('Audience OAuth exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Backward-compat alias so existing route wiring still compiles without changes
export const audienceGoogleExchange = audienceOAuthExchange;

// ─── Referral code ────────────────────────────────────────────────────────────

/**
 * Generate a unique 8-character alphanumeric referral code.
 * Retries on collision.
 */
async function generateReferralCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = Array.from({ length: 8 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
    const existing = await AudienceUser.findOne({ where: { referral_code: code } });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique referral code after 20 attempts');
}

// ─── Membership ID ────────────────────────────────────────────────────────────

/**
 * Generate a unique 12-digit membership ID.
 * Format stored as plain string "XXXXXXXXXXXX"; formatted for display as "XXXX XXXX XXXX".
 * Uses crypto.randomInt for cryptographic randomness. Retries on the rare collision.
 */
async function generateMembershipId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    // Build 12 random digits
    const digits = Array.from({ length: 12 }, () => crypto.randomInt(0, 10)).join('');
    const existing = await AudienceUser.findOne({ where: { membership_id: digits } });
    if (!existing) return digits;
  }
  throw new Error('Could not generate a unique membership ID after 10 attempts');
}

// ─── Profile management ───────────────────────────────────────────────────────

/** Helper: build safe user payload to return to the client */
function buildUserPayload(user: AudienceUser) {
  const points = user.points_total ?? 0;
  return {
    id: user.id,
    email_address: user.email_address,
    first_name: user.first_name,
    last_name: user.last_name,
    contact_number: user.contact_number,
    profile_photo_url: user.profile_photo_url,
    membership_id: user.membership_id,
    email_verified: user.email_verified ?? false,
    terms_accepted_at: user.terms_accepted_at ?? null,
    privacy_accepted_at: user.privacy_accepted_at ?? null,
    age_confirmed_at: user.age_confirmed_at ?? null,
    points_total: points,
    card_level: getCardLevel(points),
    referral_code: user.referral_code ?? null,
    // Extended profile
    city: user.city ?? null,
    country: user.country ?? null,
    date_of_birth: user.date_of_birth ?? null,
    gender_identity: user.gender_identity ?? null,
    music_genres: user.music_genres ?? null,
    event_frequency: user.event_frequency ?? null,
    profile_complete: isProfileComplete(user),
  };
}

export const audienceUpdateProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    const { first_name, last_name, contact_number, city, country, date_of_birth, gender_identity, music_genres, event_frequency } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Validate music_genres if provided
    if (music_genres !== undefined && !Array.isArray(music_genres)) {
      return res.status(400).json({ error: 'music_genres must be an array' });
    }

    // Validate gender_identity if provided
    const validGenders = ['male', 'female', 'non_binary', 'prefer_not_to_say'];
    if (gender_identity && !validGenders.includes(gender_identity)) {
      return res.status(400).json({ error: 'Invalid gender_identity value' });
    }

    // Validate event_frequency if provided
    const validFrequencies = ['weekly', 'monthly', 'occasionally', 'rarely'];
    if (event_frequency && !validFrequencies.includes(event_frequency)) {
      return res.status(400).json({ error: 'Invalid event_frequency value' });
    }

    const wasComplete = isProfileComplete(user);

    await user.update({
      first_name,
      last_name,
      contact_number: contact_number || null,
      city: city || null,
      country: country || null,
      date_of_birth: date_of_birth || null,
      gender_identity: gender_identity || null,
      music_genres: music_genres || null,
      event_frequency: event_frequency || null,
    });

    // Award profile completion points if this save completes the profile for the first time.
    // Must be awaited before reloading the user so the updated points_total is reflected.
    if (!wasComplete && isProfileComplete(user)) {
      await awardProfileCompletePoints(user.id);
    }

    // Reload to get updated points_total
    const freshUser = await AudienceUser.findByPk(user.id);
    return res.json(buildUserPayload(freshUser ?? user));
  } catch (error) {
    console.error('Audience updateProfile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Multer for profile photo uploads (images only, 5 MB max, stored in memory for S3 upload)
export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const audienceAcceptTerms = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    const { terms_accepted, privacy_accepted, age_confirmed } = req.body;

    if (!terms_accepted) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions' });
    }
    if (!privacy_accepted) {
      return res.status(400).json({ error: 'You must accept the Privacy Policy' });
    }
    if (!age_confirmed) {
      return res.status(400).json({ error: 'You must confirm you are at least 13 years old' });
    }

    const now = new Date();
    await user.update({
      terms_accepted_at: user.terms_accepted_at ?? now,
      privacy_accepted_at: user.privacy_accepted_at ?? now,
      age_confirmed_at: user.age_confirmed_at ?? now,
    });

    return res.json(buildUserPayload(user));
  } catch (error) {
    console.error('Audience acceptTerms error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceInviteFriend = async (req: Request, res: Response) => {
  try {
    const sender = (req as any).audienceUser as AudienceUser;
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const referralLink = `${process.env.AUDIENCE_APP_URL}/login?ref=${sender.referral_code}&email=${encodeURIComponent(email.trim())}`;
    const senderName = sender.first_name
      ? `${sender.first_name}${sender.last_name ? ' ' + sender.last_name : ''}`
      : 'A friend';

    await sendAudienceEmail(
      email.trim(),
      `${senderName} invited you to Your Scene`,
      `
      <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; max-width: 560px; margin: 0 auto;">
        <img src="${process.env.AUDIENCE_APP_URL}/assets/logo-dark-bg.png" alt="Your Scene" style="height: 28px; margin-bottom: 32px;">
        <p style="font-size: 13px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px;">— you've been invited —</p>
        <h1 style="font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0 0 16px;">${senderName} wants you on Your Scene.</h1>
        <p style="font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 32px;">
          Discover local shows and engage with your music community. Keep track of your tickets and earn points for more perks all in one place.
          <br><br>
          Sign up with the link below and you'll both be rewarded.
        </p>
        <a href="${referralLink}" style="display: inline-block; background: #facc15; color: #000; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; padding: 14px 28px; text-decoration: none;">
          Join Your Scene →
        </a>
        <p style="margin-top: 32px; font-size: 11px; color: rgba(255,255,255,0.2);">
          Or copy this link: ${referralLink}
        </p>
      </div>
      `,
    );

    return res.json({ message: 'Invite sent.' });
  } catch (error) {
    console.error('audienceInviteFriend error:', error);
    return res.status(500).json({ error: 'Failed to send invite.' });
  }
};

// ─── Email preferences ────────────────────────────────────────────────────────

/** Helper: find or create the preference row for a user, defaulting all to true */
async function getOrCreateEmailPreference(audienceUserId: number): Promise<AudienceEmailPreference> {
  const [pref] = await AudienceEmailPreference.findOrCreate({
    where: { audience_user_id: audienceUserId },
    defaults: {
      audience_user_id: audienceUserId,
      marketing_promos: true,
      event_recommendations: true,
      organizer_updates: true,
      points_rewards: true,
    },
  });
  return pref;
}

export const audienceGetEmailPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    const pref = await getOrCreateEmailPreference(user.id);
    return res.json({
      marketing_promos: pref.marketing_promos,
      event_recommendations: pref.event_recommendations,
      organizer_updates: pref.organizer_updates,
      points_rewards: pref.points_rewards,
    });
  } catch (error) {
    console.error('audienceGetEmailPreferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceUpdateEmailPreferences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    const { marketing_promos, event_recommendations, organizer_updates, points_rewards } = req.body;

    const pref = await getOrCreateEmailPreference(user.id);

    await pref.update({
      marketing_promos: marketing_promos !== undefined ? !!marketing_promos : pref.marketing_promos,
      event_recommendations: event_recommendations !== undefined ? !!event_recommendations : pref.event_recommendations,
      organizer_updates: organizer_updates !== undefined ? !!organizer_updates : pref.organizer_updates,
      points_rewards: points_rewards !== undefined ? !!points_rewards : pref.points_rewards,
    });

    return res.json({
      marketing_promos: pref.marketing_promos,
      event_recommendations: pref.event_recommendations,
      organizer_updates: pref.organizer_updates,
      points_rewards: pref.points_rewards,
    });
  } catch (error) {
    console.error('audienceUpdateEmailPreferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const audienceUploadProfilePhoto = async (req: Request, res: Response) => {
  try {
    const user = (req as any).audienceUser as AudienceUser;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = mimeExtension(file.mimetype) || 'jpg';
    const key = `audience-profiles/${user.id}-${Date.now()}.${ext}`;

    await uploadToS3({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    const profile_photo_url = getS3PublicUrl(process.env.S3_BUCKET!, key);

    // Delete old profile photo from S3 before updating
    if (user.profile_photo_url) {
      try {
        const oldUrl = new URL(user.profile_photo_url);
        const oldKey = oldUrl.pathname.substring(1);
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: oldKey });
      } catch (deleteError) {
        console.error('Failed to delete old profile photo from S3:', deleteError);
      }
    }

    await user.update({ profile_photo_url });

    return res.json(buildUserPayload(user));
  } catch (error) {
    console.error('Audience uploadProfilePhoto error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
