import { Router } from 'express';
import { 
  getEmailLogs,
  getEmailContent
} from '../controllers/emailController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All email routes require admin authentication
router.get('/', authenticateToken, requireAdmin, getEmailLogs);
router.get('/:id', authenticateToken, requireAdmin, getEmailContent);

export default router;