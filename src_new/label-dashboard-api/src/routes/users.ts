import { Router } from 'express';
import {
  checkUsernameExists,
  sendResetLink,
  initUser,
  inviteUser,
  toggleAdmin,
  removeTeamMember,
  getAllUsers,
  getLoginAttempts,
  inviteAdmin,
  resendAdminInvite,
  cancelAdminInvite
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { emailRateLimit, authRateLimit, adminRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Public routes
router.post('/check-username', checkUsernameExists);
router.post('/send-reset-link', emailRateLimit, sendResetLink);
router.post('/init', authRateLimit, initUser);

// Protected routes (require authentication)
router.get('/', authenticateToken, requireAdmin, adminRateLimit, getAllUsers);
router.get('/login-attempts', authenticateToken, requireAdmin, adminRateLimit, getLoginAttempts);
router.post('/invite', authenticateToken, requireAdmin, emailRateLimit, inviteUser);
router.post('/invite-admin', authenticateToken, requireAdmin, emailRateLimit, inviteAdmin);
router.post('/:id/resend-invite', authenticateToken, requireAdmin, emailRateLimit, resendAdminInvite);
router.delete('/:id/invite', authenticateToken, requireAdmin, adminRateLimit, cancelAdminInvite);
router.post('/toggle-admin', authenticateToken, requireAdmin, adminRateLimit, toggleAdmin);
router.post('/remove-team-member', authenticateToken, requireAdmin, adminRateLimit, removeTeamMember);

export default router;