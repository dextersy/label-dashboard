import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Event, Brand, Domain, Ticket, TicketType, EventReferrer, User, WalkInType, WalkInTransaction, WalkInTransactionItem } from '../models';
import { sequelize } from '../config/database';
import { getRequestDomain } from '../utils/requestUtils';
import { ScannerRequest } from '../middleware/scannerAuth';

/**
 * POST /api/scanner/login
 * Validates PIN and returns a JWT scanner token (1 hour expiry).
 */
export const scannerLogin = async (req: Request, res: Response) => {
  try {
    const { event_id, pin } = req.body;

    if (!event_id || !pin) {
      return res.status(400).json({ error: 'Event ID and PIN are required' });
    }

    const requestDomain = getRequestDomain(req);

    const event = await Event.findOne({
      where: { id: event_id },
      include: [{
        model: Brand,
        as: 'brand',
        include: [{
          model: Domain,
          as: 'domains',
          attributes: ['domain_name']
        }]
      }]
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      if (!eventBrandDomains.includes(requestDomain)) {
        return res.status(404).json({ error: 'Event not found' });
      }
    } else {
      return res.status(404).json({ error: 'Event not found' });
    }

    const pinBuffer = Buffer.from(String(pin));
    const correctPinBuffer = Buffer.from(String(event.verification_pin));
    if (pinBuffer.length !== correctPinBuffer.length || !crypto.timingSafeEqual(pinBuffer, correctPinBuffer)) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = jwt.sign(
      { eventId: event.id, brandId: event.brand_id, type: 'scanner' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      event: {
        id: event.id,
        title: event.title,
        date_and_time: event.date_and_time,
        venue: event.venue,
        poster_url: event.poster_url,
        brand: event.brand ? {
          id: event.brand.id,
          name: event.brand.brand_name,
          color: event.brand.brand_color,
          logo_url: event.brand.logo_url
        } : null
      }
    });
  } catch (error) {
    console.error('Scanner login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/scanner/ticket
 * Look up a ticket by code. Requires scanner JWT.
 */
export const scannerGetTicket = async (req: ScannerRequest, res: Response) => {
  try {
    const { ticket_code } = req.body;
    const eventId = req.scannerEventId;

    if (!ticket_code) {
      return res.status(400).json({ error: 'Ticket code is required' });
    }

    const ticket = await Ticket.findOne({
      where: {
        event_id: eventId,
        ticket_code: ticket_code.toUpperCase()
      },
      include: [
        {
          model: Event,
          as: 'event'
        },
        {
          model: TicketType,
          as: 'ticketType',
          attributes: ['id', 'name', 'price', 'special_instructions_for_scanner']
        },
        { model: EventReferrer, as: 'referrer' }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status !== 'Ticket sent.') {
      return res.status(404).json({ error: 'Ticket not found or not confirmed' });
    }

    const remainingEntries = ticket.number_of_entries - ticket.number_of_claimed_entries;

    res.json({
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        email_address: ticket.email_address,
        number_of_entries: ticket.number_of_entries,
        number_of_claimed_entries: ticket.number_of_claimed_entries,
        remaining_entries: remainingEntries,
        status: ticket.status,
        event: {
          id: ticket.event.id,
          title: ticket.event.title,
          date_and_time: ticket.event.date_and_time,
          venue: ticket.event.venue
        },
        referrer: ticket.referrer ? {
          name: ticket.referrer.name,
          code: ticket.referrer.referral_code
        } : null,
        ticketType: (ticket as any).ticketType ? {
          id: (ticket as any).ticketType.id,
          name: (ticket as any).ticketType.name,
          price: (ticket as any).ticketType.price,
          special_instructions_for_scanner: (ticket as any).ticketType.special_instructions_for_scanner || null
        } : null
      }
    });
  } catch (error) {
    console.error('Scanner get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/scanner/check-in
 * Check in ticket entries. Requires scanner JWT.
 */
export const scannerCheckIn = async (req: ScannerRequest, res: Response) => {
  try {
    const { ticket_code, entries_to_claim } = req.body;
    const eventId = req.scannerEventId;

    if (!ticket_code || !entries_to_claim) {
      return res.status(400).json({ error: 'Ticket code and entries to claim are required' });
    }

    const entriesToClaimNum = parseInt(entries_to_claim, 10);
    if (isNaN(entriesToClaimNum) || entriesToClaimNum < 1) {
      return res.status(400).json({ error: 'Entries to claim must be a valid number greater than 0' });
    }

    const ticket = await Ticket.findOne({
      where: {
        event_id: eventId,
        ticket_code: ticket_code.toUpperCase()
      },
      include: [{
        model: Event,
        as: 'event'
      }]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status !== 'Ticket sent.') {
      return res.status(400).json({ error: 'Ticket is not confirmed and cannot be checked in' });
    }

    const remainingEntries = ticket.number_of_entries - ticket.number_of_claimed_entries;

    if (entriesToClaimNum > remainingEntries) {
      return res.status(400).json({
        error: `Cannot claim ${entriesToClaimNum} entries. Only ${remainingEntries} entries remaining.`
      });
    }

    const newClaimedEntries = ticket.number_of_claimed_entries + entriesToClaimNum;
    await ticket.update({
      number_of_claimed_entries: newClaimedEntries
    });

    const updatedRemainingEntries = ticket.number_of_entries - newClaimedEntries;

    res.json({
      success: true,
      message: `Successfully checked in ${entriesToClaimNum} ${entriesToClaimNum === 1 ? 'entry' : 'entries'}`,
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        number_of_entries: ticket.number_of_entries,
        number_of_claimed_entries: newClaimedEntries,
        remaining_entries: updatedRemainingEntries,
        event: {
          id: ticket.event.id,
          title: ticket.event.title,
          date_and_time: ticket.event.date_and_time,
          venue: ticket.event.venue
        }
      }
    });
  } catch (error) {
    console.error('Scanner check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/scanner/walk-in/types
 * Get walk-in types for the event. Requires scanner JWT.
 */
export const scannerGetWalkInTypes = async (req: ScannerRequest, res: Response) => {
  try {
    const event = req.scannerEvent;

    if (!event.walk_in_enabled) {
      return res.status(400).json({ error: 'Walk-in is not enabled for this event' });
    }

    const walkInTypes = await WalkInType.findAll({
      where: { event_id: event.id },
      order: [['id', 'ASC']]
    });

    const processedTypes = [];
    let totalSoldCount = 0;
    for (const wit of walkInTypes) {
      const soldCount = await wit.getSoldCount();
      const remainingSlots = await wit.getRemainingSlots();
      totalSoldCount += soldCount;

      processedTypes.push({
        id: wit.id,
        name: wit.name,
        price: wit.price,
        max_slots: wit.max_slots,
        sold_count: soldCount,
        remaining_slots: remainingSlots
      });
    }

    res.json({
      walkInTypes: processedTypes,
      payment_methods: {
        cash: event.walk_in_supports_cash,
        gcash: event.walk_in_supports_gcash,
        card: event.walk_in_supports_card
      },
      walk_in_max_count: event.walk_in_max_count,
      total_sold_count: totalSoldCount
    });
  } catch (error) {
    console.error('Scanner get walk-in types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/scanner/walk-in/register
 * Register a walk-in transaction. Requires scanner JWT.
 */
export const scannerRegisterWalkIn = async (req: ScannerRequest, res: Response) => {
  try {
    const { payment_method, payment_reference, items } = req.body;
    const event = req.scannerEvent;

    if (!payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Payment method and items are required' });
    }

    const validMethods = ['cash', 'gcash', 'card'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    if (!event.walk_in_enabled) {
      return res.status(400).json({ error: 'Walk-in is not enabled for this event' });
    }

    if (payment_method === 'cash' && !event.walk_in_supports_cash) {
      return res.status(400).json({ error: 'Cash payment is not enabled for walk-in' });
    }
    if (payment_method === 'gcash' && !event.walk_in_supports_gcash) {
      return res.status(400).json({ error: 'GCash payment is not enabled for walk-in' });
    }
    if (payment_method === 'card' && !event.walk_in_supports_card) {
      return res.status(400).json({ error: 'Card payment is not enabled for walk-in' });
    }

    let totalAmount = 0;
    const validatedItems: Array<{ walk_in_type_id: number; quantity: number; price_per_unit: number }> = [];

    for (const item of items) {
      if (!item.walk_in_type_id || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: 'Each item must have walk_in_type_id and quantity >= 1' });
      }

      const walkInType = await WalkInType.findOne({
        where: { id: item.walk_in_type_id, event_id: event.id }
      });

      if (!walkInType) {
        return res.status(400).json({ error: `Walk-in type ${item.walk_in_type_id} not found` });
      }

      if (walkInType.max_slots > 0) {
        const remainingSlots = await walkInType.getRemainingSlots();
        if (remainingSlots !== null && item.quantity > remainingSlots) {
          return res.status(400).json({
            error: `Not enough slots for "${walkInType.name}". Only ${remainingSlots} remaining.`
          });
        }
      }

      const pricePerUnit = walkInType.price;
      totalAmount += pricePerUnit * item.quantity;
      validatedItems.push({
        walk_in_type_id: walkInType.id,
        quantity: item.quantity,
        price_per_unit: pricePerUnit
      });
    }

    // Enforce general walk-in max count (across all types)
    if (event.walk_in_max_count > 0) {
      const totalItemQty = validatedItems.reduce((sum, item) => sum + item.quantity, 0);

      // Get current total sold count across all walk-in types for this event
      const walkInTypesForEvent = await WalkInType.findAll({ where: { event_id: event.id } });
      let currentTotalSold = 0;
      for (const wit of walkInTypesForEvent) {
        currentTotalSold += await wit.getSoldCount();
      }

      const remaining = event.walk_in_max_count - currentTotalSold;
      if (totalItemQty > remaining) {
        return res.status(400).json({
          error: `Walk-in limit reached. Only ${remaining} walk-in${remaining === 1 ? '' : 's'} remaining out of ${event.walk_in_max_count} total.`
        });
      }
    }

    const systemUser = await User.findOne({
      where: { brand_id: event.brand_id, is_admin: true }
    });

    if (!systemUser) {
      return res.status(500).json({ error: 'No admin user found for brand' });
    }

    const t = await sequelize.transaction();
    try {
      const transaction = await WalkInTransaction.create({
        event_id: event.id,
        payment_method,
        payment_reference: payment_reference || null,
        total_amount: totalAmount,
        registered_by: systemUser.id
      }, { transaction: t });

      for (const item of validatedItems) {
        await WalkInTransactionItem.create({
          walk_in_transaction_id: transaction.id,
          walk_in_type_id: item.walk_in_type_id,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit
        }, { transaction: t });
      }

      await t.commit();

      res.json({
        success: true,
        message: 'Walk-in registered successfully',
        transaction: {
          id: transaction.id,
          total_amount: totalAmount,
          payment_method,
          items: validatedItems
        }
      });
    } catch (txError) {
      await t.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Scanner register walk-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
