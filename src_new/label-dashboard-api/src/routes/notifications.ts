import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsReadByType,
  getUnreadNotificationCount
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/read-by-type/:type', markNotificationsReadByType);
router.patch('/:id/read', markNotificationRead);

export default router;
