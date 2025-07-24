import { Request, Response } from 'express';
import { Event, Ticket, EventReferrer, Brand } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: any;
}

const paymentService = new PaymentService();

export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const events = await Event.findAll({
      where: { brand_id: req.user.brand_id },
      include: [
        { model: Brand, as: 'brand' },
        { model: Ticket, as: 'tickets' },
        { model: EventReferrer, as: 'referrers' }
      ],
      order: [['date_and_time', 'DESC']]
    });

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
      include: [
        { model: Brand, as: 'brand' },
        { model: Ticket, as: 'tickets' },
        { model: EventReferrer, as: 'referrers' }
      ]
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      title,
      date_and_time,
      venue,
      description,
      ticket_price,
      close_time,
      poster_url,
      rsvp_link
    } = req.body;

    if (!title || !date_and_time || !venue || !ticket_price) {
      return res.status(400).json({ 
        error: 'Title, date/time, venue, and ticket price are required' 
      });
    }

    const event = await Event.create({
      title,
      date_and_time: new Date(date_and_time),
      venue,
      description,
      ticket_price,
      close_time: close_time ? new Date(close_time) : null,
      poster_url,
      rsvp_link,
      brand_id: req.user.brand_id
    });

    res.status(201).json({
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const {
      title,
      date_and_time,
      venue,
      description,
      ticket_price,
      close_time,
      poster_url,
      rsvp_link
    } = req.body;

    const event = await Event.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await event.update({
      title: title || event.title,
      date_and_time: date_and_time ? new Date(date_and_time) : event.date_and_time,
      venue: venue || event.venue,
      description,
      ticket_price: ticket_price !== undefined ? ticket_price : event.ticket_price,
      close_time: close_time ? new Date(close_time) : event.close_time,
      poster_url,
      rsvp_link
    });

    res.json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setSelectedEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const event = await Event.findOne({
      where: { 
        id: event_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ 
      message: 'Selected event updated',
      selected_event_id: event_id,
      event: {
        id: event.id,
        title: event.title,
        date_and_time: event.date_and_time
      }
    });
  } catch (error) {
    console.error('Set selected event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      event_id,
      name,
      email_address,
      contact_number,
      number_of_entries = 1,
      referrer_code
    } = req.body;

    if (!event_id || !name || !email_address) {
      return res.status(400).json({ 
        error: 'Event ID, name, and email are required' 
      });
    }

    // Get event details
    const event = await Event.findOne({
      where: { 
        id: event_id,
        brand_id: req.user.brand_id 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event is closed
    if (event.close_time && new Date() > event.close_time) {
      return res.status(400).json({ error: 'Ticket sales are closed for this event' });
    }

    // Find referrer if code provided
    let referrer = null;
    if (referrer_code) {
      referrer = await EventReferrer.findOne({
        where: { 
          referral_code: referrer_code,
          event_id 
        }
      });
    }

    // Generate unique ticket code
    const ticketCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Calculate total amount and processing fee
    const totalAmount = event.ticket_price * number_of_entries;
    const processingFee = paymentService.calculateProcessingFee(totalAmount);

    // Create PayMongo payment link
    const paymentLink = await paymentService.createPaymentLink({
      amount: (totalAmount + processingFee) * 100, // Convert to cents
      description: `${event.title} - ${number_of_entries} ticket(s)`,
      remarks: `Ticket code: ${ticketCode}`
    });

    if (!paymentLink) {
      return res.status(500).json({ error: 'Failed to create payment link' });
    }

    // Create ticket record
    const ticket = await Ticket.create({
      event_id,
      name,
      email_address,
      contact_number,
      number_of_entries,
      ticket_code: ticketCode,
      status: 'New',
      payment_link: paymentLink.attributes.checkout_url,
      payment_link_id: paymentLink.id,
      price_per_ticket: event.ticket_price,
      payment_processing_fee: processingFee,
      referrer_id: referrer?.id || null
    });

    // Send ticket email with payment link
    await sendBrandedEmail(
      [email_address],
      `Your ticket for ${event.title}`,
      'ticket_created',
      {
        body: `
          <h2>Your Ticket Details</h2>
          <p>Hi ${name}!</p>
          <p>Thank you for your interest in <strong>${event.title}</strong>!</p>
          
          <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3>Event Details</h3>
            <p><strong>Event:</strong> ${event.title}</p>
            <p><strong>Date:</strong> ${event.date_and_time}</p>
            <p><strong>Venue:</strong> ${event.venue}</p>
            <p><strong>Tickets:</strong> ${number_of_entries}</p>
            <p><strong>Ticket Code:</strong> ${ticketCode}</p>
          </div>

          <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3>Payment Information</h3>
            <p><strong>Amount per ticket:</strong> ₱${event.ticket_price}</p>
            <p><strong>Processing fee:</strong> ₱${processingFee}</p>
            <p><strong>Total amount:</strong> ₱${totalAmount + processingFee}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink.attributes.checkout_url}" 
               style="background: #4caf50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
               Pay Now
            </a>
          </div>

          <p><em>Please complete your payment to secure your tickets. You will receive your official tickets via email once payment is confirmed.</em></p>
        `
      },
      event.brand
    );

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket: {
        id: ticket.id,
        ticket_code: ticketCode,
        payment_link: paymentLink.attributes.checkout_url,
        total_amount: totalAmount + processingFee
      }
    });
  } catch (error) {
    console.error('Add ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id } = req.query;

    const where: any = {};
    if (event_id) {
      // Verify user has access to this event
      const event = await Event.findOne({
        where: { 
          id: event_id,
          brand_id: req.user.brand_id 
        }
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      where.event_id = event_id;
    }

    const tickets = await Ticket.findAll({
      where,
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id }
        },
        { model: EventReferrer, as: 'referrer' }
      ],
      order: [['id', 'DESC']]
    });

    res.json({ tickets });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markTicketPaid = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { ticket_id } = req.body;

    if (!ticket_id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    const ticket = await Ticket.findOne({
      where: { id: ticket_id },
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id },
          include: [{ model: Brand, as: 'brand' }]
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await ticket.update({ status: 'Payment Confirmed' });

    // Send confirmation email
    await sendBrandedEmail(
      [ticket.email_address],
      `Payment Confirmed - ${ticket.event.title}`,
      'payment_confirmed',
      {
        body: `
          <h2>Payment Confirmed!</h2>
          <p>Hi ${ticket.name}!</p>
          <p>Your payment for <strong>${ticket.event.title}</strong> has been confirmed.</p>
          <p><strong>Ticket Code:</strong> ${ticket.ticket_code}</p>
          <p>You will receive your official tickets shortly.</p>
        `
      },
      ticket.event.brand
    );

    res.json({ 
      message: 'Ticket marked as paid successfully',
      ticket
    });
  } catch (error) {
    console.error('Mark ticket paid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};