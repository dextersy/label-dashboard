import { Router } from 'express';
import { login, logout, checkAuth, forgotPassword, resetPassword, validateResetHash } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateToken, checkAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/validate-reset-hash/:hash', validateResetHash);

export default router;