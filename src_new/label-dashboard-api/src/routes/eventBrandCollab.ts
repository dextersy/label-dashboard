import { Router } from 'express';
import {
  listBrandCollaborators,
  inviteBrandCollaborator,
  revokeBrandCollaborator,
  getBrandCollabInviteInfo,
  acceptBrandCollabInvite,
  searchBrands,
  getPublicBrandCollaborators,
} from '../controllers/eventBrandCollabController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes (no auth)
router.get('/invite-info', getBrandCollabInviteInfo);

// Public: accepted brand collaborators for ticket buy page
router.get('/:id/public-collaborators', getPublicBrandCollaborators);

// Authenticated routes
router.use(authenticateToken);

// Accept invite — any admin of the invited brand
router.post('/accept', acceptBrandCollabInvite);

// Owner-only: manage brand collaborators for an event
router.get('/:id/brand-collaborators', requireAdmin, listBrandCollaborators);
router.post('/:id/brand-collaborators', requireAdmin, inviteBrandCollaborator);
router.delete('/:id/brand-collaborators', requireAdmin, revokeBrandCollaborator);

// Search brands for invite dropdown (admin only)
router.get('/:id/search-brands', requireAdmin, searchBrands);

export default router;
