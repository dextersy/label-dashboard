import { Router } from 'express';
import {
  getArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  setSelectedArtist,
  updatePayoutSettings,
  getArtistBalance,
  getArtistPhotos,
  uploadArtistPhotos,
  updatePhotoCaption,
  deleteArtistPhoto,
  upload
} from '../controllers/artistController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Artist CRUD operations
router.get('/', getArtists);
router.get('/:id', getArtist);
router.post('/', requireAdmin, createArtist);
router.put('/:id', upload.single('profile_photo'), updateArtist);
router.delete('/:id', requireAdmin, deleteArtist);

// Artist management operations
router.post('/set-selected', setSelectedArtist);
router.put('/:id/payout-settings', updatePayoutSettings);
router.get('/:id/balance', getArtistBalance);

// Photo gallery operations
router.get('/:id/photos', getArtistPhotos);
router.post('/:id/photos', upload.array('photos', 10), uploadArtistPhotos);
router.put('/:id/photos/:photoId/caption', updatePhotoCaption);
router.delete('/:id/photos/:photoId', deleteArtistPhoto);

export default router;