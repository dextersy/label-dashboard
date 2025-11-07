import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, LoginAttempt } from '../models';
import { auditLogger } from '../utils/auditLogger';
import { sendAdminFailedLoginAlert } from '../utils/emailService';

/**
 * System User Authentication Controller
 *
 * Brand-independent authentication for system users only.
 * These users access cross-brand data for automated jobs and administrative tasks.
 *
 * Security features:
 * - Only accepts system users (is_system_user = true, brand_id = NULL)
 * - Shorter token expiry (1 hour vs 24 hours)
 * - Enhanced audit logging
 * - Login attempt tracking
 * - Failed login alerts
 * - Strong password validation
 */

/**
 * System user login
 * Only accepts users with is_system_user = true and brand_id = NULL
 */
export const systemLogin = async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      auditLogger.logAuthAttempt(req, false, email || 'unknown', 'Missing credentials');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    // Find system user by email OR username (no brand_id filter)
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email_address: email },
          { username: email }
        ],
        is_system_user: true,
        brand_id: null
      }
    });

    // Security: Don't reveal whether user exists
    if (!user) {
      auditLogger.logAuthAttempt(req, false, email, 'System user not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate system user configuration
    if (!user.isValidSystemUser()) {
      auditLogger.logAuthAttempt(req, false, email, 'Invalid system user configuration');
      return res.status(403).json({ error: 'Invalid system user configuration' });
    }

    // Check login lock
    const isLocked = await checkLoginLock(user.id);
    if (isLocked) {
      await sendAdminFailedLoginAlert(user.username || user.email_address, remoteIp, proxyIp, user.brand_id);
      const lockTimeMinutes = Math.ceil(parseInt(process.env.LOCK_TIME_IN_SECONDS || '120') / 60);

      auditLogger.logAuthAttempt(req, false, email, 'Account locked');

      return res.status(423).json({
        error: `Account temporarily locked due to too many failed logins. Please try again in ${lockTimeMinutes} minutes.`
      });
    }

    // Verify password (MD5 to match existing system)
    const isValidPassword = user.password_md5 === crypto.createHash('md5').update(password).digest('hex');

    if (!isValidPassword) {
      auditLogger.logAuthAttempt(req, false, email, 'Invalid password');

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login time
    await user.update({ last_logged_in: new Date() });

    // Generate JWT token with system scope
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // Token configuration for system users
    const tokenExpiry = (process.env.SYSTEM_TOKEN_EXPIRY || '1h') as string; // Default 1 hour

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username || user.email_address,
        email: user.email_address,
        isSystemUser: true,
        brandId: null,
        scope: 'system' // Explicitly mark as system token
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: tokenExpiry as string,
        issuer: 'system-auth'
      } as jwt.SignOptions
    );

    const duration = Date.now() - startTime;

    // Log successful authentication
    auditLogger.logAuthAttempt(req, true, email);
    auditLogger.logSystemAccess(req, 'SYSTEM_LOGIN', {
      userId: user.id,
      duration
    });

    res.json({
      message: 'System login successful',
      token,
      expiresIn: tokenExpiry,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_system_user: true
      }
    });

  } catch (error) {
    console.error('System login error:', error);
    auditLogger.logAuthAttempt(req, false, req.body.email || 'unknown', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Verify system user authentication status
 */
export const systemCheckAuth = async (req: any, res: Response) => {
  try {
    const user = req.user;

    // Verify system user status
    if (!user.is_system_user || user.brand_id !== null) {
      auditLogger.logSystemAccess(req, 'INVALID_SYSTEM_AUTH_CHECK');
      return res.status(403).json({ error: 'Not a valid system user' });
    }

    auditLogger.logSystemAccess(req, 'SYSTEM_AUTH_CHECK');

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_system_user: true
      }
    });
  } catch (error) {
    console.error('System check auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * System logout (invalidate token client-side)
 */
export const systemLogout = async (req: any, res: Response) => {
  try {
    auditLogger.logSystemAccess(req, 'SYSTEM_LOGOUT', {
      userId: req.user?.id
    });

    res.json({ message: 'System logout successful' });
  } catch (error) {
    console.error('System logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh system token (extend session)
 */
export const refreshSystemToken = async (req: any, res: Response) => {
  try {
    const user = req.user;

    // Verify system user status
    if (!user.is_system_user || user.brand_id !== null) {
      return res.status(403).json({ error: 'Not a valid system user' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const tokenExpiry = (process.env.SYSTEM_TOKEN_EXPIRY || '1h') as string;

    // Generate new token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username || user.email_address,
        email: user.email_address,
        isSystemUser: true,
        brandId: null,
        scope: 'system'
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: tokenExpiry as string,
        issuer: 'system-auth'
      } as jwt.SignOptions
    );

    auditLogger.logSystemAccess(req, 'SYSTEM_TOKEN_REFRESH', {
      userId: user.id
    });

    res.json({
      message: 'Token refreshed successfully',
      token,
      expiresIn: tokenExpiry
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to check login lock
async function checkLoginLock(userId: number): Promise<boolean> {
  try {
    const FAILED_LOGIN_LIMIT = parseInt(process.env.FAILED_LOGIN_LIMIT || '3');
    const LOCK_TIME_IN_SECONDS = parseInt(process.env.LOCK_TIME_IN_SECONDS || '120');

    const recentAttempts = await LoginAttempt.findAll({
      where: { user_id: userId },
      order: [['date_and_time', 'DESC']],
      limit: FAILED_LOGIN_LIMIT
    });

    if (recentAttempts.length < FAILED_LOGIN_LIMIT) {
      return false;
    }

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
