import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Release, ArtistAccess, Brand, User } from '../models';
import ReleaseTask from '../models/ReleaseTask';
import { createNotification } from '../utils/notificationService';
import { sendEmail } from '../utils/emailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';

interface AuthRequest extends Request {
  user?: any;
}

// Check if user has access to the release (admin of the brand/parent, or artist team member)
async function userCanAccessRelease(user: any, release: any): Promise<boolean> {
  if (user.is_admin) {
    // Admin can access if their brand is the release's brand or parent brand
    if (user.brand_id === release.brand_id) return true;
    const releaseBrand = await Brand.findByPk(release.brand_id, { attributes: ['parent_brand'] });
    if ((releaseBrand as any)?.parent_brand === user.brand_id) return true;
    return false;
  }
  // Non-admin: must have accepted ArtistAccess to an artist on this release
  const access = await ArtistAccess.findOne({
    where: { user_id: user.id, status: 'Accepted' },
    include: [
      {
        association: 'artist',
        required: true,
        include: [
          {
            association: 'releases',
            required: true,
            where: { id: release.id },
          },
        ],
      },
    ],
  } as any);
  return access !== null;
}

async function sendTaskAssignedNotification(
  task: ReleaseTask,
  assignedUser: any,
  release: any,
  brandId: number
): Promise<void> {
  try {
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const releaseUrl = `${frontendUrl}/music/releases/edit/${release.id}?tab=planning`;

    // In-app notification
    await createNotification(
      assignedUser.id,
      brandId,
      'task_assigned',
      `You've been assigned a task on "${release.title}"`,
      task.title,
      `/music/releases/edit/${release.id}?tab=planning`
    );

    // Email notification
    const brand = await Brand.findByPk(brandId);
    const brandName = brand?.brand_name || 'Dashboard';
    const brandColor = (brand as any)?.brand_color || '#1595e7';

    const releaseTitle = (release as any).title || (release as any).catalog_no;
    const dueDateRow = task.due_date ? `
      <tr><td style="font-size:13px;color:#666;padding-top:14px;padding-bottom:4px;">Due date</td></tr>
      <tr><td style="font-size:15px;color:#333;">${new Date(task.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>` : '';
    const notesRow = task.notes ? `
      <tr><td style="font-size:13px;color:#666;padding-top:14px;padding-bottom:4px;">Notes</td></tr>
      <tr><td style="font-size:15px;color:#555;font-style:italic;">${task.notes}</td></tr>` : '';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${brandColor};padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">${brandName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#111;">Hi ${assignedUser.first_name || assignedUser.email_address},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;">You've been assigned a task for <strong>${releaseTitle}</strong>:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px 16px 20px;margin-bottom:24px;">
            <tr><td style="font-size:13px;color:#666;padding-bottom:4px;">Task</td></tr>
            <tr><td style="font-size:16px;color:#111;font-weight:bold;">${task.title}</td></tr>
            ${notesRow}
            ${dueDateRow}
          </table>
          <p style="margin:0 0 24px;">
            <a href="${releaseUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:bold;">View Task</a>
          </p>
          <p style="margin:0;font-size:13px;color:#999;">You received this because you were assigned a task in the ${brandName} dashboard.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (assignedUser.email_address) {
      await sendEmail([assignedUser.email_address], `Task assigned: "${task.title}"`, htmlBody, brandId);
    }
  } catch (error) {
    console.error('Failed to send task assigned notification:', error);
  }
}

// GET /releases/:id/tasks
export const getReleaseTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);
    if (isNaN(releaseId)) return res.status(400).json({ error: 'Invalid release ID' });

    const release = await Release.findByPk(releaseId, { attributes: ['id', 'title', 'catalog_no', 'brand_id', 'status'] });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const hasAccess = await userCanAccessRelease(req.user, release);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const tasks = await ReleaseTask.findAll({
      where: { release_id: releaseId },
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'first_name', 'last_name', 'email_address'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get release tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /releases/:id/tasks/assignable-users
export const getAssignableUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);
    if (isNaN(releaseId)) return res.status(400).json({ error: 'Invalid release ID' });

    const release = await Release.findByPk(releaseId, {
      attributes: ['id', 'brand_id', 'status'],
      include: [{ association: 'artists', attributes: ['id'] }],
    } as any);
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const hasAccess = await userCanAccessRelease(req.user, release);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const brandId = (release as any).brand_id;

    // Get parent brand id if any
    const brand = await Brand.findByPk(brandId, { attributes: ['id', 'parent_brand'] });
    const brandIds: number[] = [brandId];
    if ((brand as any)?.parent_brand) brandIds.push((brand as any).parent_brand);

    // Get brand admins (from brand and parent brand)
    const admins = await User.findAll({
      where: { brand_id: { [Op.in]: brandIds }, is_admin: true },
      attributes: ['id', 'first_name', 'last_name', 'email_address'],
    });

    // Get artist team members for all artists on this release
    const artistIds = ((release as any).artists || []).map((a: any) => a.id);
    let teamMembers: any[] = [];
    if (artistIds.length > 0) {
      const accesses = await ArtistAccess.findAll({
        where: { artist_id: { [Op.in]: artistIds }, status: 'Accepted' },
        include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email_address'] }],
      });
      teamMembers = accesses.map((a: any) => a.user).filter(Boolean);
    }

    // Deduplicate by user id, admins take precedence for role label
    const seen = new Set<number>();
    const adminIds = new Set(admins.map((u: any) => u.id));
    const users: any[] = [];
    for (const u of [...admins, ...teamMembers]) {
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        users.push({
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          email_address: u.email_address,
          role: adminIds.has(u.id) ? 'admin' : 'team_member',
        });
      }
    }

    res.json({ users });
  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /releases/:id/tasks
