import { Router } from 'express';
import multer from 'multer';
import {
  getSongsByRelease,
  getSong,
  createSong,
  updateSong,
  deleteSong,
  uploadAudio,
  reorderSongs
} from '../controllers/songController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Allow audio files
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/flac',
      'audio/x-flac',
      'audio/aac',
      'audio/m4a',
      'audio/x-m4a'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Song CRUD operations
router.get('/release/:releaseId', getSongsByRelease);
router.get('/:id', getSong);
router.post('/', requireAdmin, createSong);
router.put('/:id', requireAdmin, updateSong);
router.delete('/:id', requireAdmin, deleteSong);

// Reorder songs
router.put('/release/:releaseId/reorder', requireAdmin, reorderSongs);

// Audio file upload
router.post('/:id/audio', requireAdmin, upload.single('audio'), uploadAudio);

export default router;
