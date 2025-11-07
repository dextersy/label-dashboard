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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (normal operation)
const FALLBACK_CACHE_TTL = 30 * 1000; // 30 seconds (during database errors)
const REFRESH_BEFORE_EXPIRY = 30 * 1000; // Refresh 30 seconds before expiry (background refresh)

// Background refresh timer
let refreshTimer: NodeJS.Timeout | null = null;

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
    // Get all connected domains from database (domains with SSL and DNS properly configured)
    const domains = await Domain.findAll({
      where: { status: 'Connected' },
      attributes: ['domain_name']
    });

    // Add HTTPS versions of all connected domains
    // Normalize to lowercase for case-insensitive comparison (DNS is case-insensitive)
    domains.forEach(domain => {
      origins.add(`https://${domain.domain_name.toLowerCase()}`);
    });

    // Add development origins from environment variable
    const devOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    devOrigins.forEach(origin => {
      if (origin) {
        // Normalize to lowercase for case-insensitive comparison
        origins.add(origin.toLowerCase());
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
    origins.add(fallbackOrigin.toLowerCase());

    // Add development origins from environment variable even in error case
    const devOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    devOrigins.forEach(origin => {
      if (origin) {
        // Normalize to lowercase for case-insensitive comparison
        origins.add(origin.toLowerCase());
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      origins.add('http://localhost:4200');
      origins.add('http://localhost:3000');
      origins.add('http://127.0.0.1:4200');
      origins.add('http://127.0.0.1:3000');
    }

    // PERFORMANCE: Cache fallback origins with shorter TTL to prevent hammering the database
    // This ensures we retry periodically but don't query on every single request during outages
    allowedOriginsCache = origins;
    cacheExpiry = now + FALLBACK_CACHE_TTL;

    console.log(`⚠️  CSRF: Using fallback origins (cached for ${FALLBACK_CACHE_TTL / 1000}s, ${origins.size} origins)`);
  }

  return origins;
};

/**
 * Clear the origins cache (useful for testing or when domains are updated)
 * PERFORMANCE: Triggers immediate background refresh to update cache
 */
export const clearOriginsCache = async (): Promise<void> => {
  allowedOriginsCache = null;
  cacheExpiry = 0;
  console.log('🔒 CSRF: Origins cache cleared, refreshing...');

  // Immediately refresh the cache to prevent cache misses
  try {
    await getAllowedOrigins();
  } catch (error) {
    console.error('❌ CSRF: Failed to refresh cache after clearing:', error);
  }
};

/**
 * PERFORMANCE: Pre-warm the origins cache on startup
 * This prevents the first preflight request from blocking on a database query
 */
export const preWarmCache = async (): Promise<void> => {
  console.log('🔒 CSRF: Pre-warming origins cache...');
  await getAllowedOrigins();
  console.log('✅ CSRF: Origins cache pre-warmed and ready');
};

/**
 * PERFORMANCE: Start background refresh to keep cache warm
 * Refreshes the cache before it expires to prevent any request from ever blocking on DB queries
 */
export const startBackgroundRefresh = (): void => {
  // Clear any existing timer
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Schedule refresh before cache expires
  const refreshInterval = CACHE_TTL - REFRESH_BEFORE_EXPIRY;

  refreshTimer = setInterval(async () => {
    try {
      const now = Date.now();
      const timeUntilExpiry = cacheExpiry - now;

      // Only refresh if cache is about to expire
      if (timeUntilExpiry <= REFRESH_BEFORE_EXPIRY) {
        console.log('🔄 CSRF: Background refresh triggered (cache expiring soon)');
        await getAllowedOrigins();
      }
    } catch (error) {
      console.error('❌ CSRF: Background refresh failed:', error);
      // Don't crash the server, just log the error
      // The cache will be refreshed on the next request when it expires
    }
  }, refreshInterval);

  console.log(`🔄 CSRF: Background refresh scheduled (every ${refreshInterval / 1000}s)`);
};

/**
 * PERFORMANCE: Get allowed origins synchronously from cache
 * This function assumes the cache has been pre-warmed and is kept fresh by background refresh
 * Returns null if cache is not available (should never happen in production)
 */
export const getAllowedOriginsSync = (): Set<string> | null => {
  return allowedOriginsCache;
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
 * Paths exempt from CSRF protection (webhooks, server-to-server endpoints)
 *
 * SECURITY NOTE: These endpoints MUST implement their own security mechanisms:
 * - /api/public/webhook/payment: Uses PayMongo signature verification (paymongo-signature header)
 * - Other webhooks: Must implement signature verification or API key authentication
 *
 * Webhooks are exempt because they:
 * 1. Come from external servers (no Origin/Referer headers)
 * 2. Cannot be triggered by browsers (no CSRF risk)
 * 3. Use cryptographic signatures for authentication
 */
const CSRF_EXEMPT_PATHS = [
  '/api/public/webhook/payment', // PayMongo payment webhook (signature verified)
  '/api/public/webhook/',         // Generic webhook prefix (must verify signatures)
];

/**
 * Check if a path is exempt from CSRF protection
 */
const isCsrfExempt = (path: string): boolean => {
  return CSRF_EXEMPT_PATHS.some(exemptPath => path.startsWith(exemptPath));
};

/**
 * Check if request has valid JWT authentication
 * Requests with JWT tokens in Authorization header are not vulnerable to CSRF
 * because attackers cannot make browsers automatically send Authorization headers
 */
const hasValidAuthToken = (req: Request): boolean => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If there's a token present (we don't validate it here, that's done by authenticateToken middleware)
  // we know this is an API client using JWT, not a browser-based CSRF attack
  return !!(token && token !== 'null' && token !== 'undefined');
};

/**
 * CSRF Protection Middleware
 * Validates Origin/Referer headers for state-changing requests
 *
 * SECURITY RATIONALE:
 * - Browser-based requests: Must have valid Origin/Referer (CSRF protection)
 * - JWT API clients (Postman, mobile, server-to-server): Exempt because CSRF doesn't apply
 * - Webhooks: Exempt because they use signature verification
 */
export const csrfProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip CSRF checks for webhook endpoints (they use signature verification instead)
  if (isCsrfExempt(req.path)) {
    next();
    return;
  }

  // Only check state-changing methods
  const METHOD = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(METHOD)) {
    next();
    return;
  }

  // Skip CSRF checks for requests with JWT authentication
  // JWT in Authorization header cannot be sent automatically by browsers (no CSRF risk)
  if (hasValidAuthToken(req)) {
    next();
    return;
  }

  // Get allowed origins
  const allowedOrigins = await getAllowedOrigins();

  // Check Origin header first (most reliable)
  const origin = req.headers.origin;
  if (origin) {
    // Normalize to lowercase for case-insensitive comparison (DNS is case-insensitive)
    if (allowedOrigins.has(origin.toLowerCase())) {
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
    // Normalize to lowercase for case-insensitive comparison
    if (refererOrigin && allowedOrigins.has(refererOrigin.toLowerCase())) {
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

  // No Origin or Referer header present (suspicious for browser requests)
  console.warn(`⚠️  CSRF: Blocked ${METHOD} request with no Origin/Referer/Authorization to ${req.path}`);
  res.status(403).json({
    error: 'CSRF validation failed: Missing origin/referer header. For API clients, include a JWT token in the Authorization header.',
    code: 'MISSING_ORIGIN_REFERER'
  });
};

/**
 * Content-Type validation middleware for JSON APIs
 * Ensures state-changing operations use application/json
 */
export const requireJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
  // Skip Content-Type checks for webhook endpoints
  if (isCsrfExempt(req.path)) {
    next();
    return;
  }

  const METHOD = req.method.toUpperCase();

  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(METHOD)) {
    next();
    return;
  }

  // Check if Content-Type is valid for API requests
  const contentType = req.headers['content-type'];
  if (!contentType) {
    res.status(400).json({
      error: 'Content-Type header is required',
      code: 'MISSING_CONTENT_TYPE'
    });
    return;
  }

  // Allow standard content types for API requests
  const allowedContentTypes = [
    'application/json',                     // JSON API requests
    'multipart/form-data',                  // File uploads
    'application/x-www-form-urlencoded'     // Form submissions
  ];

  const isValidContentType = allowedContentTypes.some(type => contentType.includes(type));

  if (isValidContentType) {
    next();
    return;
  }

  res.status(400).json({
    error: 'Invalid Content-Type. Expected application/json, multipart/form-data, or application/x-www-form-urlencoded',
    code: 'INVALID_CONTENT_TYPE'
  });
};
