import { Router } from 'express';
import {
  getTicketFromCode,
  buyTicket,
  verifyTicket,
  ticketPaymentWebhook,
  checkPin,
  getBrandByDomain
} from '../controllers/publicController';

const router = Router();

// Public API routes (no authentication required)
router.get('/brand/domain/:domain', getBrandByDomain);
router.post('/tickets/get-from-code', getTicketFromCode);
router.post('/tickets/buy', buyTicket);
router.post('/tickets/verify', verifyTicket);
router.post('/tickets/check-pin', checkPin);

// Webhook endpoint (PayMongo)
router.post('/webhook/payment', ticketPaymentWebhook);

export default router;