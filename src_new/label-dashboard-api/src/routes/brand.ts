import express from 'express';
import { getBrandByDomain, getBrandSettings, updateBrandSettings, uploadLogo, uploadFavicon, getDomains, addDomain, deleteDomain, verifyDomain, getChildBrands, createSublabel, getFeeSettings, updateFeeSettings } from '../controllers/brandController';
import { addLabelPaymentMethod, getLabelPaymentMethods, updateLabelPaymentMethod, setDefaultLabelPaymentMethod, addLabelPayment, getLabelPayments, getLabelPaymentById } from '../controllers/labelPaymentController';
import { getLabelFinanceDashboard, getLabelFinanceBreakdown } from '../controllers/labelFinanceController';
import { getSupportedBanks } from '../controllers/paymentController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { clearOriginsCache } from '../middleware/csrf';

const router = express.Router();

// Public route to get brand settings by domain (used for login page)
router.get('/by-domain', getBrandByDomain);

// Public utility routes
router.get('/supported-banks', getSupportedBanks);

// CSRF/CORS cache refresh route (must be before /:brandId routes to avoid pattern matching)
router.post('/refresh-allowed-origins', authenticateToken, requireAdmin, async (req, res) => {
  await clearOriginsCache();
  res.json({
    message: 'CSRF/CORS allowed origins cache cleared. Will be refreshed on next request.',
    success: true
  });
});

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
router.get('/:brandId/sublabels', authenticateToken, requireAdmin, getChildBrands);
router.post('/:brandId/sublabels', authenticateToken, requireSuperAdmin, createSublabel);

// Fee settings routes
router.get('/:brandId/fee-settings', authenticateToken, requireAdmin, getFeeSettings);
router.put('/:brandId/fee-settings', authenticateToken, requireAdmin, updateFeeSettings);

// Label payment methods routes
router.post('/:brandId/payment-methods', authenticateToken, requireAdmin, addLabelPaymentMethod);
router.get('/:brandId/payment-methods', authenticateToken, requireAdmin, getLabelPaymentMethods);
router.put('/:brandId/payment-methods/:id', authenticateToken, requireAdmin, updateLabelPaymentMethod);
router.put('/:brandId/payment-methods/:id/set-default', authenticateToken, requireAdmin, setDefaultLabelPaymentMethod);

// Label payments routes
router.post('/:brandId/payments', authenticateToken, requireAdmin, addLabelPayment);
router.get('/:brandId/payments', authenticateToken, requireAdmin, getLabelPayments);
router.get('/:brandId/payments/:id', authenticateToken, requireAdmin, getLabelPaymentById);

// Label finance dashboard routes
router.get('/:brandId/finance/dashboard', authenticateToken, requireAdmin, getLabelFinanceDashboard);
router.get('/:brandId/finance/breakdown', authenticateToken, requireAdmin, getLabelFinanceBreakdown);

export default router;