export const createReleaseTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);
    if (isNaN(releaseId)) return res.status(400).json({ error: 'Invalid release ID' });

    const release = await Release.findByPk(releaseId, { attributes: ['id', 'title', 'catalog_no', 'brand_id', 'status'] });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    if (!['Pending', 'Live'].includes((release as any).status)) {
      return res.status(400).json({ error: 'Release planning is only available for Pending or Live releases' });
    }

    const hasAccess = await userCanAccessRelease(req.user, release);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const { title, notes, due_date, assigned_user_id } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = await ReleaseTask.create({
      release_id: releaseId,
      brand_id: (release as any).brand_id,
      title: title.trim(),
      notes: notes?.trim() || undefined,
      due_date: due_date || undefined,
      assigned_user_id: assigned_user_id || undefined,
      status: 'not_started',
      created_by_user_id: req.user.id,
    });

    // Load with associations
    const created = await ReleaseTask.findByPk(task.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'first_name', 'last_name', 'email_address'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
      ],
    });

    // Notify assigned user
    if (assigned_user_id) {
      const assignedUser = await User.findByPk(assigned_user_id, { attributes: ['id', 'first_name', 'last_name', 'email_address'] });
      if (assignedUser && assignedUser.id !== req.user.id) {
        await sendTaskAssignedNotification(task, assignedUser, release, (release as any).brand_id);
      }
    }

    res.status(201).json({ task: created });
  } catch (error) {
    console.error('Create release task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /releases/:id/tasks/:taskId
export const updateReleaseTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId: taskIdParam } = req.params;
    const releaseId = parseInt(id as string, 10);
    const taskId = parseInt(taskIdParam as string, 10);
    if (isNaN(releaseId) || isNaN(taskId)) return res.status(400).json({ error: 'Invalid ID' });

    const release = await Release.findByPk(releaseId, { attributes: ['id', 'title', 'catalog_no', 'brand_id', 'status'] });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const hasAccess = await userCanAccessRelease(req.user, release);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const task = await ReleaseTask.findOne({ where: { id: taskId, release_id: releaseId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { title, notes, due_date, assigned_user_id, status } = req.body;

    // Only assignee or admin can change status to/from 'done'
    const isAdmin = req.user.is_admin;
    const isAssignee = task.assigned_user_id === req.user.id;
    if (status !== undefined && status !== task.status) {
      if (!isAdmin && !isAssignee) {
        return res.status(403).json({ error: 'Only the assigned person or an admin can change task status' });
      }
    }

    const previousAssignedUserId = task.assigned_user_id;

    await task.update({
      title: title !== undefined ? title.trim() : task.title,
      notes: notes !== undefined ? (notes?.trim() || null) : task.notes,
      due_date: due_date !== undefined ? (due_date || null) : task.due_date,
      assigned_user_id: assigned_user_id !== undefined ? (assigned_user_id || null) : task.assigned_user_id,
      status: status || task.status,
    });

    // If assignee changed, notify new assignee
    const newAssignedUserId = assigned_user_id !== undefined ? assigned_user_id : task.assigned_user_id;
    if (newAssignedUserId && newAssignedUserId !== previousAssignedUserId) {
      const assignedUser = await User.findByPk(newAssignedUserId, { attributes: ['id', 'first_name', 'last_name', 'email_address'] });
      if (assignedUser && assignedUser.id !== req.user.id) {
        await sendTaskAssignedNotification(task, assignedUser, release, (release as any).brand_id);
      }
    }

    const updated = await ReleaseTask.findByPk(task.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'first_name', 'last_name', 'email_address'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
      ],
    });

    res.json({ task: updated });
  } catch (error) {
    console.error('Update release task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /releases/:id/tasks/:taskId
export const deleteReleaseTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId: taskIdParam } = req.params;
    const releaseId = parseInt(id as string, 10);
    const taskId = parseInt(taskIdParam as string, 10);
    if (isNaN(releaseId) || isNaN(taskId)) return res.status(400).json({ error: 'Invalid ID' });

    const release = await Release.findByPk(releaseId, { attributes: ['id', 'brand_id'] });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const hasAccess = await userCanAccessRelease(req.user, release);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const task = await ReleaseTask.findOne({ where: { id: taskId, release_id: releaseId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Only admin or the task creator can delete
    if (!req.user.is_admin && task.created_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only an admin or the task creator can delete this task' });
    }

    await task.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete release task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
