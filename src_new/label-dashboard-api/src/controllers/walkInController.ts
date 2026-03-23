import { Request, Response } from 'express';
import { Event, WalkInType, WalkInTransaction, WalkInTransactionItem, User } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

// GET /events/walk-in-types?event_id=X
export const getWalkInTypes = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id as string, 10);
    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify user has access to this event
    const event = await Event.findOne({
      where: { id: eventIdNum, brand_id: req.user.brand_id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const walkInTypes = await WalkInType.findAll({
      where: { event_id: eventIdNum },
      order: [['id', 'ASC']]
    });

    const processedTypes = [];
    for (const wit of walkInTypes) {
      const soldCount = await wit.getSoldCount();
      const remainingSlots = await wit.getRemainingSlots();

      processedTypes.push({
        ...wit.toJSON(),
        sold_count: soldCount,
        remaining_slots: remainingSlots
      });
    }

    res.json({ walkInTypes: processedTypes });
  } catch (error) {
    console.error('Get walk-in types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /events/walk-in-types
export const createWalkInType = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, name, price, max_slots } = req.body;

    if (!event_id || !name) {
      return res.status(400).json({ error: 'Event ID and name are required' });
    }

    const eventIdNum = parseInt(event_id as string, 10);

    // Verify user has access to this event
    const event = await Event.findOne({
      where: { id: eventIdNum, brand_id: req.user.brand_id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const walkInType = await WalkInType.create({
      event_id: eventIdNum,
      name,
      price: parseFloat(price) || 0,
      max_slots: parseInt(max_slots) || 0
    });

    res.status(201).json({ walkInType: walkInType.toJSON() });
  } catch (error) {
    console.error('Create walk-in type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /events/walk-in-types/:id
export const updateWalkInType = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, max_slots } = req.body;

    const walkInType = await WalkInType.findByPk(id, {
      include: [{ model: Event, as: 'event' }]
    });

    if (!walkInType || (walkInType as any).event.brand_id !== req.user.brand_id) {
      return res.status(404).json({ error: 'Walk-in type not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (max_slots !== undefined) updateData.max_slots = parseInt(max_slots);

    await walkInType.update(updateData);

    res.json({ walkInType: walkInType.toJSON() });
  } catch (error) {
    console.error('Update walk-in type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /events/walk-in-types/:id
export const deleteWalkInType = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const walkInType = await WalkInType.findByPk(id, {
      include: [{ model: Event, as: 'event' }]
    });

    if (!walkInType || (walkInType as any).event.brand_id !== req.user.brand_id) {
      return res.status(404).json({ error: 'Walk-in type not found' });
    }

    // Check if there are any transactions using this type
    const transactionCount = await WalkInTransactionItem.count({
      where: { walk_in_type_id: walkInType.id }
    });

    if (transactionCount > 0) {
      return res.status(400).json({ error: 'Cannot delete walk-in type that has transactions' });
    }

    await walkInType.destroy();
    res.json({ message: 'Walk-in type deleted successfully' });
  } catch (error) {
    console.error('Delete walk-in type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /events/walk-in-transactions?event_id=X&page=1&per_page=15
export const getWalkInTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, page: pageParam, per_page: perPageParam } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id as string, 10);
    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify user has access to this event
    const event = await Event.findOne({
      where: { id: eventIdNum, brand_id: req.user.brand_id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const page = Math.max(1, parseInt(pageParam as string, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(perPageParam as string, 10) || 15));
    const offset = (page - 1) * perPage;

    const { count, rows: transactions } = await WalkInTransaction.findAndCountAll({
      where: { event_id: eventIdNum },
      include: [
        {
          model: WalkInTransactionItem,
          as: 'items',
          include: [{
            model: WalkInType,
            as: 'walkInType',
            attributes: ['id', 'name']
          }]
        },
        {
          model: User,
          as: 'registeredByUser',
          attributes: ['id', 'first_name', 'last_name', 'email_address']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: perPage,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / perPage);

    res.json({
      transactions,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: count,
        per_page: perPage,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get walk-in transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
