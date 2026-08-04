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
  refundTicket,
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
  unpublishEvent,
  getPaymentConfig,
  getEventPreview
} from '../controllers/eventController';
import {
  getTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  getAvailableTicketTypes
} from '../controllers/ticketTypeController';
import {
  getWalkInTypes,
  createWalkInType,
  updateWalkInType,
  deleteWalkInType,
  getWalkInTransactions
} from '../controllers/walkInController';
import { getTags, createTag } from '../controllers/eventTagController';
import { getWristbandColors } from '../controllers/wristbandColorController';
import { getAddOnPayments, createAddOnPayment, initiateAddOnPayment } from '../controllers/eventAddOnPaymentController';
import {
  getWristbandSettings,
  upsertWristbandSettings,
  getWristbandOrders,
  getWristbandOrder,
  createWristbandOrder,
  updateWristbandOrder,
  deleteWristbandOrder,
  confirmWristbandOrder,
  rejectWristbandOrder,
  upload as wristbandUpload,
} from '../controllers/wristbandOrderController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Tag operations (before /:id routes)
router.get('/tags', getTags);
router.post('/tags', requireAdmin, createTag);

// Wristband color options
router.get('/wristband-colors', getWristbandColors);

// Wristband settings & orders
router.get('/wristband-settings', getWristbandSettings);
router.put('/wristband-settings', requireAdmin, upsertWristbandSettings);
router.get('/wristband-orders', getWristbandOrders);
router.post('/wristband-orders', requireAdmin, wristbandUpload.single('design'), createWristbandOrder);
router.put('/wristband-orders/:id', requireAdmin, wristbandUpload.single('design'), updateWristbandOrder);
router.get('/wristband-orders/:id', requireAdmin, getWristbandOrder);
router.post('/wristband-orders/:id/confirm', requireAdmin, confirmWristbandOrder);
router.post('/wristband-orders/:id/reject', requireAdmin, rejectWristbandOrder);
router.delete('/wristband-orders/:id', requireAdmin, deleteWristbandOrder);

// Add-on payments
router.get('/addon-payments', getAddOnPayments);
router.post('/addon-payments', requireAdmin, createAddOnPayment);
router.post('/addon-payments/initiate', requireAdmin, initiateAddOnPayment);

// Event CRUD operations
router.get('/', getEvents);
router.post('/', requireAdmin, upload.single('poster'), createEvent);

// Payment config (must be before /:id routes)
router.get('/payment-config', getPaymentConfig);

// Event management operations (specific routes first)
router.post('/set-selected', setSelectedEvent);

// Ticket operations (specific routes before /:id)
router.get('/tickets', getTickets);
router.post('/tickets', requireAdmin, addTicket);
router.post('/tickets/mark-paid', requireAdmin, markTicketPaid);
router.post('/tickets/cancel', requireAdmin, cancelTicket);
router.post('/tickets/refund', requireAdmin, refundTicket);
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
router.get('/ticket-types/available', getAvailableTicketTypes);
router.post('/ticket-types', requireAdmin, createTicketType);
router.put('/ticket-types/:id', requireAdmin, updateTicketType);
router.delete('/ticket-types/:id', requireAdmin, deleteTicketType);

// Walk-in type operations (specific routes before /:id)
router.get('/walk-in-types', getWalkInTypes);
router.post('/walk-in-types', requireAdmin, createWalkInType);
router.put('/walk-in-types/:id', requireAdmin, updateWalkInType);
router.delete('/walk-in-types/:id', requireAdmin, deleteWalkInType);
router.get('/walk-in-transactions', getWalkInTransactions);

// Email operations (specific routes before /:id)
router.get('/ticket-holders-count', getEventTicketHoldersCount);
router.get('/ticket-summary', getEventTicketSummary);
router.get('/tickets/csv', exportEventTicketsCsv);
router.get('/tickets/pending/csv', exportEventPendingTicketsCsv);
router.post('/send-email', requireAdmin, sendEventEmail);
router.post('/send-test-email', requireAdmin, sendTestEventEmail);

// Event CRUD operations with :id (these must come last)
router.get('/:id/preview', requireAdmin, getEventPreview);
router.get('/:id', getEvent);
router.put('/:id', requireAdmin, upload.single('poster'), updateEvent);
router.post('/:id/refresh-pin', requireAdmin, refreshVerificationPIN);

// Event status operations
router.post('/:id/publish', requireAdmin, publishEvent);
router.post('/:id/unpublish', requireAdmin, unpublishEvent);

export default router;