import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Release, Brand, User } from '../models';
import ReleaseTask from '../models/ReleaseTask';
import ReleaseTaskTemplate from '../models/ReleaseTaskTemplate';
import ReleaseTaskTemplateItem from '../models/ReleaseTaskTemplateItem';
import BrandHiddenTemplate from '../models/BrandHiddenTemplate';

interface AuthRequest extends Request {
  user?: any;
}

// Determine whether the current user can see a given template
async function canViewTemplate(user: any, template: ReleaseTaskTemplate): Promise<boolean> {
  if ((template as any).brand_id === user.brand_id) return true;
  if ((template as any).is_public) return true;
  return false;
}

// GET /release-task-templates
export const listTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const brandId: number = req.user.brand_id;

    // Get hidden template IDs for this brand
    const hidden = await BrandHiddenTemplate.findAll({ where: { brand_id: brandId }, attributes: ['template_id'] });
    const hiddenIds = hidden.map((h: any) => h.template_id);

    const whereClause: any = {
      [Op.or]: [
        { brand_id: brandId },
        { is_public: true },
      ],
    };
    if (hiddenIds.length > 0) {
      whereClause.id = { [Op.notIn]: hiddenIds };
    }

    const templates = await ReleaseTaskTemplate.findAll({
      where: whereClause,
      include: [
        {
          model: ReleaseTaskTemplateItem,
          as: 'items',
          required: false,
          order: [['sort_order', 'ASC']],
        } as any,
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'first_name', 'last_name'],
          required: false,
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name'],
          required: false,
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json({ templates });
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /release-task-templates
export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, is_public, items } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const template = await ReleaseTaskTemplate.create({
      brand_id: req.user.brand_id,
      created_by_user_id: req.user.id,
      name: name.trim(),
      description: description?.trim() || undefined,
      is_public: !!is_public,
    });

    // Create items if provided
    if (Array.isArray(items) && items.length > 0) {
      const itemRecords = items.map((item: any, index: number) => ({
        template_id: template.id,
        title: (item.title || '').trim(),
        notes: item.notes?.trim() || undefined,
        days_before_release: item.days_before_release != null ? parseInt(item.days_before_release, 10) : undefined,
        sort_order: item.sort_order != null ? item.sort_order : index,
      })).filter((item: any) => item.title.length > 0);

      await ReleaseTaskTemplateItem.bulkCreate(itemRecords);
    }

    const created = await ReleaseTaskTemplate.findByPk(template.id, {
      include: [
        { model: ReleaseTaskTemplateItem, as: 'items', required: false, order: [['sort_order', 'ASC']] } as any,
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
        { model: Brand, as: 'brand', attributes: ['id', 'brand_name'], required: false },
      ],
    });

    res.status(201).json({ template: created });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /release-task-templates/:id
export const getTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const template = await ReleaseTaskTemplate.findByPk(id, {
      include: [
        { model: ReleaseTaskTemplateItem, as: 'items', required: false, order: [['sort_order', 'ASC']] } as any,
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
        { model: Brand, as: 'brand', attributes: ['id', 'brand_name'], required: false },
      ],
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const canView = await canViewTemplate(req.user, template);
    if (!canView) return res.status(403).json({ error: 'Access denied' });

    // Check if hidden for this brand
    const hidden = await BrandHiddenTemplate.findOne({ where: { brand_id: req.user.brand_id, template_id: id } });
    if (hidden && (template as any).brand_id !== req.user.brand_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /release-task-templates/:id
export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const template = await ReleaseTaskTemplate.findByPk(id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Only creator can update
    if ((template as any).created_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can update this template' });
    }

    const { name, description, is_public, items } = req.body;

    await template.update({
      name: name !== undefined ? name.trim() : (template as any).name,
      description: description !== undefined ? (description?.trim() || null) : (template as any).description,
      is_public: is_public !== undefined ? !!is_public : (template as any).is_public,
    });

    // Replace items if provided
    if (Array.isArray(items)) {
      await ReleaseTaskTemplateItem.destroy({ where: { template_id: id } });
      if (items.length > 0) {
        const itemRecords = items.map((item: any, index: number) => ({
          template_id: id,
          title: (item.title || '').trim(),
          notes: item.notes?.trim() || undefined,
          days_before_release: item.days_before_release != null ? parseInt(item.days_before_release, 10) : undefined,
          sort_order: item.sort_order != null ? item.sort_order : index,
        })).filter((item: any) => item.title.length > 0);

        await ReleaseTaskTemplateItem.bulkCreate(itemRecords);
      }
    }

    const updated = await ReleaseTaskTemplate.findByPk(id, {
      include: [
        { model: ReleaseTaskTemplateItem, as: 'items', required: false, order: [['sort_order', 'ASC']] } as any,
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
        { model: Brand, as: 'brand', attributes: ['id', 'brand_name'], required: false },
      ],
    });

    res.json({ template: updated });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /release-task-templates/:id
export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const template = await ReleaseTaskTemplate.findByPk(id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if ((template as any).created_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this template' });
    }

    await template.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /release-task-templates/:id/hide
export const hideTemplate = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const template = await ReleaseTaskTemplate.findByPk(id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    await BrandHiddenTemplate.findOrCreate({
      where: { brand_id: req.user.brand_id, template_id: id },
      defaults: { brand_id: req.user.brand_id, template_id: id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Hide template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /release-task-templates/:id/hide
export const unhideTemplate = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    await BrandHiddenTemplate.destroy({ where: { brand_id: req.user.brand_id, template_id: id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Unhide template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /releases/:releaseId/tasks/apply-template
export const applyTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const releaseId = parseInt(req.params.id as string, 10);
    if (isNaN(releaseId)) return res.status(400).json({ error: 'Invalid release ID' });

    const { template_id } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id is required' });

    const templateId = parseInt(template_id, 10);
    if (isNaN(templateId)) return res.status(400).json({ error: 'Invalid template_id' });

    const release = await Release.findByPk(releaseId, { attributes: ['id', 'title', 'catalog_no', 'brand_id', 'status', 'release_date'] });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    if (!['Pending', 'Live'].includes((release as any).status)) {
      return res.status(400).json({ error: 'Release planning is only available for Pending or Live releases' });
    }

    // Verify release access (same logic as createReleaseTask)
    const { ArtistAccess } = await import('../models');
    const user = req.user;
    let hasAccess = false;
    if (user.is_admin) {
      if (user.brand_id === (release as any).brand_id) {
        hasAccess = true;
      } else {
        const releaseBrand = await Brand.findByPk((release as any).brand_id, { attributes: ['parent_brand'] });
        if ((releaseBrand as any)?.parent_brand === user.brand_id) hasAccess = true;
      }
    } else {
      const access = await ArtistAccess.findOne({
        where: { user_id: user.id, status: 'Accepted' },
        include: [
          {
            association: 'artist',
            required: true,
            include: [{ association: 'releases', required: true, where: { id: releaseId } }],
          },
        ],
      } as any);
      hasAccess = access !== null;
    }
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    // Load template
    const template = await ReleaseTaskTemplate.findByPk(templateId, {
      include: [{ model: ReleaseTaskTemplateItem, as: 'items', required: false, order: [['sort_order', 'ASC']] } as any],
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const canView = await canViewTemplate(user, template);
    if (!canView) return res.status(403).json({ error: 'Access denied to template' });

    // Check not hidden for this brand
    const hidden = await BrandHiddenTemplate.findOne({ where: { brand_id: user.brand_id, template_id: templateId } });
    if (hidden && (template as any).brand_id !== user.brand_id) {
      return res.status(403).json({ error: 'Access denied to template' });
    }

    const items: ReleaseTaskTemplateItem[] = (template as any).items || [];
    const releaseDate: string | null = (release as any).release_date || null;

    const taskData = items.map((item: any) => {
      let dueDate: string | null = null;
      if (releaseDate && item.days_before_release != null) {
        const d = new Date(releaseDate);
        d.setDate(d.getDate() - item.days_before_release);
        dueDate = d.toISOString().split('T')[0];
      }
      return {
        release_id: releaseId,
        brand_id: (release as any).brand_id,
        title: item.title,
        notes: item.notes || undefined,
        due_date: dueDate || undefined,
        status: 'not_started' as const,
        created_by_user_id: user.id,
      };
    });

    const created = await ReleaseTask.bulkCreate(taskData);

    // Reload with associations
    const tasks = await ReleaseTask.findAll({
      where: { id: created.map((t: any) => t.id) },
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'first_name', 'last_name', 'email_address'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'first_name', 'last_name'], required: false },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.status(201).json({ tasks });
  } catch (error) {
    console.error('Apply template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
