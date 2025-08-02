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
  upload
} from '../controllers/eventController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Event CRUD operations
router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/', requireAdmin, upload.single('poster'), createEvent);
router.put('/:id', requireAdmin, upload.single('poster'), updateEvent);

// Event management operations
router.post('/set-selected', setSelectedEvent);
router.post('/:id/refresh-pin', requireAdmin, refreshVerificationPIN);

// Ticket operations
router.get('/tickets', getTickets);
router.post('/tickets', requireAdmin, addTicket);
router.post('/tickets/mark-paid', requireAdmin, markTicketPaid);

export default router;