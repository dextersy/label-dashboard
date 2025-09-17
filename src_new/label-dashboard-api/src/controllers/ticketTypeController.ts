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

    res.json({ ticketTypes });
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

    const { event_id, name, price } = req.body;

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
      price: priceNum
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
    const { name, price } = req.body;

    const ticketTypeId = parseInt(id, 10);

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

    await ticketType.update({
      name: name.trim(),
      price: priceNum
    });

    res.json({
      message: 'Ticket type updated successfully',
      ticketType
    });
  } catch (error) {
    console.error('Update ticket type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTicketType = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const ticketTypeId = parseInt(id, 10);

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