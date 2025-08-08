import express from 'express';
import { getBrandByDomain, getBrandSettings, updateBrandSettings, uploadLogo, uploadFavicon, getDomains, addDomain, deleteDomain, verifyDomain, getChildBrands } from '../controllers/brandController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Public route to get brand settings by domain (used for login page)
router.get('/by-domain', getBrandByDomain);

// Protected routes
router.get('/:brandId', authenticateToken, getBrandSettings);
router.put('/:brandId', authenticateToken, requireAdmin, updateBrandSettings);
router.post('/:brandId/logo', authenticateToken, requireAdmin, ...uploadLogo);
router.post('/:brandId/favicon', authenticateToken, requireAdmin, ...uploadFavicon);

// Domain management routes
router.get('/:brandId/domains', authenticateToken, requireAdmin, getDomains);
router.post('/:brandId/domains', authenticateToken, requireAdmin, addDomain);
router.delete('/:brandId/domains/:domainName', authenticateToken, requireAdmin, deleteDomain);
router.put('/:brandId/domains/:domainName/verify', authenticateToken, requireAdmin, verifyDomain);

// Child brands (sublabel) routes
router.get('/:brandId/child-brands', authenticateToken, requireAdmin, getChildBrands);

export default router;