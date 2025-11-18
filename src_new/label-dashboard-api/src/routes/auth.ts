import { Router } from 'express';
import { login, logout, checkAuth, forgotPassword, resetPassword, validateResetHash, completeProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiting';

const router = Router();

router.post('/login', authRateLimit, login);
router.post('/logout', logout);
router.get('/me', authenticateToken, checkAuth);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);
router.post('/complete-profile', authRateLimit, completeProfile);
router.get('/validate-reset-hash/:hash', validateResetHash);

export default router;