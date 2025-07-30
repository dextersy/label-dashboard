import { Router } from 'express';
import {
  addEarning,
  bulkAddEarnings,
  getEarnings,
  getEarningById,
  getEarningsByArtist,
  addRoyalty,
  getRoyalties,
  addPayment,
  getPayments,
  getPaymentById,
  getPaymentsByArtist,
  getFinancialSummary,
  getWalletBalance,
  getAdminEarningsSummary,
  getAdminPaymentsRoyaltiesSummary
} from '../controllers/financialController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Earnings management
router.post('/earnings', requireAdmin, addEarning);
router.post('/earnings/bulk', requireAdmin, bulkAddEarnings);
router.get('/earnings', getEarnings);
router.get('/earnings/:id', getEarningById);
router.get('/artists/:artist_id/earnings', getEarningsByArtist);

// Royalties management
router.post('/royalties', requireAdmin, addRoyalty);
router.get('/royalties', getRoyalties);

// Payments management
router.post('/payments', requireAdmin, addPayment);
router.get('/payments', getPayments);
router.get('/payments/:id', getPaymentById);
router.get('/artists/:artist_id/payments', getPaymentsByArtist);


// Financial summary
router.get('/summary', getFinancialSummary);

// Wallet balance
router.get('/wallet/balance', requireAdmin, getWalletBalance);

// Admin summary endpoints
router.get('/admin/earnings-summary', requireAdmin, getAdminEarningsSummary);
router.get('/admin/payments-royalties-summary', requireAdmin, getAdminPaymentsRoyaltiesSummary);

export default router;