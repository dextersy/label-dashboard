import { Router } from 'express';
import multer from 'multer';
import {
  addEarning,
  bulkAddEarnings,
  previewCsvForEarnings,
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
  getAdminPaymentsRoyaltiesSummary,
  getAdminBalanceSummary,
  getAdminRecuperableExpenses,
  getArtistsReadyForPayment,
  payAllBalances,
  downloadEarningsCSV,
  downloadRoyaltiesCSV
} from '../controllers/financialController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Configure multer for CSV file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Earnings management
router.post('/earnings', requireAdmin, addEarning);
router.post('/earnings/bulk', requireAdmin, bulkAddEarnings);
router.post('/earnings/preview-csv', requireAdmin, upload.single('csv_file'), previewCsvForEarnings);
router.get('/earnings/csv', downloadEarningsCSV); // CSV route before :id route
router.get('/earnings', getEarnings);
router.get('/earnings/:id', getEarningById);
router.get('/artists/:artist_id/earnings', getEarningsByArtist);

// Royalties management
router.post('/royalties', requireAdmin, addRoyalty);
router.get('/royalties/csv', downloadRoyaltiesCSV); // CSV route before any parameterized routes
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
router.get('/admin/balance-summary', requireAdmin, getAdminBalanceSummary);
router.get('/admin/recuperable-expenses', requireAdmin, getAdminRecuperableExpenses);
router.get('/admin/artists-ready-for-payment', requireAdmin, getArtistsReadyForPayment);
router.post('/admin/pay-all-balances', requireAdmin, payAllBalances);

export default router;