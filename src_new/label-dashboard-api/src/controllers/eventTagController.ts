import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { EventTag } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const getTags = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;

    const tags = await EventTag.findAll({
      where: {
        [Op.or]: [
          { brand_id: null },
          { brand_id: brandId }
        ]
      },
      order: [
        ['is_custom', 'ASC'],
        ['name', 'ASC']
      ]
    });

    res.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const brandId = req.user.brand_id;
    const trimmedName = name.trim();

    // Check if a tag with this name already exists for this brand (or globally)
    const existing = await EventTag.findOne({
      where: {
        name: trimmedName,
        [Op.or]: [
          { brand_id: null },
          { brand_id: brandId }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'A tag with this name already exists' });
    }

    const tag = await EventTag.create({
      name: trimmedName,
      is_custom: true,
      brand_id: brandId
    });

    res.status(201).json({ tag });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
