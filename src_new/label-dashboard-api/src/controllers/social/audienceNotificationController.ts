import { Request, Response } from 'express';
import AudienceNotification from '../../models/AudienceNotification';
import AudienceUser from '../../models/AudienceUser';

export const getAudienceNotifications = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const limit = Math.min(parseInt((req.query.limit as string) || '30', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const { count, rows } = await AudienceNotification.findAndCountAll({
      where: { audience_user_id: me.id },
      include: [
        {
          model: AudienceUser,
          as: 'actor',
          attributes: ['id', 'first_name', 'last_name', 'profile_photo_url'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return res.json({ total: count, notifications: rows });
  } catch (error) {
    console.error('getAudienceNotifications error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAudienceNotificationUnreadCount = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const count = await AudienceNotification.count({
      where: { audience_user_id: me.id, is_read: false },
    });
    return res.json({ unread_count: count });
  } catch (error) {
    console.error('getAudienceNotificationUnreadCount error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAudienceNotificationRead = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    const notifId = parseInt(req.params.id as string, 10);

    // Enforce ownership in the WHERE clause — avoids TOCTOU and prevents
    // probing whether a notification ID exists for another user.
    const [affected] = await AudienceNotification.update(
      { is_read: true },
      { where: { id: notifId, audience_user_id: me.id } },
    );
    if (affected === 0) return res.status(404).json({ error: 'Notification not found.' });
    return res.json({ message: 'Marked as read.' });
  } catch (error) {
    console.error('markAudienceNotificationRead error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAudienceNotificationsRead = async (req: Request, res: Response) => {
  try {
    const me = (req as any).audienceUser as AudienceUser;
    await AudienceNotification.update(
      { is_read: true },
      { where: { audience_user_id: me.id, is_read: false } },
    );
    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('markAllAudienceNotificationsRead error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
