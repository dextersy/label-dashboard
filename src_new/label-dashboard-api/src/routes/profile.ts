import { Router } from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/profileController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All profile routes require authentication
router.use(authenticateToken);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/change-password', changePassword);

export default router;