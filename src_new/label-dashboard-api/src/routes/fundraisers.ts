import { Router } from 'express';
import {
  getFundraisers,
  getFundraiser,
  createFundraiser,
  updateFundraiser,
  publishFundraiser,
  unpublishFundraiser,
  closeFundraiser,
  reopenFundraiser,
  getDonations,
  getDonationSummary,
  upload
} from '../controllers/fundraiserController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Fundraiser CRUD operations
router.get('/', getFundraisers);
router.post('/', requireAdmin, upload.single('poster'), createFundraiser);

// Donation operations (specific routes before /:id)
router.get('/donations', getDonations);
router.get('/donations/summary', getDonationSummary);

// Fundraiser CRUD operations with :id (these must come after specific routes)
router.get('/:id', requireAdmin, getFundraiser);
router.put('/:id', requireAdmin, upload.single('poster'), updateFundraiser);

// Fundraiser status operations
router.post('/:id/publish', requireAdmin, publishFundraiser);
router.post('/:id/unpublish', requireAdmin, unpublishFundraiser);
router.post('/:id/close', requireAdmin, closeFundraiser);
router.post('/:id/reopen', requireAdmin, reopenFundraiser);

export default router;
