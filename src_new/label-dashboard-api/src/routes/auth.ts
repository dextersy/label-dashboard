import { Router } from 'express';
import { login, logout, checkAuth, forgotPassword, resetPassword, validateResetHash, completeProfile, loginUnified, selectBrand, organizerSignup, organizerLogin } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiting';

const router = Router();

router.post('/login', authRateLimit, login);
router.post('/login-unified', authRateLimit, loginUnified);
router.post('/select-brand', authRateLimit, selectBrand);
router.post('/logout', logout);
router.get('/me', authenticateToken, checkAuth);
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);
router.post('/complete-profile', authRateLimit, completeProfile);
router.get('/validate-reset-hash/:hash', validateResetHash);

// Ticketing portal auth
const ticketingRouter = Router();
ticketingRouter.post('/signup', authRateLimit, organizerSignup);
ticketingRouter.post('/login', authRateLimit, organizerLogin);
router.use('/ticketing', ticketingRouter);

export default router;