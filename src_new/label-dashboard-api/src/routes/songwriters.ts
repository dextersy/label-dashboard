import { Router } from 'express';
import {
  searchSongwriters,
  getSongwriter,
  createSongwriter,
  updateSongwriter,
  deleteSongwriter
} from '../controllers/songwriterController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Songwriter operations
router.get('/', searchSongwriters); // GET /api/songwriters?search=...
router.get('/:id', getSongwriter);
router.post('/', createSongwriter);
router.put('/:id', requireAdmin, updateSongwriter);
router.delete('/:id', requireAdmin, deleteSongwriter);

export default router;
