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
  getUsedS3Urls
} from '../controllers/systemController';
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
router.get('/wallet-balances', getWalletBalances);
router.get('/s3-used-urls', getUsedS3Urls);

export default router;
