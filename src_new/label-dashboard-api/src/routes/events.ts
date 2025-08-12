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
  getEventTicketHoldersCount,
  upload
} from '../controllers/eventController';
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

// Email operations (specific routes before /:id)
router.get('/ticket-holders-count', getEventTicketHoldersCount);
router.post('/send-email', requireAdmin, sendEventEmail);

// Event CRUD operations with :id (these must come last)
router.get('/:id', getEvent);
router.put('/:id', requireAdmin, upload.single('poster'), updateEvent);
router.post('/:id/refresh-pin', requireAdmin, refreshVerificationPIN);

export default router;