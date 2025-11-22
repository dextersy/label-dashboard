import { Router } from 'express';
import {
  getTicketDetails,
  downloadTicketPDF,
  buyTicket,
  verifyTicket,
  ticketPaymentWebhook,
  checkPin,
  checkInTicket,
  getBrandByDomain,
  getEventForPublic,
  getPublicEventInfo,
  generateEventSEOPage,
  getAllEventsForDomain,
  generateEventsListSEOPage,
  getArtistEPK,
  generateArtistEPKSEOPage,
  getAvailableTicketTypesPublic
} from '../controllers/publicController';
import { publicRateLimit, createPaymentRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Public API routes (no authentication required)
router.get('/brand/domain/:domain', getBrandByDomain);
router.get('/events/domain/:domain', getAllEventsForDomain);
router.get('/events/:id', getEventForPublic);
router.get('/events/:id/info', getPublicEventInfo);
router.get('/events/ticket-types/available', getAvailableTicketTypesPublic);
router.get('/epk/:artist_id', getArtistEPK);

// On-demand SEO page generation for social media crawlers
router.get('/seo/event-:id.html', generateEventSEOPage);
router.get('/seo/events-:domain.html', generateEventsListSEOPage);
router.get('/seo/epk-:id.html', generateArtistEPKSEOPage);

// Payment rate limiter for ticket purchasing
const ticketPurchaseRateLimit = createPaymentRateLimit(10, 300000); // 10 purchases per 5 minutes

// Unified ticket details endpoint - supports both cookie and code-based authentication
router.post('/tickets/details', publicRateLimit, getTicketDetails);
router.get('/tickets/pdf', publicRateLimit, downloadTicketPDF);
router.post('/tickets/buy', ticketPurchaseRateLimit, buyTicket);
router.post('/tickets/verify', publicRateLimit, verifyTicket);
router.post('/tickets/check-pin', publicRateLimit, checkPin);
router.post('/tickets/check-in', publicRateLimit, checkInTicket);

// Webhook endpoint (PayMongo) - no rate limiting for webhooks as they come from trusted sources
router.post('/webhook/payment', ticketPaymentWebhook);

export default router;