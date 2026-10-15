import { Router } from 'express';
import {
  listCollaborators,
  inviteCollaborator,
  revokeCollaborator,
  acceptEventInvite,
  setupEventInviteProfile,
  getInviteInfo,
} from '../controllers/eventAccessController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { inviteRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Public: resolve invite info and accept invite (no auth required — used by invite landing page)
router.get('/invite-info', inviteRateLimit, getInviteInfo);
router.post('/accept', inviteRateLimit, acceptEventInvite);
router.post('/setup-profile', inviteRateLimit, setupEventInviteProfile);

// Authenticated: collaborator management (admin only)
router.get('/:id/collaborators', authenticateToken, requireAdmin, listCollaborators);
router.post('/:id/collaborators', authenticateToken, requireAdmin, inviteCollaborator);
router.delete('/:id/collaborators', authenticateToken, requireAdmin, revokeCollaborator);

export default router;
