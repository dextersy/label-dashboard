import { Router } from 'express';
import {
  getLatestReleases,
  getTopEarningReleases,
  getBalanceSummary,
  getEventSalesChart,
  getDashboardData,
  getEventsDashboardData
} from '../controllers/dashboardController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Dashboard data endpoints
router.get('/', getDashboardData);
router.get('/latest-releases', getLatestReleases);
router.get('/top-earning-releases', getTopEarningReleases);
router.get('/balance-summary', getBalanceSummary);
router.get('/event-sales', requireAdmin, getEventSalesChart);
router.get('/events', requireAdmin, getEventsDashboardData);

export default router;