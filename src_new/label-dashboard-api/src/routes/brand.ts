import express from 'express';
import { getBrandByDomain, getBrandSettings, updateBrandSettings, uploadLogo, uploadFavicon } from '../controllers/brandController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Public route to get brand settings by domain (used for login page)
router.get('/by-domain', getBrandByDomain);

// Protected routes
router.get('/:brandId', authenticateToken, getBrandSettings);
router.put('/:brandId', authenticateToken, requireAdmin, updateBrandSettings);
router.post('/:brandId/logo', authenticateToken, requireAdmin, ...uploadLogo);
router.post('/:brandId/favicon', authenticateToken, requireAdmin, ...uploadFavicon);

export default router;