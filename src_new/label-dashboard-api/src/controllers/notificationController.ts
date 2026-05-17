import { Request, Response } from 'express';
import Notification from '../models/Notification';

interface AuthRequest extends Request {
  user?: any;
}

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const brandId = req.user.brand_id;

    const [notifications, unreadCount] = await Promise.all([
      Notification.findAll({
        where: { user_id: userId, brand_id: brandId },
        order: [['created_at', 'DESC']],
        limit: 50
      }),
      Notification.count({
        where: { user_id: userId, brand_id: brandId, is_read: false }
      })
    ]);

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        is_read: n.is_read,
        created_at: n.created_at
      })),
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const brandId = req.user.brand_id;

    const notification = await Notification.findOne({
      where: { id: parseInt(id as string, 10), user_id: userId, brand_id: brandId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({ is_read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const brandId = req.user.brand_id;

    await Notification.update(
      { is_read: true },
      { where: { user_id: userId, brand_id: brandId, is_read: false } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationsReadByType = async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    const brandId = req.user.brand_id;

    await Notification.update(
      { is_read: true },
      { where: { user_id: userId, brand_id: brandId, type, is_read: false } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read by type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const brandId = req.user.brand_id;

    const count = await Notification.count({
      where: { user_id: userId, brand_id: brandId, is_read: false }
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
