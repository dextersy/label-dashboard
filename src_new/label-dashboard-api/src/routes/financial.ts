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
  addPaymentMethod,
  addRecuperableExpense,
  getFinancialSummary
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

// Payment methods
router.post('/payment-methods', addPaymentMethod);

// Expenses management
router.post('/expenses', requireAdmin, addRecuperableExpense);

// Financial summary
router.get('/summary', getFinancialSummary);

export default router;