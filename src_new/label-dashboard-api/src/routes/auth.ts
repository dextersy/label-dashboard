import { Router } from 'express';
import { login, logout, checkAuth, forgotPassword, resetPassword, validateResetHash, completeProfile, loginUnified, selectBrand, organizerSignup, organizerLogin, organizerGoogleRedirect, organizerGoogleCallback, organizerGoogleExchange, ticketingForgotPassword, ticketingValidateResetHash, dashboardGoogleRedirect, dashboardGoogleCallback, dashboardGoogleExchange } from '../controllers/authController';
import { audienceSignup, audienceLogin, audienceGetMe, audienceForgotPassword, audienceResetPassword, audienceValidateResetHash, audienceGoogleRedirect, audienceGoogleCallback, audienceGoogleExchange } from '../controllers/audienceAuthController';
import { authenticateToken, authenticateAudienceToken } from '../middleware/auth';
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
ticketingRouter.post('/forgot-password', authRateLimit, ticketingForgotPassword);
ticketingRouter.get('/validate-reset-hash/:hash', ticketingValidateResetHash);
ticketingRouter.get('/google', authRateLimit, organizerGoogleRedirect);
ticketingRouter.get('/google/callback', organizerGoogleCallback);
ticketingRouter.post('/google/exchange', authRateLimit, organizerGoogleExchange);
router.use('/ticketing', ticketingRouter);

// Audience auth
const audienceRouter = Router();
audienceRouter.post('/signup', authRateLimit, audienceSignup);
audienceRouter.post('/login', authRateLimit, audienceLogin);
audienceRouter.get('/me', authenticateAudienceToken, audienceGetMe);
audienceRouter.post('/forgot-password', authRateLimit, audienceForgotPassword);
audienceRouter.post('/reset-password', authRateLimit, audienceResetPassword);
audienceRouter.get('/validate-reset-hash/:hash', audienceValidateResetHash);
audienceRouter.get('/google', authRateLimit, audienceGoogleRedirect);
audienceRouter.get('/google/callback', audienceGoogleCallback);
audienceRouter.post('/google/exchange', authRateLimit, audienceGoogleExchange);
router.use('/audience', audienceRouter);

// Dashboard portal Google auth
const dashboardRouter = Router();
dashboardRouter.get('/google', authRateLimit, dashboardGoogleRedirect);
dashboardRouter.get('/google/callback', dashboardGoogleCallback);
dashboardRouter.post('/google/exchange', authRateLimit, dashboardGoogleExchange);
router.use('/dashboard', dashboardRouter);

export default router;