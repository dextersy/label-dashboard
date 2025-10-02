import { Router } from 'express';
import {
  getEmailLogs,
  getEmailContent
} from '../controllers/emailController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { adminRateLimit } from '../middleware/rateLimiting';

const router = Router();

// All email routes require admin authentication
router.get('/', authenticateToken, requireAdmin, adminRateLimit, getEmailLogs);
router.get('/:id', authenticateToken, requireAdmin, adminRateLimit, getEmailContent);

export default router;