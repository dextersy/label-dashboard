import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Event, Brand, Domain, Ticket, TicketType, EventReferrer, User, WalkInType, WalkInTransaction, WalkInTransactionItem, EventDay, TicketTypeDay, TicketScanLog } from '../models';
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
      include: [
        {
          model: Brand,
          as: 'brand',
          include: [{
            model: Domain,
            as: 'domains',
            attributes: ['domain_name']
          }]
        },
        { model: EventDay, as: 'days', order: [['date_and_time', 'ASC']] }
      ]
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

    const eventDays: any[] = (event as any).days ?? [];
    const sortedDays = [...eventDays].sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime());

    res.json({
      token,
      event: {
        id: event.id,
        title: event.title,
        date_and_time: event.date_and_time,
        venue: event.venue,
        poster_url: event.poster_url,
        days: sortedDays.map(d => ({ id: d.id, date_and_time: d.date_and_time, label: d.label })),
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
 * Find the EventDay matching today's calendar date for a given event.
 * Returns null if no day matches today (soft warning — scanning is still allowed by caller).
 */
const findActiveEventDays = async (eventId: number): Promise<EventDay[]> => {
  const days = await EventDay.findAll({ where: { event_id: eventId } });
  if (days.length === 0) return [];
  if (days.length === 1) return days;

  const nowMs = Date.now();
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  return days.filter(d => {
    const eventDate = new Date(d.date_and_time);
    const eventMidnightUTC = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
    const windowStart = eventDate.getTime() - EIGHT_HOURS_MS;
    const windowEnd = eventMidnightUTC + 24 * 60 * 60 * 1000;
    return nowMs >= windowStart && nowMs < windowEnd;
  });
};

/**
 * From a list of active event days, find the one this ticket type is valid for.
 * Returns the matching day, or null if none match.
 */
const resolveEventDayForTicket = async (activeDays: EventDay[], ticketTypeId: number | null): Promise<EventDay | null> => {
  if (activeDays.length === 0) return null;
  // When multiple days are active (Day N's window overlaps Day N+1's 8-hour pre-window),
  // prefer the latest active day.
  const sorted = [...activeDays].sort((a, b) => new Date(b.date_and_time).getTime() - new Date(a.date_and_time).getTime());
  if (!ticketTypeId) return sorted[0];

  for (const day of sorted) {
    const link = await TicketTypeDay.findOne({ where: { ticket_type_id: ticketTypeId, event_day_id: day.id } });
    if (link) return day;
  }
  return null;
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

    // Determine current event day for this specific ticket
    const activeDays = await findActiveEventDays(eventId!);
    const currentEventDay = await resolveEventDayForTicket(activeDays, ticket.ticket_type_id);

    // If there are active days but none match this ticket type, it's not valid today
    if (activeDays.length > 0 && !currentEventDay) {
      return res.status(403).json({ error: 'This ticket is not valid for today' });
    }

    // Compute per-day claimed count
    let claimedToday = 0;
    let remainingToday = ticket.number_of_entries;
    if (currentEventDay) {
      const { Op } = require('sequelize');
      const result = await TicketScanLog.sum('entries_claimed', {
        where: { ticket_id: ticket.id, event_day_id: currentEventDay.id }
      });
      claimedToday = result || 0;
      remainingToday = ticket.number_of_entries - claimedToday;
    }

    res.json({
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        email_address: ticket.email_address,
        number_of_entries: ticket.number_of_entries,
        number_of_claimed_entries: ticket.number_of_claimed_entries,
        claimed_today: claimedToday,
        remaining_today: remainingToday,
        remaining_entries: remainingToday,
        status: ticket.status,
        current_event_day: currentEventDay ? {
          id: currentEventDay.id,
          date_and_time: currentEventDay.date_and_time,
          label: currentEventDay.label
        } : null,
        no_matching_day: !currentEventDay,
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

    // Determine current event day for this specific ticket
    const activeDays = await findActiveEventDays(eventId!);
    const currentEventDay = await resolveEventDayForTicket(activeDays, ticket.ticket_type_id);

    // If there are active days but none match this ticket type, it's not valid today
    if (activeDays.length > 0 && !currentEventDay) {
      return res.status(403).json({ error: 'This ticket is not valid for today' });
    }

    // Wrap the read-validate-write in a transaction with row lock to prevent double check-in
    const t = await sequelize.transaction();
    let claimedToday = 0;
    let remainingToday = 0;
    try {
      // Lock the ticket row for the duration of this transaction
      await Ticket.findOne({
        where: { id: ticket.id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (currentEventDay) {
        const result = await TicketScanLog.sum('entries_claimed', {
          where: { ticket_id: ticket.id, event_day_id: currentEventDay.id },
          transaction: t
        });
        claimedToday = result || 0;
      }
      remainingToday = ticket.number_of_entries - claimedToday;

      if (entriesToClaimNum > remainingToday) {
        await t.rollback();
        return res.status(400).json({
          error: `Cannot claim ${entriesToClaimNum} entries. Only ${remainingToday} entries remaining today.`
        });
      }

      // Create scan log entry
      if (currentEventDay) {
        await TicketScanLog.create({
          ticket_id: ticket.id,
          event_day_id: currentEventDay.id,
          entries_claimed: entriesToClaimNum,
          scanned_at: new Date()
        }, { transaction: t });
      }

      // Update cumulative claimed count on ticket for backward compat
      const newClaimedEntries = ticket.number_of_claimed_entries + entriesToClaimNum;
      await ticket.update({ number_of_claimed_entries: newClaimedEntries }, { transaction: t });

      await t.commit();
    } catch (txError) {
      await t.rollback();
      throw txError;
    }

    const updatedRemainingToday = remainingToday - entriesToClaimNum;
    const newClaimedEntries = ticket.number_of_claimed_entries + entriesToClaimNum;

    res.json({
      success: true,
      message: `Successfully checked in ${entriesToClaimNum} ${entriesToClaimNum === 1 ? 'entry' : 'entries'}`,
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        number_of_entries: ticket.number_of_entries,
        number_of_claimed_entries: newClaimedEntries,
        claimed_today: claimedToday + entriesToClaimNum,
        remaining_today: updatedRemainingToday,
        remaining_entries: updatedRemainingToday,
        current_event_day: currentEventDay ? {
          id: currentEventDay.id,
          date_and_time: currentEventDay.date_and_time,
          label: currentEventDay.label
        } : null,
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
