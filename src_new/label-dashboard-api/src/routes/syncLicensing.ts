import { Router } from 'express';
import {
  getPitches,
  getPitch,
  createPitch,
  updatePitch,
  searchSongs,
  downloadMasters,
  downloadLyrics,
  downloadBSheet,
  generateSongSummary,
  getPitchRecommendations
} from '../controllers/syncLicensingController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadRateLimit } from '../middleware/rateLimiting';

const router = Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

// Song search (for adding songs to a pitch)
router.get('/songs/search', searchSongs);

// AI: generate mood/theme summary for a single song
router.post('/songs/:songId/generate-summary', generateSongSummary);

// Pitch CRUD operations
router.get('/', getPitches);
router.get('/:id', getPitch);
router.post('/', createPitch);
router.put('/:id', updatePitch);

// AI: get recommended songs for a pitch (unsaved pitch passes title/description in body; saved pitch uses /:id)
router.post('/recommendations', getPitchRecommendations);
router.post('/:id/recommendations', getPitchRecommendations);

// Downloads (rate limited - streams S3 objects through the server)
router.get('/:id/download-masters', uploadRateLimit, downloadMasters);
router.get('/:id/download-lyrics', uploadRateLimit, downloadLyrics);
router.get('/:id/download-bsheet', uploadRateLimit, downloadBSheet);

export default router;
