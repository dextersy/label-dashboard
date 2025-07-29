import { Request, Response } from 'express';
import { Ticket, Event, EventReferrer, Brand, User, Domain } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import crypto from 'crypto';

const paymentService = new PaymentService();

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
      referrer_code,
      payment_method = 'card'
    } = req.body;

    if (!event_id || !name || !email_address) {
      return res.status(400).json({ 
        error: 'Event ID, name, and email are required' 
      });
    }

    // Get event details
    const event = await Event.findOne({
      where: { id: event_id },
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
    const processingFee = paymentService.calculateProcessingFee(totalAmount, payment_method);

    // Create checkout session for public purchase
    const checkoutSession = await paymentService.createCheckoutSession({
      line_items: [{
        name: `${event.title} - Ticket`,
        amount: (event.ticket_price + processingFee / number_of_entries) * 100, // Convert to cents
        currency: 'PHP',
        quantity: number_of_entries
      }],
      payment_method_types: [payment_method, 'gcash', 'grab_pay'],
      success_url: `${process.env.FRONTEND_URL}/tickets/success?ticket_code=${ticketCode}`,
      cancel_url: `${process.env.FRONTEND_URL}/tickets/buy?event_id=${event_id}`,
      description: `${event.title} - ${number_of_entries} ticket(s)`
    });

    if (!checkoutSession) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
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
      payment_link: checkoutSession.attributes.checkout_url,
      payment_link_id: checkoutSession.id,
      price_per_ticket: event.ticket_price,
      payment_processing_fee: processingFee,
      referrer_id: referrer?.id || null
    });

    res.json({
      ticket_code: ticketCode,
      checkout_url: checkoutSession.attributes.checkout_url,
      total_amount: totalAmount + processingFee,
      message: 'Ticket created successfully. Complete payment to confirm.'
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

    // Verify webhook signature
    const isValid = await paymentService.processWebhook(payload, signature);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = payload.data;
    
    if (event.attributes.type === 'payment.paid') {
      const paymentIntentId = event.attributes.data.id;
      
      // Find ticket by payment link ID
      const ticket = await Ticket.findOne({
        where: { payment_link_id: paymentIntentId },
        include: [
          { 
            model: Event, 
            as: 'event',
            include: [{ model: Brand, as: 'brand' }]
          }
        ]
      });

      if (ticket) {
        // Update ticket status
        await ticket.update({ status: 'Payment Confirmed' });

        // Send confirmation email
        await sendBrandedEmail(
          ticket.email_address,
          'payment_confirmed',
          {
            name: ticket.name,
            eventTitle: ticket.event.title,
            ticketCode: ticket.ticket_code,
            eventDate: ticket.event.date_and_time,
            eventVenue: ticket.event.venue,
            numberOfEntries: ticket.number_of_entries
          },
          ticket.event.brand_id
        );

        // Update ticket status to sent
        await ticket.update({ status: 'Ticket sent.' });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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