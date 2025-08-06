import { Request, Response } from 'express';
import { Ticket, Event, EventReferrer, Brand, User, Domain } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import { generateUniqueTicketCode } from '../utils/ticketEmailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { Op } from 'sequelize';
import crypto from 'crypto';

const paymentService = new PaymentService();


// Helper function to get total tickets sold for an event
const getTotalTicketsSold = async (eventId: number): Promise<number> => {
  const result = await Ticket.sum('number_of_entries', {
    where: {
      event_id: eventId,
      status: {
        [Op.in]: ['Payment Confirmed', 'Ticket sent.']
      }
    }
  });
  return result || 0;
};

// Get event details for public ticket purchasing
export const getEventForPublic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id, 10);
    // Extract domain from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    let requestDomain = '';
    
    if (refererUrl) {
      try {
        const url = new URL(refererUrl);
        requestDomain = url.hostname;
      } catch (error) {
        console.error('Invalid referer URL:', refererUrl);
      }
    }
    
    console.log('=== BRAND VALIDATION DEBUG ===');
    console.log('Request domain:', requestDomain);
    console.log('Event ID:', eventId);
    
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findOne({
      where: { id: eventId },
      include: [
        { 
          model: Brand, 
          as: 'brand',
          attributes: ['id', 'brand_name', 'brand_color', 'logo_url'],
          include: [{
            model: Domain,
            as: 'domains',
            attributes: ['domain_name']
          }]
        }
      ]
    });
    
    console.log('Event found:', !!event);
    if (event) {
      console.log('Event brand ID:', event.brand?.id);
      console.log('Event brand name:', event.brand?.brand_name);
      console.log('Event brand domains:', event.brand?.domains?.map((d: any) => d.domain_name));
    }

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate that the event belongs to the brand associated with the current domain
    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);
      
      console.log('Domain validation check:');
      console.log('- Event brand domains:', eventBrandDomains);
      console.log('- Request domain:', requestDomain);
      console.log('- Domain valid:', isDomainValid);
      
      if (!isDomainValid) {
        console.log('VALIDATION FAILED: Domain not in event brand domains');
        return res.status(404).json({ error: 'Event not found' });
      }
      console.log('VALIDATION PASSED: Domain matches event brand');
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      console.log('VALIDATION FAILED: Missing validation data', {
        hasBrand: !!event.brand,
        hasDomains: !!(event.brand && event.brand.domains),
        hasRequestDomain: !!requestDomain,
        domainsCount: event.brand?.domains?.length || 0
      });
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event is closed
    const isEventClosed = event.close_time && new Date() > event.close_time;
    
    // Calculate remaining tickets if max_tickets is set
    let remainingTickets = null;
    if (event.max_tickets && event.max_tickets > 0) {
      const totalSold = await getTotalTicketsSold(eventId);
      remainingTickets = event.max_tickets - totalSold;
    }

    res.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        date_and_time: event.date_and_time,
        venue: event.venue,
        poster_url: event.poster_url,
        ticket_price: event.ticket_price,
        ticket_naming: event.ticket_naming || 'Regular',
        max_tickets: event.max_tickets,
        remaining_tickets: remainingTickets,
        is_closed: isEventClosed,
        supports_card: event.supports_card,
        supports_gcash: event.supports_gcash,
        supports_qrph: event.supports_qrph,
        supports_ubp: event.supports_ubp,
        supports_dob: event.supports_dob,
        supports_maya: event.supports_maya,
        supports_grabpay: event.supports_grabpay,
        buy_shortlink: event.buy_shortlink,
        brand: event.brand ? {
          id: event.brand.id,
          name: event.brand.brand_name,
          color: event.brand.brand_color,
          logo_url: event.brand.logo_url
        } : null
      }
    });
  } catch (error) {
    console.error('Get event for public error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTicketFromCode = async (req: Request, res: Response) => {
  try {
    const { event_id, verification_pin, ticket_code } = req.body;

    if (!event_id || !ticket_code) {
      return res.status(400).json({ error: 'Event ID and ticket code are required' });
    }

    const ticket = await Ticket.findOne({
      where: { 
        event_id,
        ticket_code: ticket_code.toUpperCase()
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          include: [{ model: Brand, as: 'brand' }]
        },
        { model: EventReferrer, as: 'referrer' }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify PIN if event requires it (you can add pin field to Event model)
    // For now, we'll assume all tickets are accessible

    res.json({
      ticket: {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        email_address: ticket.email_address,
        number_of_entries: ticket.number_of_entries,
        status: ticket.status,
        event: {
          title: ticket.event.title,
          date_and_time: ticket.event.date_and_time,
          venue: ticket.event.venue
        },
        referrer: ticket.referrer ? {
          name: ticket.referrer.name,
          code: ticket.referrer.referral_code
        } : null
      }
    });
  } catch (error) {
    console.error('Get ticket from code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const buyTicket = async (req: Request, res: Response) => {
  try {
    const {
      event_id,
      name,
      email_address,
      contact_number,
      number_of_entries = 1,
      referral_code
    } = req.body;

    if (!event_id || !name || !email_address || !contact_number) {
      return res.status(400).json({ 
        error: 'Event ID, name, email, and contact number are required' 
      });
    }

    const eventIdNum = parseInt(event_id, 10);
    // Extract domain from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    let requestDomain = '';
    
    if (refererUrl) {
      try {
        const url = new URL(refererUrl);
        requestDomain = url.hostname;
      } catch (error) {
        console.error('Invalid referer URL:', refererUrl);
      }
    }

    // Get event details
    const event = await Event.findOne({
      where: { id: eventIdNum },
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

    // Validate that the event belongs to the brand associated with the current domain
    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);
      
      if (!isDomainValid) {
        return res.status(404).json({ error: 'Event not found' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event is closed
    if (event.close_time && new Date() > event.close_time) {
      return res.status(400).json({ error: 'Ticket sales are closed for this event' });
    }

    // Check remaining tickets if max_tickets is set
    if (event.max_tickets && event.max_tickets > 0) {
      const totalSold = await getTotalTicketsSold(eventIdNum);
      const remainingTickets = event.max_tickets - totalSold;
      if (number_of_entries > remainingTickets) {
        return res.status(400).json({ error: 'Not enough tickets available' });
      }
    }

    // Find referrer if code provided
    let referrer = null;
    if (referral_code && referral_code.trim() !== '') {
      referrer = await EventReferrer.findOne({
        where: { 
          referral_code: referral_code.trim(),
          event_id: eventIdNum 
        }
      });
    }

    // Generate unique ticket code
    const ticketCode = await generateUniqueTicketCode(eventIdNum);

    // Calculate total amount
    const totalAmount = event.ticket_price * number_of_entries;
    const description = `${event.title} - Ticket #${ticketCode}`;

    // Prepare payment methods based on event settings
    const paymentMethods: string[] = [];
    if (event.supports_card) paymentMethods.push('card');
    if (event.supports_gcash) paymentMethods.push('gcash');
    if (event.supports_ubp) paymentMethods.push('dob_ubp');
    if (event.supports_dob) paymentMethods.push('dob');
    if (event.supports_qrph) paymentMethods.push('qrph');
    if (event.supports_maya) paymentMethods.push('paymaya');
    if (event.supports_grabpay) paymentMethods.push('grab_pay');

    // Get brand's domain for success URL (matching PHP implementation)
    const brandDomain = await getBrandFrontendUrl(event.brand_id);

    // Create checkout session with billing information (matching PHP implementation)
    const checkoutSession = await paymentService.createCheckoutSession({
      line_items: [{
        name: 'Tickets',
        amount: event.ticket_price * 100, // Convert to cents
        currency: 'PHP',
        quantity: number_of_entries
      }],
      payment_method_types: paymentMethods,
      success_url: `${brandDomain}/public/tickets/success/${eventIdNum}`,
      description,
      billing: {
        name: name,
        email: email_address,
        phone: contact_number
      }
    });

    if (!checkoutSession) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
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
      price_per_ticket: event.ticket_price,
      referrer_id: referrer?.id || null
    });

    // Store checkout session info in ticket
    await ticket.update({
      payment_link: checkoutSession.attributes.checkout_url,
      payment_link_id: checkoutSession.id
    });

    res.json({
      success: true,
      ticket_id: ticket.id,
      ticket_code: ticketCode,
      checkout_url: checkoutSession.attributes.checkout_url,
      total_amount: totalAmount,
      message: 'Ticket created successfully. Redirecting to payment...'
    });
  } catch (error) {
    console.error('Buy ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyTicket = async (req: Request, res: Response) => {
  try {
    const { ticket_code, event_id } = req.body;

    if (!ticket_code) {
      return res.status(400).json({ error: 'Ticket code is required' });
    }

    const where: any = { ticket_code: ticket_code.toUpperCase() };
    if (event_id) {
      where.event_id = event_id;
    }

    const ticket = await Ticket.findOne({
      where,
      include: [
        { 
          model: Event, 
          as: 'event',
          include: [{ model: Brand, as: 'brand' }]
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ 
        valid: false,
        error: 'Ticket not found' 
      });
    }

    const isValid = ticket.status === 'Payment Confirmed' || ticket.status === 'Ticket sent.';

    res.json({
      valid: isValid,
      ticket: isValid ? {
        ticket_code: ticket.ticket_code,
        name: ticket.name,
        number_of_entries: ticket.number_of_entries,
        status: ticket.status,
        event: {
          title: ticket.event.title,
          date_and_time: ticket.event.date_and_time,
          venue: ticket.event.venue
        }
      } : null,
      message: isValid ? 'Ticket is valid' : 'Ticket is not confirmed or has been cancelled'
    });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const ticketPaymentWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['paymongo-signature'] as string;
    const payload = req.body;

    // Process webhook using the comprehensive implementation
    const isValid = await paymentService.processWebhook(payload, signature);
    
    // Always respond with 200 OK as per PHP implementation
    // PayMongo expects a 200 response to consider the webhook delivered
    res.status(200).json({ received: true, processed: isValid });
  } catch (error) {
    console.error('Payment webhook error:', error);
    // Still respond with 200 to prevent PayMongo from retrying
    res.status(200).json({ received: true, processed: false, error: 'Processing failed' });
  }
};

export const checkPin = async (req: Request, res: Response) => {
  try {
    const { event_id, pin } = req.body;

    if (!event_id || !pin) {
      return res.status(400).json({ error: 'Event ID and PIN are required' });
    }

    const event = await Event.findByPk(event_id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // For now, we'll assume all events use a default PIN or no PIN
    // You can add a pin field to the Event model if needed
    const validPin = process.env.DEFAULT_EVENT_PIN || '1234';

    if (pin !== validPin) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    res.json({ 
      valid: true, 
      message: 'PIN verified successfully',
      event: {
        id: event.id,
        title: event.title,
        date_and_time: event.date_and_time,
        venue: event.venue
      }
    });
  } catch (error) {
    console.error('Check PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get brand information by domain
export const getBrandByDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Find domain and include brand information
    const domainRecord = await Domain.findOne({
      where: { 
        domain_name: domain
      },
      include: [{
        model: Brand,
        as: 'brand',
        attributes: [
          'id', 'brand_name', 'logo_url', 'brand_color', 'brand_website', 
          'favicon_url', 'release_submission_url', 'catalog_prefix'
        ]
      }]
    });

    if (!domainRecord || !domainRecord.brand) {
      return res.status(404).json({ error: 'Brand not found for this domain' });
    }

    res.json({
      domain: domainRecord.domain_name,
      brand: {
        id: domainRecord.brand.id,
        name: domainRecord.brand.brand_name,
        logo_url: domainRecord.brand.logo_url,
        brand_color: domainRecord.brand.brand_color,
        brand_website: domainRecord.brand.brand_website,
        favicon_url: domainRecord.brand.favicon_url,
        release_submission_url: domainRecord.brand.release_submission_url,
        catalog_prefix: domainRecord.brand.catalog_prefix
      }
    });
  } catch (error) {
    console.error('Get brand by domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};