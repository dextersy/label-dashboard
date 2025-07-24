import { Router } from 'express';
import {
  getReleases,
  getRelease,
  createRelease,
  updateRelease,
  deleteRelease,
  getReleaseEarnings,
  getReleaseExpenses
} from '../controllers/releaseController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Release CRUD operations
router.get('/', getReleases);
router.get('/:id', getRelease);
router.post('/', requireAdmin, createRelease);
router.put('/:id', updateRelease);
router.delete('/:id', requireAdmin, deleteRelease);

// Release-specific data
router.get('/:id/earnings', getReleaseEarnings);
router.get('/:id/expenses', getReleaseExpenses);

export default router;