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
  refreshVerificationPIN,
  getEventReferrers,
  createEventReferrer,
  updateEventReferrer,
  deleteEventReferrer,
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

// Referrer operations (specific routes before /:id)
router.get('/referrers', getEventReferrers);
router.post('/referrers', requireAdmin, createEventReferrer);
router.put('/referrers/:id', requireAdmin, updateEventReferrer);
router.delete('/referrers/:id', requireAdmin, deleteEventReferrer);

// Event CRUD operations with :id (these must come last)
router.get('/:id', getEvent);
router.put('/:id', requireAdmin, upload.single('poster'), updateEvent);
router.post('/:id/refresh-pin', requireAdmin, refreshVerificationPIN);

export default router;