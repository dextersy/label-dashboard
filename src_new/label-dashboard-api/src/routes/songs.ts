import { Router } from 'express';
import multer from 'multer';
import {
  getSongsByRelease,
  getSong,
  createSong,
  updateSong,
  deleteSong,
  uploadAudio,
  reorderSongs,
  streamAudio
} from '../controllers/songController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Configure multer for audio file uploads (masters)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for audio master files
  },
  fileFilter: (req, file, cb) => {
    // Only allow WAV files for audio masters
    const allowedMimeTypes = [
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/vnd.wave'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only WAV files are allowed for audio masters.'));
    }
  }
});

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Song CRUD operations
router.get('/release/:releaseId', getSongsByRelease);
router.get('/:id', getSong);
router.post('/', createSong);
router.put('/:id', updateSong);
router.delete('/:id', deleteSong);

// Reorder songs
router.put('/release/:releaseId/reorder', reorderSongs);

// Audio file upload
router.post('/:id/audio', upload.single('audio'), uploadAudio);

// Stream audio file
router.get('/:id/audio', streamAudio);

export default router;
