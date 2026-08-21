import express from 'express';
import {
  getPlans,
  getUsage,
  initiateCheckout,
  cancelSubscription,
  devOverridePlan,
  handleSubscriptionWebhook,
  getAdminPlans,
  createPlan,
  updatePlan,
} from '../controllers/subscriptionController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

// Public — PayMongo webhook (no auth, signature-verified inside controller)
router.post('/webhook', handleSubscriptionWebhook);

// Protected
router.get('/plans', authenticateToken, getPlans);
router.get('/usage', authenticateToken, getUsage);
router.post('/dev-override', authenticateToken, requireAdmin, devOverridePlan);
router.post('/checkout', authenticateToken, requireAdmin, initiateCheckout);
router.post('/cancel', authenticateToken, requireAdmin, cancelSubscription);

// Superadmin plan management
router.get('/admin/plans', authenticateToken, requireSuperAdmin, getAdminPlans);
router.post('/admin/plans', authenticateToken, requireSuperAdmin, createPlan);
router.put('/admin/plans/:id', authenticateToken, requireSuperAdmin, updatePlan);

export default router;
