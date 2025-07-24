import { Router } from 'express';
import { login, logout, checkAuth } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateToken, checkAuth);

export default router;