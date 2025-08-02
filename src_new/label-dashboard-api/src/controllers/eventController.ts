import { Request, Response } from 'express';
import { Event, Ticket, EventReferrer, Brand } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: any;
}

const paymentService = new PaymentService();

// Helper function to generate verification PIN
const generateVerificationPIN = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to generate event slug (matches PHP logic)
const generateEventSlug = (title: string): string => {
  return title.replace(/[^A-Z0-9]/gi, '');
};

// Helper function to generate verification link (would integrate with Short.io in production)
const generateVerificationLink = (eventId: number, slug: string): string => {
  const domain = process.env.SHORT_IO_DOMAIN;
  if (!domain) {
    throw new Error('SHORT_IO_DOMAIN environment variable is required but not configured');
  }
  // In production, this would call Short.io API to create shortened URL
  // For now, return a URL structure using the configured domain
  return `https://${domain}/Verify${slug}`;
};

// Helper function to generate buy link (would integrate with Short.io in production)
const generateBuyLink = (eventId: number, slug: string): string => {
  const domain = process.env.SHORT_IO_DOMAIN;
  if (!domain) {
    throw new Error('SHORT_IO_DOMAIN environment variable is required but not configured');
  }
  // In production, this would call Short.io API to create shortened URL
  // For now, return a URL structure using the configured domain
  return `https://${domain}/Buy${slug}`;
};

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
    const eventId = parseInt(id, 10);
    
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findOne({
      where: { 
        id: eventId,
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
      rsvp_link,
      verification_pin,
      verification_link,
      supports_gcash,
      supports_qrph,
      supports_card,
      supports_ubp,
      supports_dob,
      supports_maya,
      supports_grabpay,
      max_tickets,
      ticket_naming,
      buy_shortlink,
      slug
    } = req.body;

    if (!title || !date_and_time || !venue || !ticket_price) {
      return res.status(400).json({ 
        error: 'Title, date/time, venue, and ticket price are required' 
      });
    }

    // Generate verification PIN and slug
    const eventSlug = (slug && slug.trim()) ? slug.trim() : generateEventSlug(title);
    const generatedPIN = verification_pin || generateVerificationPIN();
    
    let actualVerificationLink: string;
    let actualBuyLink: string;
    
    try {
      actualVerificationLink = verification_link || generateVerificationLink(0, eventSlug);
      actualBuyLink = buy_shortlink || generateBuyLink(0, eventSlug);
    } catch (error) {
      console.error('URL generation error:', error);
      return res.status(500).json({ 
        error: 'Server configuration error: SHORT_IO_DOMAIN is not configured' 
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
      verification_pin: generatedPIN,
      verification_link: actualVerificationLink,
      supports_gcash: supports_gcash !== undefined ? supports_gcash : true,
      supports_qrph: supports_qrph !== undefined ? supports_qrph : true,
      supports_card: supports_card !== undefined ? supports_card : true,
      supports_ubp: supports_ubp !== undefined ? supports_ubp : true,
      supports_dob: supports_dob !== undefined ? supports_dob : true,
      supports_maya: supports_maya !== undefined ? supports_maya : true,
      supports_grabpay: supports_grabpay !== undefined ? supports_grabpay : true,
      max_tickets: max_tickets || 0,
      ticket_naming: ticket_naming || 'Regular',
      buy_shortlink: actualBuyLink,
      brand_id: req.user.brand_id
    });

    // Update verification and buy links with actual event ID
    try {
      const finalVerificationLink = verification_link || generateVerificationLink(event.id, eventSlug);
      const finalBuyLink = buy_shortlink || generateBuyLink(event.id, eventSlug);
      
      await event.update({
        verification_link: finalVerificationLink,
        buy_shortlink: finalBuyLink
      });
    } catch (error) {
      console.error('URL generation error during update:', error);
      // Event was created but URL generation failed - still return success but log error
      console.warn('Event created but URL generation failed due to missing SHORT_IO_DOMAIN');
    }

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
    const eventId = parseInt(id, 10);
    
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    
    const {
      title,
      date_and_time,
      venue,
      description,
      ticket_price,
      close_time,
      poster_url,
      rsvp_link,
      verification_pin,
      verification_link,
      supports_gcash,
      supports_qrph,
      supports_card,
      supports_ubp,
      supports_dob,
      supports_maya,
      supports_grabpay,
      max_tickets,
      ticket_naming,
      buy_shortlink,
      slug
    } = req.body;

    const event = await Event.findOne({
      where: { 
        id: eventId,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Handle URL generation if new URLs are being set
    let updatedVerificationLink = verification_link || event.verification_link;
    let updatedBuyLink = buy_shortlink || event.buy_shortlink;
    
    // If slug is provided or title is being updated and no explicit links provided, regenerate them
    const needsUrlRegeneration = (slug || (title && title !== event.title)) && (!verification_link || !buy_shortlink);
    if (needsUrlRegeneration) {
      try {
        const newSlug = (slug && slug.trim()) ? slug.trim() : generateEventSlug(title || event.title);
        if (!verification_link) {
          updatedVerificationLink = generateVerificationLink(event.id, newSlug);
        }
        if (!buy_shortlink) {
          updatedBuyLink = generateBuyLink(event.id, newSlug);
        }
      } catch (error) {
        console.error('URL generation error during update:', error);
        return res.status(500).json({ 
          error: 'Server configuration error: SHORT_IO_DOMAIN is not configured' 
        });
      }
    }

    await event.update({
      title: title || event.title,
      date_and_time: date_and_time ? new Date(date_and_time) : event.date_and_time,
      venue: venue || event.venue,
      description,
      ticket_price: ticket_price !== undefined ? ticket_price : event.ticket_price,
      close_time: close_time ? new Date(close_time) : event.close_time,
      poster_url,
      rsvp_link,
      verification_pin: verification_pin || event.verification_pin,
      verification_link: updatedVerificationLink,
      supports_gcash: supports_gcash !== undefined ? supports_gcash : event.supports_gcash,
      supports_qrph: supports_qrph !== undefined ? supports_qrph : event.supports_qrph,
      supports_card: supports_card !== undefined ? supports_card : event.supports_card,
      supports_ubp: supports_ubp !== undefined ? supports_ubp : event.supports_ubp,
      supports_dob: supports_dob !== undefined ? supports_dob : event.supports_dob,
      supports_maya: supports_maya !== undefined ? supports_maya : event.supports_maya,
      supports_grabpay: supports_grabpay !== undefined ? supports_grabpay : event.supports_grabpay,
      max_tickets: max_tickets !== undefined ? max_tickets : event.max_tickets,
      ticket_naming: ticket_naming || event.ticket_naming,
      buy_shortlink: updatedBuyLink
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

    const eventIdNum = parseInt(event_id, 10);

    const event = await Event.findOne({
      where: { 
        id: eventIdNum,
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

    const eventIdNum = parseInt(event_id, 10);

    // Get event details
    const event = await Event.findOne({
      where: { 
        id: eventIdNum,
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
      event_id: eventIdNum,
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
      email_address,
      'ticket_created',
      {
        name,
        eventTitle: event.title,
        eventDate: event.date_and_time,
        eventVenue: event.venue,
        numberOfEntries: number_of_entries,
        ticketCode: ticketCode,
        ticketPrice: event.ticket_price,
        processingFee: processingFee,
        totalAmount: totalAmount + processingFee,
        paymentUrl: paymentLink.attributes.checkout_url
      },
      req.user.brand_id
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
    const eventIdNum = event_id ? parseInt(event_id as string, 10) : undefined;

    const where: any = {};
    if (event_id) {
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

      where.event_id = eventIdNum;
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

export const refreshVerificationPIN = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const eventId = parseInt(id, 10);
    
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findOne({
      where: { 
        id: eventId,
        brand_id: req.user.brand_id 
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Generate new verification PIN
    const newPIN = generateVerificationPIN();
    
    await event.update({
      verification_pin: newPIN
    });

    res.json({
      message: 'Verification PIN refreshed successfully',
      verification_pin: newPIN
    });
  } catch (error) {
    console.error('Refresh verification PIN error:', error);
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
      ticket.email_address,
      'payment_confirmed',
      {
        name: ticket.name,
        eventTitle: ticket.event.title,
        ticketCode: ticket.ticket_code
      },
      req.user.brand_id
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