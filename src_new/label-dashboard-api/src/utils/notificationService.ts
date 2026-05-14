import Notification from '../models/Notification';
import { User, ArtistAccess } from '../models';

export async function createNotification(
  userId: number,
  brandId: number,
  type: string,
  title: string,
  message?: string,
  link?: string
): Promise<void> {
  try {
    await Notification.create({ user_id: userId, brand_id: brandId, type, title, message, link });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function createNotificationsForUsers(
  userIds: number[],
  brandId: number,
  type: string,
  title: string,
  message?: string,
  link?: string
): Promise<void> {
  try {
    if (userIds.length === 0) {
      console.log(`[Notification] createNotificationsForUsers skipped — no userIds for type=${type}`);
      return;
    }
    await Notification.bulkCreate(
      userIds.map(userId => ({ user_id: userId, brand_id: brandId, type, title, message, link }))
    );
    console.log(`[Notification] bulkCreate OK — type=${type} count=${userIds.length}`);
  } catch (error) {
    console.error(`[Notification] bulkCreate FAILED — type=${type}:`, error);
  }
}

export async function getBrandAdminUserIds(brandId: number): Promise<number[]> {
  try {
    const admins = await User.findAll({
      where: { brand_id: brandId, is_admin: 1 },
      attributes: ['id']
    });
    return admins.map(u => u.id);
  } catch (error) {
    console.error('Failed to get brand admin user IDs:', error);
    return [];
  }
}

export async function getArtistTeamUserIds(artistId: number): Promise<number[]> {
  try {
    const accesses = await ArtistAccess.findAll({
      where: { artist_id: artistId, status: 'Accepted' },
      attributes: ['user_id']
    });
    return accesses.map((a: any) => a.user_id);
  } catch (error) {
    console.error('Failed to get artist team user IDs:', error);
    return [];
  }
}

export async function getArtistTeamAndAdminUserIds(artistId: number, brandId: number): Promise<number[]> {
  try {
    const [teamIds, adminIds] = await Promise.all([
      getArtistTeamUserIds(artistId),
      getBrandAdminUserIds(brandId)
    ]);
    return [...new Set([...teamIds, ...adminIds])];
  } catch (error) {
    console.error('Failed to get artist team and admin user IDs:', error);
    return [];
  }
}
