import { Router } from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  setSelectedEvent,
  addTicket,
  getTickets,
  markTicketPaid,
  cancelTicket,
  resendTicket,
  cancelAllUnpaidTickets,
  refreshVerificationPIN,
  getEventReferrers,
  createEventReferrer,
  updateEventReferrer,
  deleteEventReferrer,
  verifyAllPayments,
  sendEventEmail,
  sendTestEventEmail,
  getEventTicketHoldersCount,
  getEventTicketSummary,
  exportEventTicketsCsv,
  exportEventPendingTicketsCsv,
  upload,
  publishEvent,
  unpublishEvent
} from '../controllers/eventController';
import {
  getTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType
} from '../controllers/ticketTypeController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Event CRUD operations
router.get('/', getEvents);
router.post('/', requireAdmin, upload.single('poster'), createEvent);

// Event management operations (specific routes first)
router.post('/set-selected', setSelectedEvent);

// Ticket operations (specific routes before /:id)
router.get('/tickets', getTickets);
router.post('/tickets', requireAdmin, addTicket);
router.post('/tickets/mark-paid', requireAdmin, markTicketPaid);
router.post('/tickets/cancel', requireAdmin, cancelTicket);
router.post('/tickets/resend', requireAdmin, resendTicket);
router.post('/tickets/cancel-all-unpaid', requireAdmin, cancelAllUnpaidTickets);
router.post('/tickets/verify-payments', requireAdmin, verifyAllPayments);

// Referrer operations (specific routes before /:id)
router.get('/referrers', getEventReferrers);
router.post('/referrers', requireAdmin, createEventReferrer);
router.put('/referrers/:id', requireAdmin, updateEventReferrer);
router.delete('/referrers/:id', requireAdmin, deleteEventReferrer);

// Ticket type operations (specific routes before /:id)
router.get('/ticket-types', getTicketTypes);
router.post('/ticket-types', requireAdmin, createTicketType);
router.put('/ticket-types/:id', requireAdmin, updateTicketType);
router.delete('/ticket-types/:id', requireAdmin, deleteTicketType);

// Email operations (specific routes before /:id)
router.get('/ticket-holders-count', getEventTicketHoldersCount);
router.get('/ticket-summary', getEventTicketSummary);
router.get('/tickets/csv', exportEventTicketsCsv);
router.get('/tickets/pending/csv', exportEventPendingTicketsCsv);
router.post('/send-email', requireAdmin, sendEventEmail);
router.post('/send-test-email', requireAdmin, sendTestEventEmail);

// Event CRUD operations with :id (these must come last)
router.get('/:id', getEvent);
router.put('/:id', requireAdmin, upload.single('poster'), updateEvent);
router.post('/:id/refresh-pin', requireAdmin, refreshVerificationPIN);

// Event status operations
router.post('/:id/publish', requireAdmin, publishEvent);
router.post('/:id/unpublish', requireAdmin, unpublishEvent);

export default router;