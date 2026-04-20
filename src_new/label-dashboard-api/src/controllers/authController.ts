import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { User, Brand, Domain, LoginAttempt } from '../models';
import { sendEmail, sendLoginNotification, sendAdminFailedLoginAlert } from '../utils/emailService';
import { getBrandIdFromDomain, getBrandFrontendUrl } from '../utils/brandUtils';
import { verifyPassword, migrateUserPassword, hashPassword, validatePassword } from '../utils/passwordUtils';
import { generateSecureToken } from '../utils/tokenUtils';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';

// ─── One-time OAuth exchange code store ──────────────────────────────────────
// Tokens are never placed in redirect URLs (logs, browser history, Referer leakage).
// Instead the callback issues a short-lived opaque code; the frontend POSTs it to
// POST /auth/ticketing/google/exchange to receive the actual JWT over a normal JSON
// response body.  Codes are single-use and expire after 5 minutes.

interface ExchangeEntry {
  userId: number;
  brandId: number;
  profileIncomplete: boolean;
  needsTerms: boolean;
  needsBrandName: boolean;
  expiresAt: number;
}
const oauthExchangeCodes = new Map<string, ExchangeEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of oauthExchangeCodes) {
    if (entry.expiresAt < now) oauthExchangeCodes.delete(code);
  }
}, 60_000);

function createExchangeCode(entry: Omit<ExchangeEntry, 'expiresAt'>): string {
  const code = crypto.randomBytes(32).toString('hex');
  oauthExchangeCodes.set(code, { ...entry, expiresAt: Date.now() + 5 * 60 * 1000 });
  return code;
}

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password, brand_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    // Find user by username or email and brand_id (matching PHP logic)
    let user = await User.findOne({
      where: { username, brand_id: brand_id || 1 },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      // Try by email if username lookup failed (matching PHP logic)
      user = await User.findOne({
        where: { email_address: username, brand_id: brand_id || 1 },
        include: [{ model: Brand, as: 'brand' }]
      });
    }

    // Check login lock (matching PHP logic) - only if user exists
    if (user) {
      const isLocked = await checkLoginLock(user.id);
      if (isLocked) {
        await sendAdminFailedLoginAlert(user.username || user.email_address, remoteIp, proxyIp, user.brand_id);
        const lockTimeMinutes = Math.ceil(parseInt(process.env.LOCK_TIME_IN_SECONDS || '120') / 60);
        return res.status(423).json({
          error: `Account temporarily locked due to too many failed logins. Please try again in ${lockTimeMinutes} minutes.`
        });
      }
    }

    // Verify password with automatic MD5 → bcrypt migration
    let isValidPassword = false;
    let needsMigration = false;

    if (user) {
      const verification = await verifyPassword(password, user);
      isValidPassword = verification.isValid;
      needsMigration = verification.needsMigration;
    }

    // Generic error for both "user not found" and "invalid password"
    // This prevents user enumeration attacks
    if (!user || !isValidPassword) {
      // Only record failed login attempt if user exists (can't log for non-existent users)
      if (user) {
        await LoginAttempt.create({
          user_id: user.id,
          status: 'Failed',
          date_and_time: new Date(),
          brand_id: user.brand_id,
          proxy_ip: proxyIp,
          remote_ip: remoteIp
        });
      }

      // Log detailed reason server-side for debugging
      console.warn('Login failed', {
        username,
        brand_id,
        reason: !user ? 'user_not_found' : 'invalid_password',
        ip: remoteIp,
        timestamp: new Date()
      });

      // Return same generic message for both cases
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Record successful login attempt (matching PHP logic)
    await LoginAttempt.create({
      user_id: user.id,
      status: 'Successful',
      date_and_time: new Date(),
      brand_id: user.brand_id,
      proxy_ip: proxyIp,
      remote_ip: remoteIp
    });

    // Migrate from MD5 to bcrypt if needed (lazy migration)
    if (needsMigration) {
      await migrateUserPassword(user, password);
    }

    // Check if user has password but no username (incomplete profile)
    // This happens when user resets password before accepting invite
    if (!user.username) {
      // Generate a temporary JWT for profile completion
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }

      const tempToken = jwt.sign(
        { userId: user.id, email: user.email_address, brandId: user.brand_id, profileIncomplete: true },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Shorter expiry for incomplete profiles
      );

      return res.status(200).json({
        status: 'profile_incomplete',
        message: 'Please complete your profile by setting a username',
        token: tempToken,
        user: {
          id: user.id,
          email_address: user.email_address,
          first_name: user.first_name,
          last_name: user.last_name,
          brand_id: user.brand_id
        }
      });
    }

    // Update last login time
    await user.update({ last_logged_in: new Date() });

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send login success notification (matching PHP logic)
    sendLoginNotification(
      user.email_address,
      user.first_name || '',
      remoteIp,
      proxyIp,
      user.brand_id
    ).catch(error => {
      console.error('Failed to send login notification:', error);
      // Don't fail login if email fails
    });

    // Check if user is superadmin based on admin email env variable
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperadmin = adminEmail && user.email_address === adminEmail;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        is_superadmin: isSuperadmin,
        brand_id: user.brand_id,
        onboarding_completed: user.onboarding_completed || false
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logout successful' });
};

