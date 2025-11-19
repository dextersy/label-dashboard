import { Router } from 'express';
import {
  processInvite,
  getInviteData,
  setupUserProfile,
  processAdminInvite,
  getAdminInviteData,
  setupAdminProfile,
  getPendingInvites
} from '../controllers/inviteController';
import { authRateLimit } from '../middleware/rateLimiting';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/process', authRateLimit, processInvite);
router.get('/data/:hash', getInviteData);
router.post('/setup-profile', authRateLimit, setupUserProfile);

// Admin invite routes (public - no authentication required)
router.post('/admin/process', authRateLimit, processAdminInvite);
router.get('/admin/:hash', getAdminInviteData);
router.post('/admin/setup', authRateLimit, setupAdminProfile);

// Authenticated routes
router.get('/pending', authenticateToken, getPendingInvites);

export default router;