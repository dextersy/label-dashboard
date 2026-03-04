import { Request, Response } from 'express';
import { TicketType, Event } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const getTicketTypes = async (req: AuthRequest, res: Response) => {
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
      where: { 
        id: eventIdNum,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const ticketTypes = await TicketType.findAll({
      where: { event_id: eventIdNum },
      order: [['id', 'ASC']]
    });

    // Process ticket types to include statistics
    const processedTicketTypes = [];
    for (const ticketType of ticketTypes) {
      const soldCount = await ticketType.getSoldCount();
      const pendingCount = await ticketType.getPendingCount();
      const remainingTickets = await ticketType.getRemainingTickets();
      
      processedTicketTypes.push({
        ...ticketType.toJSON(),
        sold_tickets: soldCount,
        pending_tickets: pendingCount,
        remaining_tickets: remainingTickets
      });
    }

    res.json({ ticketTypes: processedTicketTypes });
  } catch (error) {
    console.error('Get ticket types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTicketType = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id, name, price, max_tickets = 0, start_date, end_date, disabled = false, special_instructions = null } = req.body;

    if (!event_id || !name || price === undefined) {
      return res.status(400).json({ 
        error: 'Event ID, name, and price are required' 
      });
    }

    const eventIdNum = parseInt(event_id, 10);

    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const maxTicketsNum = parseInt(max_tickets, 10);
    if (isNaN(maxTicketsNum) || maxTicketsNum < 0) {
      return res.status(400).json({ error: 'Invalid max tickets value' });
    }

    // Validate dates if provided
    let startDate = null;
    let endDate = null;

    if (start_date) {
      startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid start date' });
      }
    }

    if (end_date) {
      endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid end date' });
      }
    }

    if (startDate && endDate && endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Verify user has access to this event
    const event = await Event.findOne({
      where: { 
        id: eventIdNum,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if ticket type name already exists for this event
    const existingTicketType = await TicketType.findOne({
      where: {
        event_id: eventIdNum,
        name: name.trim()
      }
    });

    if (existingTicketType) {
      return res.status(400).json({ 
        error: 'A ticket type with this name already exists for this event' 
      });
    }

    const ticketType = await TicketType.create({
      event_id: eventIdNum,
      name: name.trim(),
      price: priceNum,
      max_tickets: maxTicketsNum,
      start_date: startDate,
      end_date: endDate,
      disabled: disabled,
      special_instructions: special_instructions ? special_instructions.trim() : null
    });

    res.status(201).json({
      message: 'Ticket type created successfully',
      ticketType
    });
  } catch (error) {
    console.error('Create ticket type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTicketType = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, price, max_tickets, start_date, end_date, disabled, special_instructions } = req.body;

    const ticketTypeId = parseInt(id as string, 10);

    if (isNaN(ticketTypeId)) {
      return res.status(400).json({ error: 'Invalid ticket type ID' });
    }

    if (!name || price === undefined) {
      return res.status(400).json({
        error: 'Name and price are required'
      });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    // Handle optional availability fields
    let maxTicketsNum = undefined;
    if (max_tickets !== undefined) {
      maxTicketsNum = parseInt(max_tickets, 10);
      if (isNaN(maxTicketsNum) || maxTicketsNum < 0) {
        return res.status(400).json({ error: 'Invalid max tickets value' });
      }
    }

    // Validate dates if provided
    let startDate = undefined;
    let endDate = undefined;

    if (start_date !== undefined) {
      if (start_date === null) {
        startDate = null;
      } else {
        startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid start date' });
        }
      }
    }

    if (end_date !== undefined) {
      if (end_date === null) {
        endDate = null;
      } else {
        endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'Invalid end date' });
        }
      }
    }

    // Check date relationship if both are being set
    const finalStartDate = startDate !== undefined ? startDate : null;
    const finalEndDate = endDate !== undefined ? endDate : null;

    if (finalStartDate && finalEndDate && finalEndDate <= finalStartDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Find ticket type and verify access through event
    const ticketType = await TicketType.findOne({
      where: { id: ticketTypeId },
      include: [{
        model: Event,
        as: 'event',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!ticketType) {
      return res.status(404).json({ error: 'Ticket type not found' });
    }

    // Check if updated name conflicts with other ticket types for this event
    const existingTicketType = await TicketType.findOne({
      where: {
        event_id: ticketType.event_id,
        name: name.trim(),
        id: { [require('sequelize').Op.ne]: ticketTypeId }
      }
    });

    if (existingTicketType) {
      return res.status(400).json({ 
        error: 'A ticket type with this name already exists for this event' 
      });
    }

    // Build update object with only provided fields
    const updateData: any = {
      name: name.trim(),
      price: priceNum
    };

    if (maxTicketsNum !== undefined) {
      updateData.max_tickets = maxTicketsNum;
    }

    if (startDate !== undefined) {
      updateData.start_date = startDate;
    }

    if (endDate !== undefined) {
      updateData.end_date = endDate;
    }

    if (disabled !== undefined) {
      updateData.disabled = disabled;
    }

    if (special_instructions !== undefined) {
      updateData.special_instructions = special_instructions ? special_instructions.trim() : null;
    }

    await ticketType.update(updateData);

    res.json({
      message: 'Ticket type updated successfully',
      ticketType
    });
  } catch (error) {
    console.error('Update ticket type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAvailableTicketTypes = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, include_custom = false } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id as string, 10);

    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Get all ticket types for the event (exclude disabled ones for public view)
    const ticketTypes = await TicketType.findAll({
      where: { 
        event_id: eventIdNum,
        disabled: false
      },
      include: [{
        model: require('../models').Ticket,
        as: 'tickets',
        required: false,
        attributes: ['id']
      }],
      order: [['id', 'ASC']]
    });

    const includeCustom = include_custom === 'true';
    const availableTicketTypes = [];

    for (const ticketType of ticketTypes) {
      const isAvailable = ticketType.isAvailable();
      const isSoldOut = await ticketType.isSoldOut();
      const remainingTickets = await ticketType.getRemainingTickets();

      // Get the actual sold count using the same logic as isSoldOut()
      const soldCount = await ticketType.getSoldCount();

      if (includeCustom) {
        // For custom tickets: include all ticket types regardless of date restrictions
        // but still provide availability info for display
        availableTicketTypes.push({
          ...ticketType.toJSON(),
          is_available: isAvailable,
          is_sold_out: isSoldOut,
          remaining_tickets: remainingTickets,
          sold_count: soldCount
        });
      } else {
        // For public buy page, only include available and not sold out tickets
        if (!isAvailable || isSoldOut) {
          continue;
        }

        availableTicketTypes.push({
          ...ticketType.toJSON(),
          is_available: isAvailable,
          is_sold_out: isSoldOut,
          remaining_tickets: remainingTickets,
          sold_count: soldCount
        });
      }
    }

    res.json({ ticketTypes: availableTicketTypes });
  } catch (error) {
    console.error('Get available ticket types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTicketType = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const ticketTypeId = parseInt(id as string, 10);

    if (isNaN(ticketTypeId)) {
      return res.status(400).json({ error: 'Invalid ticket type ID' });
    }

    // Find ticket type and verify access through event
    const ticketType = await TicketType.findOne({
      where: { id: ticketTypeId },
      include: [{
        model: Event,
        as: 'event',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!ticketType) {
      return res.status(404).json({ error: 'Ticket type not found' });
    }

    // Check if this is the last ticket type for the event
    const ticketTypesCount = await TicketType.count({
      where: { event_id: ticketType.event_id }
    });

    if (ticketTypesCount <= 1) {
      return res.status(400).json({ 
        error: 'Cannot delete the last ticket type. Events must have at least one ticket type.' 
      });
    }

    // Check if there are any tickets using this ticket type
    const { Ticket } = require('../models');
    const ticketsCount = await Ticket.count({
      where: { ticket_type_id: ticketTypeId }
    });

    if (ticketsCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete ticket type as there are tickets associated with it' 
      });
    }

    await ticketType.destroy();

    res.json({
      message: 'Ticket type deleted successfully'
    });
  } catch (error) {
    console.error('Delete ticket type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};