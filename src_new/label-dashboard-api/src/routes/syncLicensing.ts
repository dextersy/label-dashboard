import { Router } from 'express';
import {
  getPitches,
  getPitch,
  createPitch,
  updatePitch,
  deletePitch,
  searchSongs,
  downloadMasters,
  downloadLyrics,
  downloadBSheet
} from '../controllers/syncLicensingController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

// Song search (for adding songs to a pitch)
router.get('/songs/search', searchSongs);

// Pitch CRUD operations
router.get('/', getPitches);
router.get('/:id', getPitch);
router.post('/', createPitch);
router.put('/:id', updatePitch);
router.delete('/:id', deletePitch);

// Downloads
router.get('/:id/download-masters', downloadMasters);
router.get('/:id/download-lyrics', downloadLyrics);
router.get('/:id/download-bsheet', downloadBSheet);

export default router;
