import { Router } from 'express';
import {
  processInvite,
  getInviteData,
  setupUserProfile,
  processAdminInvite,
  getAdminInviteData,
  setupAdminProfile
} from '../controllers/inviteController';

const router = Router();

// Public routes (no authentication required)
router.post('/process', processInvite);
router.get('/data/:hash', getInviteData);
router.post('/setup-profile', setupUserProfile);

// Admin invite routes (public - no authentication required)
router.post('/admin/process', processAdminInvite);
router.get('/admin/:hash', getAdminInviteData);
router.post('/admin/setup', setupAdminProfile);

export default router;