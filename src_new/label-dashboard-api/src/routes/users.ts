import { Router } from 'express';
import { 
  checkUsernameExists,
  sendResetLink,
  initUser,
  inviteUser,
  toggleAdmin,
  removeTeamMember,
  getAllUsers,
  getLoginAttempts
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/check-username', checkUsernameExists);
router.post('/send-reset-link', sendResetLink);
router.post('/init', initUser);

// Protected routes (require authentication)
router.get('/', authenticateToken, requireAdmin, getAllUsers);
router.get('/login-attempts', authenticateToken, requireAdmin, getLoginAttempts);
router.post('/invite', authenticateToken, requireAdmin, inviteUser);
router.post('/toggle-admin', authenticateToken, requireAdmin, toggleAdmin);
router.post('/remove-team-member', authenticateToken, requireAdmin, removeTeamMember);

export default router;