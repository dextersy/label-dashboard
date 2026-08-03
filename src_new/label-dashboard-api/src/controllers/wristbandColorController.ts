import { Request, Response } from 'express';
import { WristbandColor } from '../models';

export const getWristbandColors = async (req: Request, res: Response): Promise<void> => {
  try {
    const colors = await WristbandColor.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    res.json(colors);
  } catch (error) {
    console.error('Error fetching wristband colors:', error);
    res.status(500).json({ error: 'Failed to fetch wristband colors' });
  }
};
