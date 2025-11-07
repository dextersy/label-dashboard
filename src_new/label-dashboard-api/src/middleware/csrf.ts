import { Request, Response, NextFunction } from 'express';
import { Domain } from '../models';

/**
 * CSRF Protection Middleware
 *
 * Validates Origin/Referer headers for state-changing operations (POST, PUT, DELETE, PATCH)
 * to prevent Cross-Site Request Forgery attacks.
 *
 * This works in conjunction with CORS configuration to provide defense-in-depth.
 */

// Cache allowed origins to avoid database queries on every request
let allowedOriginsCache: Set<string> | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all allowed origins from the database (with caching)
 */
export const getAllowedOrigins = async (): Promise<Set<string>> => {
  const now = Date.now();

  // Return cached origins if still valid
  if (allowedOriginsCache && now < cacheExpiry) {
    return allowedOriginsCache;
  }

  const origins = new Set<string>();

  try {
    // Get all verified domains from database
    const domains = await Domain.findAll({
      where: { status: 'Verified' },
      attributes: ['domain_name']
    });

    // Add HTTPS versions of all verified domains
    domains.forEach(domain => {
      origins.add(`https://${domain.domain_name}`);
    });

    // Add development origins from environment variable
    const devOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    devOrigins.forEach(origin => {
      if (origin) {
        origins.add(origin);
      }
    });

    // Always add localhost for development (if not in production)
    if (process.env.NODE_ENV !== 'production') {
      origins.add('http://localhost:4200');
      origins.add('http://localhost:3000');
      origins.add('http://127.0.0.1:4200');
      origins.add('http://127.0.0.1:3000');
    }

    // Update cache
    allowedOriginsCache = origins;
    cacheExpiry = now + CACHE_TTL;

    console.log(`🔒 CSRF: Allowed origins cache updated (${origins.size} origins)`);
  } catch (error) {
    console.error('❌ CSRF: Failed to load allowed origins from database:', error);

    // Fallback to environment variable only in case of database error
    const fallbackOrigin = process.env.FRONTEND_URL || 'http://localhost:4200';
    origins.add(fallbackOrigin);

    if (process.env.NODE_ENV !== 'production') {
      origins.add('http://localhost:4200');
      origins.add('http://localhost:3000');
    }
  }

  return origins;
};

/**
 * Clear the origins cache (useful for testing or when domains are updated)
 */
export const clearOriginsCache = (): void => {
  allowedOriginsCache = null;
  cacheExpiry = 0;
  console.log('🔒 CSRF: Origins cache cleared');
};

/**
 * Extract origin from URL (handles full URLs from Referer header)
 */
const extractOrigin = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return null;
  }
};

/**
 * CSRF Protection Middleware
 * Validates Origin/Referer headers for state-changing requests
 */
export const csrfProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Only check state-changing methods
  const METHOD = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(METHOD)) {
    next();
    return;
  }

  // Get allowed origins
  const allowedOrigins = await getAllowedOrigins();

  // Check Origin header first (most reliable)
  const origin = req.headers.origin;
  if (origin) {
    if (allowedOrigins.has(origin)) {
      next();
      return;
    }

    console.warn(`⚠️  CSRF: Blocked request with invalid Origin: ${origin}`);
    res.status(403).json({
      error: 'CSRF validation failed: Invalid origin',
      code: 'INVALID_ORIGIN'
    });
    return;
  }

  // Fallback to Referer header if Origin is not present
  const referer = req.headers.referer || req.headers.referrer as string | undefined;
  if (referer) {
    const refererOrigin = extractOrigin(referer);
    if (refererOrigin && allowedOrigins.has(refererOrigin)) {
      next();
      return;
    }

    console.warn(`⚠️  CSRF: Blocked request with invalid Referer: ${referer}`);
    res.status(403).json({
      error: 'CSRF validation failed: Invalid referer',
      code: 'INVALID_REFERER'
    });
    return;
  }

  // No Origin or Referer header present (suspicious)
  console.warn(`⚠️  CSRF: Blocked ${METHOD} request with no Origin or Referer header to ${req.path}`);
  res.status(403).json({
    error: 'CSRF validation failed: Missing origin/referer header',
    code: 'MISSING_ORIGIN_REFERER'
  });
};

/**
 * Content-Type validation middleware for JSON APIs
 * Ensures state-changing operations use application/json
 */
export const requireJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
  const METHOD = req.method.toUpperCase();

  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(METHOD)) {
    next();
    return;
  }

  // Check if Content-Type is application/json or multipart/form-data (for file uploads)
  const contentType = req.headers['content-type'];
  if (!contentType) {
    res.status(400).json({
      error: 'Content-Type header is required',
      code: 'MISSING_CONTENT_TYPE'
    });
    return;
  }

  // Allow application/json and multipart/form-data
  if (contentType.includes('application/json') || contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  res.status(400).json({
    error: 'Invalid Content-Type. Expected application/json or multipart/form-data',
    code: 'INVALID_CONTENT_TYPE'
  });
};
