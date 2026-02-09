import { Router } from 'express';
import {
  systemLogin,
  systemCheckAuth,
  systemLogout,
  refreshSystemToken
} from '../controllers/systemAuthController';
import {
  getArtistsDuePayment,
  getWalletBalances,
  getUsedS3Urls,
  getSublabelsDuePayment,
  getReleaseStatus
} from '../controllers/systemController';
import {
  getSSLDomains,
  getSSLCertDomains,
  removeSSLDomain,
  setDomainUnverified
} from '../controllers/domainController';
import {
  authenticateSystemUser,
  requireSystemUser,
  requireSystemApiEnabled,
  systemApiRateLimit
} from '../middleware/systemAuth';
import { authRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Apply environment check to all system routes
router.use(requireSystemApiEnabled);

/**
 * System Authentication Routes
 * Separate from brand-scoped authentication
 */
router.post('/auth/login', authRateLimit, systemLogin);
router.post('/auth/logout', authenticateSystemUser, systemLogout);
router.get('/auth/me', authenticateSystemUser, systemCheckAuth);
router.post('/auth/refresh', authenticateSystemUser, refreshSystemToken);

/**
 * Protected System Routes
 * All routes below require system user authentication
 */
router.use(authenticateSystemUser);
router.use(requireSystemUser);
router.use(systemApiRateLimit(100, 60000)); // 100 requests per minute

// Data access endpoints
router.get('/artists-due-payment', getArtistsDuePayment);
router.get('/sublabels-due-payment', getSublabelsDuePayment);
router.get('/wallet-balances', getWalletBalances);
router.get('/s3-used-urls', getUsedS3Urls);
router.get('/release-status', getReleaseStatus);

// SSL domain management endpoints
router.get('/ssl-domains', getSSLDomains);
router.get('/ssl-cert-domains', getSSLCertDomains);
router.post('/ssl-domain/remove', removeSSLDomain);
router.post('/domain/set-unverified', setDomainUnverified);

export default router;
