import { Router } from 'express';
import {
  getTicketFromCode,
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
  generateArtistEPKSEOPage
} from '../controllers/publicController';

const router = Router();

// Public API routes (no authentication required)
router.get('/brand/domain/:domain', getBrandByDomain);
router.get('/events/domain/:domain', getAllEventsForDomain);
router.get('/events/:id', getEventForPublic);
router.get('/events/:id/info', getPublicEventInfo);
router.get('/epk/:artist_id', getArtistEPK);

// On-demand SEO page generation for social media crawlers
router.get('/seo/event-:id.html', generateEventSEOPage);
router.get('/seo/events-:domain.html', generateEventsListSEOPage);
router.get('/seo/epk-:id.html', generateArtistEPKSEOPage);

router.post('/tickets/get-from-code', getTicketFromCode);
router.post('/tickets/buy', buyTicket);
router.post('/tickets/verify', verifyTicket);
router.post('/tickets/check-pin', checkPin);
router.post('/tickets/check-in', checkInTicket);

// Webhook endpoint (PayMongo)
router.post('/webhook/payment', ticketPaymentWebhook);

export default router;