export const checkAuth = async (req: any, res: Response) => {
  try {
    const user = req.user;
    
    // Check if user is superadmin based on admin email env variable
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperadmin = adminEmail && user.email_address === adminEmail;
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        is_superadmin: isSuperadmin,
        brand_id: user.brand_id,
        onboarding_completed: user.onboarding_completed || false
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get brand ID from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    console.log('Referer URL:', refererUrl);
    
    if (!refererUrl) {
      return res.status(400).json({ error: 'Unable to determine frontend domain from request' });
    }
    
    let brandId = await getBrandIdFromDomain(refererUrl);

    // In dev, both apps share the same hostname (localhost) so the port is the only
    // differentiator — but getBrandIdFromDomain strips ports.  If the referer origin
    // matches TICKETING_FRONTEND_URL, use TICKETING_PARENT_BRAND_ID directly.
    const ticketingFrontendUrl = process.env.TICKETING_FRONTEND_URL;
    const ticketingParentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (ticketingFrontendUrl && ticketingParentBrandId) {
      try {
        if (new URL(refererUrl).origin === new URL(ticketingFrontendUrl).origin) {
          brandId = ticketingParentBrandId;
        }
      } catch {}
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Invalid domain or brand not found' });
    }

    // Include sub-brands in the search so that organizer sub-brand users
    // (whose brand_id differs from the domain's brand_id) can still reset their password
    const subBrands = await Brand.findAll({ where: { parent_brand: brandId }, attributes: ['id'] });
    const brandIds = [brandId, ...subBrands.map((b: any) => b.id)];

    // Find user by email across this brand and its sub-brands
    const user = await User.findOne({
      where: {
        email_address: email,
        brand_id: brandIds
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    // Only process reset if user exists, but always return same message
    // This prevents email enumeration attacks
    if (user) {
      // Generate cryptographically secure reset token
      const resetHash = generateSecureToken();

      // Save reset hash to user (no expiry like original)
      await user.update({
        reset_hash: resetHash
      });

      // Use the domain-resolved brand for email branding so that organizer sub-brand
      // users (who have no logo on their own brand) get the parent platform's branding
      const emailBrand = await Brand.findByPk(brandId);

      // Send reset email using the same function as original PHP
      await sendResetLink(
        user.email_address,
        resetHash,
        emailBrand?.brand_name || user.brand?.brand_name || 'Label Dashboard',
        emailBrand?.brand_color || user.brand?.brand_color || '#5fbae9',
        emailBrand?.logo_url || user.brand?.logo_url || '',
        brandId,
        refererUrl // Pass the frontend domain
      ).catch(error => {
        console.error('Failed to send reset email:', error);
        // Don't expose email failure to client
      });

      // Send admin notification (matching original PHP)
      await sendAdminNotification(user, req.ip || 'unknown', req.get('X-Forwarded-For') || 'unknown')
        .catch(error => {
          console.error('Failed to send admin notification:', error);
        });
    } else {
      // Log the attempt server-side for monitoring
      console.warn('Password reset requested for non-existent email', {
        email,
        brand_id: brandId,
        ip: req.ip,
        timestamp: new Date()
      });
    }

    // Always return success message regardless of whether email exists
    // This prevents attackers from enumerating valid email addresses
    res.json({
      message: 'If an account exists with this email address, password reset instructions have been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const completeProfile = async (req: Request, res: Response) => {
  try {
    const { username, first_name, last_name, terms_accepted, brand_name } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Verify token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if this is a profile-incomplete token
    if (!decoded.profileIncomplete) {
      return res.status(400).json({ error: 'This endpoint is only for completing incomplete profiles' });
    }

    // Find user
    const user = await User.findByPk(decoded.userId, {
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has a username (prevent abuse)
    if (user.username) {
      return res.status(400).json({ error: 'Profile is already complete' });
    }

    // Check if username is already taken.
    // For ticketing users (brand is the ticketing parent or a sub-brand of it), usernames
    // must be unique across the entire ticketing hierarchy. For main-dashboard users,
    // uniqueness is scoped to their own brand.
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    const userBrand: any = user.get('brand') as any;
    const isTicketingUser = parentBrandId > 0 && (
      user.brand_id === parentBrandId ||
      userBrand?.parent_brand === parentBrandId
    );

    let usernameBrandScope: number | number[] = user.brand_id;
    if (isTicketingUser) {
      const ticketingSubBrands = await Brand.findAll({ where: { parent_brand: parentBrandId }, attributes: ['id'] });
      usernameBrandScope = [parentBrandId, ...ticketingSubBrands.map((b: any) => b.id)];
    }

    const existingUser = await User.findOne({
      where: { username, brand_id: usernameBrandScope }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-30 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'
      });
    }

    // Update user with username, optional names, and optional terms acceptance
    const updates: any = {
      username: username.trim(),
      first_name: first_name?.trim() || user.first_name,
      last_name: last_name?.trim() || user.last_name,
      last_logged_in: new Date()
    };
    if (terms_accepted === true && !user.terms_accepted_at) {
      updates.terms_accepted_at = new Date();
    }
    await user.update(updates);

    // Update brand name if provided (for new Google signups that haven't set it yet)
    if (brand_name && typeof brand_name === 'string' && brand_name.trim()) {
      await Brand.update({ brand_name: brand_name.trim() }, { where: { id: user.brand_id } });
    }

    // Generate full JWT token now that profile is complete
    const fullToken = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Check if user is superadmin
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperadmin = adminEmail && user.email_address === adminEmail;

    res.json({
      message: 'Profile completed successfully',
      token: fullToken,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        is_superadmin: isSuperadmin,
        brand_id: user.brand_id,
        onboarding_completed: user.onboarding_completed || false
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password against security requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: validation.errors
      });
    }

    // Find user with valid reset hash (no expiry check like original PHP)
    const user = await User.findOne({
      where: {
        reset_hash: token
      }
    });

    if (!user) {
      // Log server-side for monitoring
      console.warn('Invalid reset token used', {
        token,
        ip: req.ip,
        timestamp: new Date()
      });

      // Generic error message
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password with bcrypt (migrate to strong encryption)
    const hashedPassword = await hashPassword(password);

    // Update user password with bcrypt and clear reset hash
    // Clear old MD5 hash if it exists
    await user.update({
      password_hash: hashedPassword,
      password_md5: null,
      reset_hash: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const loginUnified = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    // Find ALL users matching username or email across all brands
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username },
          { email_address: username }
        ]
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const lockedUsers: any[] = [];
    const matchedUsers: { user: any; needsMigration: boolean }[] = [];

    const results = await Promise.all(users.map(async (user) => {
      const isLocked = await checkLoginLock(user.id);
      if (isLocked) {
        sendAdminFailedLoginAlert(user.username || user.email_address, remoteIp, proxyIp, user.brand_id).catch(() => {});
        return { user, locked: true, isValid: false, needsMigration: false };
      }

      const { isValid, needsMigration } = await verifyPassword(password, user);
      if (!isValid && user.brand_id) {
        LoginAttempt.create({
          user_id: user.id,
          status: 'Failed',
          date_and_time: new Date(),
          brand_id: user.brand_id,
          proxy_ip: proxyIp,
          remote_ip: remoteIp
        }).catch(() => {});
      }
      return { user, locked: false, isValid, needsMigration };
    }));

    for (const result of results) {
      if (result.locked) {
        lockedUsers.push(result.user);
      } else if (result.isValid) {
        matchedUsers.push({ user: result.user, needsMigration: result.needsMigration });
      }
    }

    // All found users are locked (none unlocked to attempt password)
    if (matchedUsers.length === 0 && lockedUsers.length === users.length) {
      const lockTimeMinutes = Math.ceil(parseInt(process.env.LOCK_TIME_IN_SECONDS || '120') / 60);
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed logins. Please try again in ${lockTimeMinutes} minutes.`
      });
    }

    if (matchedUsers.length === 0) {
      console.warn('Login failed (unified)', { username, reason: 'invalid_password', ip: remoteIp, timestamp: new Date() });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (matchedUsers.length === 1) {
      const { user, needsMigration } = matchedUsers[0];
      return await completeLoginForUser(user, remoteIp, proxyIp, res, needsMigration, password);
    }

    // Multiple password matches — return brand selection token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const matches = matchedUsers.map(({ user }) => ({ userId: user.id, brandId: user.brand_id }));
    const selectionToken = jwt.sign(
      { type: 'brand_selection', matches },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const brands = matchedUsers.map(({ user }) => ({
      id: user.brand_id,
      name: user.brand?.brand_name || 'Unknown',
      logo_url: user.brand?.logo_url || null,
      brand_color: user.brand?.brand_color || null
    }));

    return res.status(200).json({
      status: 'brand_selection',
      brands,
      selection_token: selectionToken
    });

  } catch (error) {
    console.error('Login unified error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const selectBrand = async (req: Request, res: Response) => {
  try {
    const { selection_token, brand_id } = req.body;

    if (!selection_token || brand_id === undefined) {
      return res.status(400).json({ error: 'Selection token and brand ID are required' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(selection_token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired selection token' });
    }

    if (decoded.type !== 'brand_selection' || !Array.isArray(decoded.matches)) {
      return res.status(400).json({ error: 'Invalid selection token type' });
    }

    const match = decoded.matches.find((m: any) => m.brandId === brand_id);
    if (!match) {
      return res.status(400).json({ error: 'Invalid brand selection' });
    }

    const user = await User.findByPk(match.userId, {
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    return await completeLoginForUser(user, remoteIp, proxyIp, res);

  } catch (error) {
    console.error('Select brand error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Shared helper to complete login and send response
async function completeLoginForUser(
  user: any,
  remoteIp: string,
  proxyIp: string,
  res: Response,
  needsMigration: boolean = false,
  plainPassword: string = ''
): Promise<any> {
  // Record successful login attempt
  await LoginAttempt.create({
    user_id: user.id,
    status: 'Successful',
    date_and_time: new Date(),
    brand_id: user.brand_id,
    proxy_ip: proxyIp,
    remote_ip: remoteIp
  });

  // Migrate from MD5 to bcrypt if needed
  if (needsMigration && plainPassword) {
    await migrateUserPassword(user, plainPassword);
  }

  // Check if profile is incomplete
  if (!user.username) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email_address, brandId: user.brand_id, profileIncomplete: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    return res.status(200).json({
      status: 'profile_incomplete',
      message: 'Please complete your profile by setting a username',
      token: tempToken,
      user: {
        id: user.id,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        brand_id: user.brand_id
      }
    });
  }

  await user.update({ last_logged_in: new Date() });

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, brandId: user.brand_id },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  sendLoginNotification(
    user.email_address,
    user.first_name || '',
    remoteIp,
    proxyIp,
    user.brand_id
  ).catch(error => {
    console.error('Failed to send login notification:', error);
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const isSuperadmin = adminEmail && user.email_address === adminEmail;

  // Resolve brand frontend URL for cross-origin redirects (e.g. spindly.app login)
  let frontendUrl: string | null = null;
  try {
    frontendUrl = await getBrandFrontendUrl(user.brand_id);
  } catch {
    // No domain configured — omit from response
  }

  return res.json({
    message: 'Login successful',
    token,
    frontend_url: frontendUrl,
    user: {
      id: user.id,
      username: user.username,
      email_address: user.email_address,
      first_name: user.first_name,
      last_name: user.last_name,
      is_admin: user.is_admin,
      is_superadmin: isSuperadmin,
      brand_id: user.brand_id,
      brand_name: user.brand?.brand_name || null,
      onboarding_completed: user.onboarding_completed || false
    }
  });
}

export const organizerSignup = async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, brand_name, terms_accepted } = req.body;

    if (!full_name || !email || !password || !brand_name) {
      return res.status(400).json({ error: 'full_name, email, password, and brand_name are required' });
    }

    if (!terms_accepted) {
      return res.status(400).json({ error: 'You must accept the terms and conditions to register' });
    }

    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    console.log('[organizerSignup] TICKETING_PARENT_BRAND_ID:', process.env.TICKETING_PARENT_BRAND_ID, '→ parsed:', parentBrandId);
    if (!parentBrandId) {
      throw new Error('TICKETING_PARENT_BRAND_ID environment variable is required');
    }

    // Check for duplicate email within ticketing brands only (parent + all sub-brands)
    // Users on unrelated brands can share the same email — login is scoped to ticketing brands anyway
    const ticketingSubBrandIds = (await Brand.findAll({ where: { parent_brand: parentBrandId }, attributes: ['id'] })).map(b => b.id);
    const ticketingBrandIds = [parentBrandId, ...ticketingSubBrandIds];
    console.log('[organizerSignup] ticketingBrandIds:', ticketingBrandIds);
    const existingUser = await User.findOne({
      where: { email_address: email.toLowerCase().trim(), brand_id: ticketingBrandIds }
    });
    console.log('[organizerSignup] existingUser:', existingUser ? `id=${existingUser.id} brand_id=${existingUser.brand_id}` : 'none');
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Split full_name into first and last
    const nameParts = full_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || '';

    // Create a new sub-brand under the configured parent
    const newBrand = await Brand.create({
      brand_name: brand_name.trim(),
      parent_brand: parentBrandId,
      brand_color: '#6366f1',
      feature_music_workspace: false,
      feature_campaigns_workspace: false,
    });

    // Copy the parent brand's primary domain to the new organizer brand so that
    // getBrandFrontendUrl works for event verification/buy links
    const parentDomain = await Domain.findOne({
      where: { brand_id: parentBrandId, is_primary: true },
    }) || await Domain.findOne({
      where: { brand_id: parentBrandId },
      order: [['is_primary', 'DESC']],
    });
    if (parentDomain) {
      await Domain.create({
        brand_id: newBrand.id,
        domain_name: parentDomain.domain_name,
        status: parentDomain.status,
        is_primary: true,
      });
    }

    // Hash password with bcrypt
    const password_hash = await hashPassword(password);

    // Create admin user for the new brand (no username yet — set in complete-profile step)
    const newUser = await User.create({
      email_address: email.toLowerCase().trim(),
      password_hash,
      first_name,
      last_name,
      brand_id: newBrand.id,
      is_admin: true,
      is_system_user: false,
      onboarding_completed: false,
      terms_accepted_at: new Date(),
    });

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // Return profile_incomplete so the frontend redirects to the username-setup step
    const tempToken = jwt.sign(
      { userId: newUser.id, email: newUser.email_address, brandId: newUser.brand_id, profileIncomplete: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(201).json({
      status: 'profile_incomplete',
      message: 'Account created. Please set your username to continue.',
      token: tempToken,
      user: {
        id: newUser.id,
        email_address: newUser.email_address,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        brand_id: newUser.brand_id,
      },
      needs_terms: false,
    });
  } catch (error) {
    console.error('Organizer signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const organizerLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId) {
      throw new Error('TICKETING_PARENT_BRAND_ID environment variable is required');
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    // Find user by email globally
    const user = await User.findOne({
      where: { email_address: email.toLowerCase().trim() },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check login lock
    const isLocked = await checkLoginLock(user.id);
    if (isLocked) {
      const lockTimeMinutes = Math.ceil(parseInt(process.env.LOCK_TIME_IN_SECONDS || '120') / 60);
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed logins. Please try again in ${lockTimeMinutes} minutes.`
      });
    }

    // Verify password
    const { isValid, needsMigration } = await verifyPassword(password, user);
    if (!isValid) {
      await LoginAttempt.create({
        user_id: user.id,
        status: 'Failed',
        date_and_time: new Date(),
        brand_id: user.brand_id,
        proxy_ip: proxyIp,
        remote_ip: remoteIp
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Ensure the user belongs to the configured parent brand or one of its sub-brands
    const isParentBrand = user.brand_id === parentBrandId;
    const isSubBrand = user.brand?.parent_brand === parentBrandId;

    if (!isParentBrand && !isSubBrand) {
      return res.status(403).json({ error: 'Not an organizer account' });
    }

    return await completeLoginForUser(user, remoteIp, proxyIp, res, needsMigration, password);
  } catch (error) {
    console.error('Organizer login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Google OAuth (server-side redirect flow) ─────────────────────────────────
//
// The browser navigates to GET /auth/ticketing/google which redirects to Google.
// Google redirects back to GET /auth/ticketing/google/callback with an auth code.
// The backend exchanges the code for user info, then redirects the browser back to
// the frontend with a short-lived one-time exchange code in the query string.
// The frontend POSTs that code to POST /auth/ticketing/google/exchange to get the JWT —
// keeping all tokens out of URLs, logs, and browser history.
//
// The GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET never leave the server.
// To add Google Sign-In to the main dashboard in the future, create equivalent
// organizerGoogleRedirect / organizerGoogleCallback functions scoped to the desired brand.

/**
 * Derive the ticketing frontend base URL for post-auth redirects.
 * Priority:
 *   1. TICKETING_FRONTEND_URL env var — set this for local dev (http://localhost:4201)
 *      and for any deployment where the frontend URL differs from the brand DB domain.
 *   2. Parent brand's primary domain from the DB — used in production when the env var
 *      is not set.
 *   3. Hard-coded localhost fallback.
 */
async function getTicketingFrontendUrl(): Promise<string> {
  if (process.env.TICKETING_FRONTEND_URL) return process.env.TICKETING_FRONTEND_URL;
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (parentBrandId) return await getBrandFrontendUrl(parentBrandId);
  } catch {}
  return 'http://localhost:4201';
}

/**
 * Step 1 — redirect the browser to Google's OAuth consent screen.
 * The frontend URL that initiated the request is encoded in a signed state token
 * so the callback knows where to send the user back to.
 */
export const organizerGoogleRedirect = async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(501).json({ error: 'Google Sign-In is not configured on this server' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // Sign only a nonce into the state param for CSRF protection.
    // frontendUrl is intentionally NOT included here — it is derived server-side in the
    // callback from the brand config.  Including a client-supplied origin would allow an
    // attacker to spoof the Origin header and redirect the victim's token to their domain.
    const state = jwt.sign(
      { nonce: crypto.randomBytes(16).toString('hex') },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/ticketing/google/callback`;

    const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleUrl.searchParams.set('client_id', clientId);
    googleUrl.searchParams.set('redirect_uri', redirectUri);
    googleUrl.searchParams.set('response_type', 'code');
    googleUrl.searchParams.set('scope', 'openid email profile');
    googleUrl.searchParams.set('state', state);
    googleUrl.searchParams.set('access_type', 'online');

    return res.redirect(googleUrl.toString());
  } catch (error) {
    console.error('Google redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Step 2 — handle Google's redirect back to the server.
 * Exchanges the auth code for user info, finds or creates the organizer account,
 * then redirects the browser back to the frontend with a short-lived one-time
 * exchange code.  The frontend redeems that code via POST /auth/ticketing/google/exchange.
 */
export const organizerGoogleCallback = async (req: Request, res: Response) => {
  const { code, state, error: googleError } = req.query as Record<string, string>;

  // Always derive frontendUrl from brand config — never from state or any client-supplied
  // value.  This prevents open-redirect attacks where a spoofed Origin header encodes a
  // malicious URL into the state and the callback redirects the victim's token there.
  const frontendUrl = await getTicketingFrontendUrl();

  if (state && process.env.JWT_SECRET) {
    try {
      jwt.verify(state, process.env.JWT_SECRET); // verify CSRF nonce only
    } catch {
      // State expired or tampered — redirect to login with error
      return res.redirect(`${frontendUrl}/app/login?error=invalid_state`);
    }
  }

  if (googleError) {
    // User cancelled or denied access
    return res.redirect(`${frontendUrl}/app/login?error=google_cancelled`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/app/login?error=missing_code`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${serverUrl}/api/auth/ticketing/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    // Fetch the user's profile from Google
    const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const { sub: googleId, email, email_verified, given_name = '', family_name = '', name = '' } = userInfoRes.data;

    if (!email_verified) {
      return res.redirect(`${frontendUrl}/app/login?error=google_unverified_email`);
    }

    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId) throw new Error('TICKETING_PARENT_BRAND_ID environment variable is required');

    // Collect all ticketing brand IDs (parent + sub-brands)
    const subBrands = await Brand.findAll({ where: { parent_brand: parentBrandId }, attributes: ['id'] });
    const ticketingBrandIds = [parentBrandId, ...subBrands.map((b: any) => b.id)];

    // Find existing user by google_id first, then fall back to email match
    let user = await User.findOne({
      where: { google_id: googleId, brand_id: ticketingBrandIds },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      user = await User.findOne({
        where: { email_address: email, brand_id: ticketingBrandIds },
        include: [{ model: Brand, as: 'brand' }]
      });
      if (user) {
        await user.update({ google_id: googleId });
      }
    }

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    if (user) {
      // Existing organizer — issue a one-time exchange code redeemed by the frontend
      if (!user.username) {
        const exchangeCode = createExchangeCode({ userId: user.id, brandId: user.brand_id, profileIncomplete: true, needsTerms: false, needsBrandName: false });
        return res.redirect(`${frontendUrl}/app/google-callback?code=${exchangeCode}`);
      }

      await user.update({ last_logged_in: new Date() });
      const exchangeCode = createExchangeCode({ userId: user.id, brandId: user.brand_id, profileIncomplete: false, needsTerms: false });
      return res.redirect(`${frontendUrl}/app/google-callback?code=${exchangeCode}`);
    }

    // ── New organizer: create brand + user ──────────────────────────────────
    const newBrand = await Brand.create({
      brand_name: `${name}'s Events`,
      parent_brand: parentBrandId,
      brand_color: '#6366f1',
      feature_music_workspace: false,
      feature_campaigns_workspace: false,
    });

    // Copy parent brand domain so getBrandFrontendUrl works for this sub-brand
    const parentDomain = await Domain.findOne({ where: { brand_id: parentBrandId, is_primary: true } })
      || await Domain.findOne({ where: { brand_id: parentBrandId }, order: [['is_primary', 'DESC']] });
    if (parentDomain) {
      await Domain.create({
        brand_id: newBrand.id,
        domain_name: parentDomain.domain_name,
        status: parentDomain.status,
        is_primary: true,
      });
    }

    const newUser = await User.create({
      email_address: email,
      google_id: googleId,
      first_name: given_name,
      last_name: family_name,
      brand_id: newBrand.id,
      is_admin: true,
      is_system_user: false,
      onboarding_completed: false,
      // No username or terms_accepted_at yet — both collected in the complete-profile step
    });

    const exchangeCode = createExchangeCode({ userId: newUser.id, brandId: newUser.brand_id, profileIncomplete: true, needsTerms: true, needsBrandName: true });
    return res.redirect(`${frontendUrl}/app/google-callback?code=${exchangeCode}`);
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${frontendUrl}/app/login?error=google_auth_failed`);
  }
};

/**
 * Step 3 — exchange the one-time code issued by the callback for a real JWT.
 * Called by the frontend immediately after the Google OAuth redirect lands.
 * The code is single-use and expires in 5 minutes.
 */
export const organizerGoogleExchange = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code is required' });
    }

    const entry = oauthExchangeCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired exchange code' });
    }
    oauthExchangeCodes.delete(code); // single-use — invalidate immediately

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

    const user = await User.findByPk(entry.userId, { include: [{ model: Brand, as: 'brand' }] });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (entry.profileIncomplete) {
      const tempToken = jwt.sign(
        { userId: user.id, email: user.email_address, brandId: user.brand_id, profileIncomplete: true },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.json({ status: 'profile_incomplete', token: tempToken, needs_terms: entry.needsTerms, needs_brand_name: entry.needsBrandName });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ token, user: { id: user.id, email_address: user.email_address, first_name: user.first_name, last_name: user.last_name, brand_id: user.brand_id, brand_name: user.brand?.brand_name || null } });
  } catch (error) {
    console.error('Google exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions matching original PHP implementation
async function sendResetLink(emailAddress: string, resetHash: string, brandName: string, brandColor: string, brandLogo: string, brandId: number, refererUrl: string): Promise<boolean> {
  const subject = "Here's the link to reset your password!";
  const emailContent = generateEmailFromTemplate(resetHash, brandName, brandColor, brandLogo, refererUrl);
  return await sendEmail([emailAddress], subject, emailContent, brandId);
}

function generateEmailFromTemplate(resetHash: string, brandName: string, brandColor: string, brandLogo: string, refererUrl: string): string {
  // refererUrl is now required - no fallback logic
  if (!refererUrl) {
    throw new Error('Frontend URL is required to generate reset password email');
  }

  let frontendBaseUrl: string;
  try {
    const url = new URL(refererUrl);
    frontendBaseUrl = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
  } catch (error) {
    throw new Error(`Invalid referer URL: ${refererUrl}`);
  }
  
  const resetUrl = `${frontendBaseUrl}/reset-password?code=${resetHash}`;
  console.log('Generated reset URL:', resetUrl);

  try {
    const templatePath = path.join(__dirname, '../assets/templates/reset_password_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables (matching original PHP)
    template = template.replace(/%LOGO%/g, brandLogo);
    template = template.replace(/%URL%/g, resetUrl);
    template = template.replace(/%BRAND_NAME%/g, brandName);
    template = template.replace(/%BRAND_COLOR%/g, brandColor);

    return template;
  } catch (error) {
    console.error('Error loading email template:', error);
    
    // Simple HTML email without fallback URL logic
    return `
      <html>
        <body>
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
        </body>
      </html>
    `;
  }
}

async function sendAdminNotification(user: any, remoteIp: string, proxyIp: string): Promise<boolean> {
  const subject = `Password reset requested for user ${user.username}`;
  const adminEmail = process.env.ADMIN_EMAIL;
  
  // Only send if admin email is configured
  if (!adminEmail) {
    console.log('No admin email configured for password reset notifications, skipping email');
    return false;
  }
  
  const body = `
    We've detected a password reset request for user <b>${user.username}</b>.<br>
    Remote login IP: ${remoteIp}<br>
    Proxy login IP: ${proxyIp}<br><br>
  `;
  
  return await sendEmail([adminEmail], subject, body, user.brand_id);
}

// Validate reset hash (matching original PHP fromResetHash validation)
export const validateResetHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ valid: false, error: 'Reset hash is required' });
    }

    // Get brand ID from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    console.log('Referer URL:', refererUrl);
    
    if (!refererUrl) {
      return res.status(400).json({ valid: false, error: 'Unable to determine frontend domain from request' });
    }
    
    let brandId = await getBrandIdFromDomain(refererUrl);

    // Same localhost/port fix as forgotPassword — ticketing app shares hostname with dashboard in dev
    const ticketingFrontendUrlForValidate = process.env.TICKETING_FRONTEND_URL;
    const ticketingParentBrandIdForValidate = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (ticketingFrontendUrlForValidate && ticketingParentBrandIdForValidate) {
      try {
        if (new URL(refererUrl).origin === new URL(ticketingFrontendUrlForValidate).origin) {
          brandId = ticketingParentBrandIdForValidate;
        }
      } catch {}
    }

    if (!brandId) {
      return res.status(400).json({ valid: false, error: 'Invalid domain or brand not found' });
    }

    // Include sub-brands so organizer sub-brand users can validate their reset hash
    const subBrandsForValidate = await Brand.findAll({ where: { parent_brand: brandId }, attributes: ['id'] });
    const brandIdsForValidate = [brandId, ...subBrandsForValidate.map((b: any) => b.id)];

    // Find user with valid reset hash across this brand and its sub-brands
    const user = await User.findOne({
      where: {
        reset_hash: hash,
        brand_id: brandIdsForValidate
      }
    });

    if (!user) {
      // Log server-side for monitoring
      console.warn('Invalid reset hash validation attempt', {
        hash,
        brand_id: brandId,
        ip: req.ip,
        timestamp: new Date()
      });

      // Generic error message to prevent hash enumeration
      return res.status(400).json({
        valid: false,
        error: 'Invalid or expired reset token'
      });
    }

    res.json({ valid: true, message: 'Reset hash is valid' });
  } catch (error) {
    console.error('Validate reset hash error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
};

// Helper function to check login lock (matching PHP logic)
async function checkLoginLock(userId: number): Promise<boolean> {
  try {
    const FAILED_LOGIN_LIMIT = parseInt(process.env.FAILED_LOGIN_LIMIT || '3');
    const LOCK_TIME_IN_SECONDS = parseInt(process.env.LOCK_TIME_IN_SECONDS || '120');

    // Get recent login attempts (matching PHP query)
    const recentAttempts = await LoginAttempt.findAll({
      where: { user_id: userId },
      order: [['date_and_time', 'DESC']],
      limit: FAILED_LOGIN_LIMIT
    });

    if (recentAttempts.length < FAILED_LOGIN_LIMIT) {
      return false;
    }

    // Check if we have enough failed attempts within the lock time window
    let failures = 0;
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - LOCK_TIME_IN_SECONDS * 1000);

    for (const attempt of recentAttempts) {
      if (attempt.status === 'Failed' && attempt.date_and_time > cutoffTime) {
        failures++;
      }
    }

    return failures >= FAILED_LOGIN_LIMIT;
  } catch (error) {
    console.error('Error checking login lock:', error);
    return false;
  }
}