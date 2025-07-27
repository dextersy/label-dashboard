import { Router } from 'express';
import {
  processInvite,
  getInviteData,
  setupUserProfile
} from '../controllers/inviteController';

const router = Router();

// Public routes (no authentication required)
router.post('/process', processInvite);
router.get('/data/:hash', getInviteData);
router.post('/setup-profile', setupUserProfile);

export default router;