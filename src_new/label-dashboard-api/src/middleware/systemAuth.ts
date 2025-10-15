import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { auditLogger } from '../utils/auditLogger';

/**
 * System Authentication Middleware
 *
 * Enhanced security for system API endpoints that access cross-brand data.
 *
 * Security measures:
 * - Verifies JWT token
 * - Ensures user is marked as system user in database
 * - Validates system user constraints (NULL brand_id)
 * - Logs all access attempts
 * - Shorter token expiry enforcement
 * - Optional IP whitelisting
 */

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Authenticate system user token
 */
export const authenticateSystemUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    auditLogger.logAuthAttempt(req, false, 'unknown', 'No token provided');
    return res.status(401).json({ error: 'System access token required' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    // Security check: Token must have system scope
    if (!decoded.isSystemUser || decoded.scope !== 'system') {
      auditLogger.logAuthAttempt(req, false, decoded.email || 'unknown', 'Invalid token scope');
      return res.status(403).json({ error: 'System user token required' });
    }

    // Fetch user from database to verify current status
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      auditLogger.logAuthAttempt(req, false, decoded.email || 'unknown', 'User not found');
      return res.status(401).json({ error: 'Invalid token: user not found' });
    }

    // Security check: Verify user is actually a system user
    if (!user.is_system_user) {
      auditLogger.logAuthAttempt(req, false, user.email_address, 'User is not a system user');
      return res.status(403).json({ error: 'User is not authorized as system user' });
    }

    // Security check: System users MUST have NULL brand_id
    if (user.brand_id !== null) {
      auditLogger.logAuthAttempt(
        req,
        false,
        user.email_address,
        'System user has non-NULL brand_id'
      );
      return res.status(403).json({ error: 'Invalid system user configuration' });
    }

    // Validate using model method
    if (!user.isValidSystemUser()) {
      auditLogger.logAuthAttempt(
        req,
        false,
        user.email_address,
        'System user validation failed'
      );
      return res.status(403).json({ error: 'System user validation failed' });
    }

    // Optional: IP Whitelisting for production
    if (process.env.NODE_ENV === 'production' && process.env.SYSTEM_API_ALLOWED_IPS) {
      const allowedIps = process.env.SYSTEM_API_ALLOWED_IPS.split(',').map(ip => ip.trim());
      const requestIp = req.ip || 'unknown';

      if (!allowedIps.includes(requestIp)) {
        auditLogger.logAuthAttempt(
          req,
          false,
          user.email_address,
          `IP not whitelisted: ${requestIp}`
        );
        return res.status(403).json({ error: 'Access denied: IP not whitelisted' });
      }
    }

    // Attach user to request
    req.user = user;

    // Log successful authentication
    auditLogger.logAuthAttempt(req, true, user.email_address);

    next();
  } catch (error: any) {
    // Log failed authentication
    auditLogger.logAuthAttempt(req, false, 'unknown', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'System token expired' });
    }

    return res.status(403).json({ error: 'Invalid system token' });
  }
};

/**
 * Require system user access (use after authenticateSystemUser)
 */
export const requireSystemUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.is_system_user || req.user.brand_id !== null) {
    auditLogger.logSystemAccess(req, 'UNAUTHORIZED_ACCESS_ATTEMPT', {
      error: 'User is not a system user'
    });
    return res.status(403).json({ error: 'System user access required' });
  }

  next();
};

/**
 * Environment-based system API access control
 */
export const requireSystemApiEnabled = (req: Request, res: Response, next: NextFunction) => {
  // In production, require explicit enabling of system APIs
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_SYSTEM_API) {
    return res.status(503).json({
      error: 'System API is disabled. Set ENABLE_SYSTEM_API=true to enable.'
    });
  }

  next();
};

/**
 * Rate limiting specifically for system API
 * More restrictive than regular API rate limits
 */
export const systemApiRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const key = `system_api_${userId}`;
    const now = Date.now();

    let userRequests = requests.get(key);

    if (!userRequests || now > userRequests.resetTime) {
      // Reset window
      userRequests = {
        count: 1,
        resetTime: now + windowMs
      };
      requests.set(key, userRequests);
      return next();
    }

    if (userRequests.count >= maxRequests) {
      const resetIn = Math.ceil((userRequests.resetTime - now) / 1000);
      auditLogger.logSystemAccess(req, 'RATE_LIMIT_EXCEEDED');

      return res.status(429).json({
        error: 'System API rate limit exceeded',
        resetIn: `${resetIn} seconds`
      });
    }

    userRequests.count++;
    next();
  };
};
