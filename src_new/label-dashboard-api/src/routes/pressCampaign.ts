import { Router } from 'express';
import {
  proxyDownload,
  getPressCampaigns,
  getPressCampaign,
  createPressCampaign,
  updatePressCampaign,
  deletePressCampaign,
  uploadCoverArt,
  uploadMp3,
  uploadArtistPhoto,
  deleteArtistPhoto,
  updateArtistPhotoLabel,
  reorderArtistPhotos,
  downloadWordDoc,
  getPublicCampaign,
  downloadArtistPhotosZip,
  searchReleases,
  searchArtists,
  searchEvents,
  generateWriteup,
  coverArtUpload,
  mp3Upload,
  photoUpload,
} from '../controllers/pressCampaignController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadRateLimit, aiRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Public endpoints (no auth)
router.get('/public/:slug', getPublicCampaign);
router.get('/public/:slug/artist-photos.zip', downloadArtistPhotosZip);
router.get('/public/:slug/download', proxyDownload);

// All other routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

// Search helpers
router.get('/search/releases', searchReleases);
router.get('/search/artists', searchArtists);
router.get('/search/events', searchEvents);

// Campaign CRUD
router.get('/', getPressCampaigns);
router.get('/:id', getPressCampaign);
router.post('/', createPressCampaign);
router.put('/:id', updatePressCampaign);
router.delete('/:id', deletePressCampaign);

// File uploads
router.post('/:id/cover-art', uploadRateLimit, coverArtUpload.single('cover_art'), uploadCoverArt);
router.post('/:id/mp3', uploadRateLimit, mp3Upload.single('mp3'), uploadMp3);
router.post('/:id/photos', uploadRateLimit, photoUpload.single('photo'), uploadArtistPhoto);
router.put('/:id/photos/:photoId/label', updateArtistPhotoLabel);
router.delete('/:id/photos/:photoId', deleteArtistPhoto);
router.put('/:id/photos/reorder', reorderArtistPhotos);

// AI generation
router.post('/:id/generate-writeup', aiRateLimit, generateWriteup);

// Downloads
router.get('/:id/download-word', uploadRateLimit, downloadWordDoc);

export default router;
