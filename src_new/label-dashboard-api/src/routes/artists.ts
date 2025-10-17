import { Router } from 'express';
import {
  getArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  setSelectedArtist,
  updatePayoutSettings,
  getPayoutSettings,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getArtistBalance,
  getArtistPhotos,
  uploadArtistPhotos,
  updatePhotoCaption,
  setAsProfilePhoto,
  deleteArtistPhoto,
  getArtistReleases,
  updateRoyalties,
  getArtistTeam,
  inviteTeamMember,
  resendTeamInvite,
  removeTeamMember,
  getArtistDocuments,
  uploadArtistDocument,
  deleteArtistDocument,
  updateEPKSettings,
  upload,
  documentUpload
} from '../controllers/artistController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Artist CRUD operations
router.get('/', getArtists);
router.get('/:id', getArtist);
router.post('/', requireAdmin, upload.single('profile_photo'), createArtist);
router.put('/:id', upload.single('profile_photo'), updateArtist);
router.delete('/:id', requireAdmin, deleteArtist);

// Artist management operations
router.post('/set-selected', setSelectedArtist);
router.get('/:id/payout-settings', getPayoutSettings);
router.put('/:id/payout-settings', updatePayoutSettings);
router.get('/:id/balance', getArtistBalance);

// Payment methods
router.get('/:id/payment-methods', getPaymentMethods);
router.post('/:id/payment-methods', addPaymentMethod);
router.delete('/:id/payment-methods/:paymentMethodId', deletePaymentMethod);
router.put('/:id/payment-methods/:paymentMethodId/set-default', setDefaultPaymentMethod);

// Photo gallery operations
router.get('/:id/photos', getArtistPhotos);
router.post('/:id/photos', upload.array('photos', 10), uploadArtistPhotos);
router.put('/:id/photos/:photoId/caption', updatePhotoCaption);
router.put('/:id/photos/:photoId/set-profile', setAsProfilePhoto);
router.delete('/:id/photos/:photoId', deleteArtistPhoto);

// Release operations
router.get('/:id/releases', getArtistReleases);
router.put('/:id/royalties', requireAdmin, updateRoyalties);

// Team management operations
router.get('/:id/team', getArtistTeam);
router.post('/:id/team/invite', inviteTeamMember);
router.post('/:id/team/:memberId/resend', resendTeamInvite);
router.delete('/:id/team/:memberId', removeTeamMember);

// Document operations
router.get('/:id/documents', getArtistDocuments);
router.post('/:id/documents', documentUpload.single('document'), uploadArtistDocument);
router.delete('/:id/documents/:documentId', deleteArtistDocument);

// EPK operations
router.put('/:id/epk-settings', updateEPKSettings);

export default router;