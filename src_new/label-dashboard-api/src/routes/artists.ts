import { Router } from 'express';
import {
  getArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  setSelectedArtist,
  updatePayoutSettings,
  getArtistBalance
} from '../controllers/artistController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Artist CRUD operations
router.get('/', getArtists);
router.get('/:id', getArtist);
router.post('/', requireAdmin, createArtist);
router.put('/:id', updateArtist);
router.delete('/:id', requireAdmin, deleteArtist);

// Artist management operations
router.post('/set-selected', setSelectedArtist);
router.put('/:id/payout-settings', updatePayoutSettings);
router.get('/:id/balance', getArtistBalance);

export default router;