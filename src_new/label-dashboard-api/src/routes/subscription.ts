import express from 'express';
import {
  getPublicPlans,
  getPlans,
  getUsage,
  initiateCheckout,
  cancelSubscription,
  cancelPendingChange,
  devOverridePlan,
  handleSubscriptionWebhook,
  getAdminPlans,
  createPlan,
  updatePlan,
} from '../controllers/subscriptionController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

// Public — no auth required
router.post('/webhook', handleSubscriptionWebhook);
router.get('/plans/public', getPublicPlans);

// Protected
router.get('/plans', authenticateToken, getPlans);
router.get('/usage', authenticateToken, getUsage);
router.post('/dev-override', authenticateToken, requireAdmin, devOverridePlan);
router.post('/checkout', authenticateToken, requireAdmin, initiateCheckout);
router.post('/cancel', authenticateToken, requireAdmin, cancelSubscription);
router.post('/cancel-pending-change', authenticateToken, requireAdmin, cancelPendingChange);

// Superadmin plan management
router.get('/admin/plans', authenticateToken, requireSuperAdmin, getAdminPlans);
router.post('/admin/plans', authenticateToken, requireSuperAdmin, createPlan);
router.put('/admin/plans/:id', authenticateToken, requireSuperAdmin, updatePlan);

export default router;
