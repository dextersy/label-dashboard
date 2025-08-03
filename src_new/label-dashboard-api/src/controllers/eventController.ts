import { Request, Response } from 'express';
import { Event, Ticket, EventReferrer, Brand, Domain } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import { sendTicketEmail, sendTicketCancellationEmail, sendPaymentLinkEmail, sendPaymentConfirmationEmail, generateUniqueTicketCode } from '../utils/ticketEmailService';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import AWS from 'aws-sdk';

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

// Helper function to create Short.io link
const createShortLink = async (originalUrl: string, path: string): Promise<string> => {
  const shortIoDomain = process.env.SHORT_IO_DOMAIN;
  const shortIoKey = process.env.SHORT_IO_KEY;
  
  if (!shortIoDomain || !shortIoKey) {
    throw new Error('SHORT_IO_DOMAIN and SHORT_IO_KEY environment variables are required but not configured');
  }

  try {
    const response = await fetch('https://api.short.io/links', {
      method: 'POST',
      headers: {
        'Authorization': shortIoKey,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        domain: shortIoDomain,
        originalURL: originalUrl,
        path: path
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Short.io API error:', response.status, errorText);
      throw new Error(`Short.io API error: ${response.status}`);
    }

    const data = await response.json() as { secureShortURL: string };
    return data.secureShortURL;
  } catch (error) {
    console.error('Failed to create short link:', error);
    throw error;
  }
};

// Helper function to get brand's frontend URL
const getBrandFrontendUrl = async (brandId: number): Promise<string> => {
  // First try to get a verified domain for the brand
  const verifiedDomain = await Domain.findOne({
    where: { 
      brand_id: brandId,
      status: 'Verified'
    }
  });
  
  if (verifiedDomain) {
    return `https://${verifiedDomain.domain_name}`;
  }
  
  // Fallback to any domain if no verified domain exists
  const anyDomain = await Domain.findOne({
    where: { brand_id: brandId }
  });
  
  if (anyDomain) {
    return `https://${anyDomain.domain_name}`;
  }
  
  // Final fallback to environment variable or default
  const fallbackUrl = process.env.FRONTEND_URL;
  if (!fallbackUrl) {
    throw new Error('No domains found for brand and FRONTEND_URL environment variable is not configured');
  }
  
  return fallbackUrl;
};

// Helper function to generate verification link
const generateVerificationLink = async (eventId: number, slug: string, brandId: number): Promise<string> => {
  const frontendUrl = await getBrandFrontendUrl(brandId);
  const originalUrl = `${frontendUrl}/public/tickets/verify/${eventId}`;
  const path = `Verify${slug}`;
  return await createShortLink(originalUrl, path);
};

// Helper function to generate buy link
const generateBuyLink = async (eventId: number, slug: string, brandId: number): Promise<string> => {
  const frontendUrl = await getBrandFrontendUrl(brandId);
  const originalUrl = `${frontendUrl}/public/tickets/buy/${eventId}`;
  const path = `Buy${slug}`;
  return await createShortLink(originalUrl, path);
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

    // Handle poster upload if provided
    let finalPosterUrl = poster_url;
    if (req.file) {
      // Generate unique filename for S3
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const fileName = `event-poster-${uniqueSuffix}${extension}`;

      try {
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();
        finalPosterUrl = result.Location;
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload poster image' });
      }
    }

    // Generate verification PIN and slug
    const eventSlug = (slug && slug.trim()) ? slug.trim() : generateEventSlug(title);
    const generatedPIN = verification_pin || generateVerificationPIN();
    
    // Create event without shortlinks first to get the ID
    const event = await Event.create({
      title,
      date_and_time: new Date(date_and_time),
      venue,
      description,
      ticket_price,
      close_time: close_time ? new Date(close_time) : null,
      poster_url: finalPosterUrl,
      rsvp_link,
      verification_pin: generatedPIN,
      verification_link: verification_link || '', // Placeholder, will be updated below
      supports_gcash: supports_gcash !== undefined ? supports_gcash : true,
      supports_qrph: supports_qrph !== undefined ? supports_qrph : true,
      supports_card: supports_card !== undefined ? supports_card : true,
      supports_ubp: supports_ubp !== undefined ? supports_ubp : true,
      supports_dob: supports_dob !== undefined ? supports_dob : true,
      supports_maya: supports_maya !== undefined ? supports_maya : true,
      supports_grabpay: supports_grabpay !== undefined ? supports_grabpay : true,
      max_tickets: max_tickets || 0,
      ticket_naming: ticket_naming || 'Regular',
      buy_shortlink: buy_shortlink || '', // Placeholder, will be updated below
      brand_id: req.user.brand_id
    });

    // Generate shortlinks with actual event ID
    try {
      let finalVerificationLink = verification_link;
      let finalBuyLink = buy_shortlink;
      
      // Only generate shortlinks if not provided
      if (!verification_link) {
        finalVerificationLink = await generateVerificationLink(event.id, eventSlug, req.user.brand_id);
      }
      
      if (!buy_shortlink) {
        finalBuyLink = await generateBuyLink(event.id, eventSlug, req.user.brand_id);
      }
      
      // Update event with generated shortlinks
      await event.update({
        verification_link: finalVerificationLink,
        buy_shortlink: finalBuyLink
      });
      
      // Refresh event to get updated values
      await event.reload();
    } catch (error) {
      console.error('URL generation error:', error);
      // Event was created but URL generation failed - still return success but log error
      console.warn('Event created but shortlink generation failed:', error.message);
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

    // Handle poster upload if provided
    let finalPosterUrl = poster_url || event.poster_url;
    if (req.file) {
      // Generate unique filename for S3
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const fileName = `event-poster-${eventId}-${uniqueSuffix}${extension}`;

      try {
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();
        finalPosterUrl = result.Location;

        // Delete old poster from S3 if it exists
        if (event.poster_url && event.poster_url.startsWith('https://')) {
          try {
            const oldUrl = new URL(event.poster_url);
            const oldKey = oldUrl.pathname.substring(1);
            
            await s3.deleteObject({
              Bucket: process.env.S3_BUCKET!,
              Key: oldKey
            }).promise();
          } catch (deleteError) {
            console.error('Error deleting old poster:', deleteError);
          }
        }
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload poster image' });
      }
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
          updatedVerificationLink = await generateVerificationLink(event.id, newSlug, req.user.brand_id);
        }
        if (!buy_shortlink) {
          updatedBuyLink = await generateBuyLink(event.id, newSlug, req.user.brand_id);
        }
      } catch (error) {
        console.error('URL generation error during update:', error);
        console.warn('URL generation failed but continuing with event update:', error.message);
        // Don't fail the entire update if shortlink generation fails
      }
    }

    await event.update({
      title: title || event.title,
      date_and_time: date_and_time ? new Date(date_and_time) : event.date_and_time,
      venue: venue || event.venue,
      description,
      ticket_price: ticket_price !== undefined ? ticket_price : event.ticket_price,
      close_time: close_time ? new Date(close_time) : event.close_time,
      poster_url: finalPosterUrl,
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
      referrer_code,
      send_email = true
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

    // Generate unique ticket code for this event
    const ticketCode = await generateUniqueTicketCode(eventIdNum);

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

    // Send payment link email if requested
    if (send_email) {
      const emailSent = await sendPaymentLinkEmail(
        {
          email_address,
          name,
          ticket_code: ticketCode,
          number_of_entries,
          price_per_ticket: event.ticket_price,
          payment_processing_fee: processingFee
        },
        {
          title: event.title,
          date_and_time: event.date_and_time,
          venue: event.venue
        },
        paymentLink.attributes.checkout_url,
        {
          brand_name: event.brand?.brand_name
        },
        req.user.brand_id
      );

      if (!emailSent) {
        console.warn('Failed to send payment link email, but ticket was created successfully');
      }
    }

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

    // Validate event_id if provided
    if (event_id && (isNaN(eventIdNum!) || eventIdNum! <= 0)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

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

    // Send payment confirmation email using helper function
    const emailSent = await sendPaymentConfirmationEmail(
      {
        email_address: ticket.email_address,
        name: ticket.name,
        ticket_code: ticket.ticket_code
      },
      {
        title: ticket.event.title
      },
      {
        brand_name: ticket.event.brand?.brand_name
      },
      req.user.brand_id
    );

    if (!emailSent) {
      console.warn('Failed to send payment confirmation email, but ticket was marked as paid');
    }

    res.json({ 
      message: 'Ticket marked as paid successfully',
      ticket
    });
  } catch (error) {
    console.error('Mark ticket paid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const s3 = new AWS.S3();

// Multer configuration for memory storage (for S3 upload)
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export const getEventReferrers = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id } = req.query;
    const eventIdNum = event_id ? parseInt(event_id as string, 10) : undefined;

    if (!event_id || isNaN(eventIdNum!) || eventIdNum! <= 0) {
      return res.status(400).json({ error: 'Valid event ID is required' });
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

    // Get referrers for this event with sales data
    const referrers = await EventReferrer.findAll({
      where: { event_id: eventIdNum },
      order: [['id', 'ASC']]
    });

    // Calculate sales data for each referrer
    const referrersWithSales = await Promise.all(
      referrers.map(async (referrer) => {
        // Get tickets sold through this referrer
        const tickets = await Ticket.findAll({
          where: { 
            event_id: eventIdNum,
            referrer_id: referrer.id,
            status: ['Payment Confirmed', 'Ticket sent.']
          }
        });

        const ticketsSold = tickets.reduce((sum, ticket) => sum + ticket.number_of_entries, 0);
        const grossAmount = tickets.reduce((sum, ticket) => sum + (ticket.price_per_ticket * ticket.number_of_entries), 0);
        const processingFees = tickets.reduce((sum, ticket) => sum + ticket.payment_processing_fee, 0);
        const netAmount = grossAmount - processingFees;

        return {
          id: referrer.id,
          name: referrer.name,
          referral_code: referrer.referral_code,
          tickets_sold: ticketsSold,
          gross_amount_sold: grossAmount,
          net_amount_sold: netAmount,
          referral_shortlink: referrer.referral_shortlink || ''
        };
      })
    );

    res.json({ referrers: referrersWithSales });
  } catch (error) {
    console.error('Get event referrers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEventReferrer = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id, name, referral_code, slug } = req.body;

    if (!event_id || !name || !referral_code || !slug) {
      return res.status(400).json({ 
        error: 'Event ID, name, referral code, and slug are required' 
      });
    }

    const eventIdNum = parseInt(event_id, 10);

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

    // Check for duplicate referral codes
    const existingReferrer = await EventReferrer.findOne({
      where: { referral_code }
    });

    if (existingReferrer) {
      return res.status(400).json({ error: 'A referrer with this referral code already exists' });
    }

    try {
      // Generate referral shortlink
      const frontendUrl = await getBrandFrontendUrl(req.user.brand_id);
      const originalUrl = `${frontendUrl}/public/tickets/buy/${eventIdNum}?ref=${referral_code}`;
      const referralShortlink = await createShortLink(originalUrl, slug);

      // Create the referrer
      const referrer = await EventReferrer.create({
        event_id: eventIdNum,
        name,
        referral_code,
        referral_shortlink: referralShortlink
      });

      res.status(201).json({
        message: 'Event referrer created successfully',
        referrer: {
          id: referrer.id,
          name: referrer.name,
          referral_code: referrer.referral_code,
          tickets_sold: 0,
          gross_amount_sold: 0,
          net_amount_sold: 0,
          referral_shortlink: referrer.referral_shortlink
        }
      });
    } catch (shortlinkError) {
      console.error('Failed to create referral shortlink:', shortlinkError);
      
      // Create referrer without shortlink
      const referrer = await EventReferrer.create({
        event_id: eventIdNum,
        name,
        referral_code,
        referral_shortlink: ''
      });

      res.status(201).json({
        message: 'Event referrer created successfully (shortlink generation failed)',
        referrer: {
          id: referrer.id,
          name: referrer.name,
          referral_code: referrer.referral_code,
          tickets_sold: 0,
          gross_amount_sold: 0,
          net_amount_sold: 0,
          referral_shortlink: referrer.referral_shortlink
        }
      });
    }
  } catch (error) {
    console.error('Create event referrer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEventReferrer = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const referrerId = parseInt(id, 10);

    if (isNaN(referrerId)) {
      return res.status(400).json({ error: 'Invalid referrer ID' });
    }

    const { name, referral_code } = req.body;

    if (!name || !referral_code) {
      return res.status(400).json({ 
        error: 'Name and referral code are required' 
      });
    }

    // Find the referrer and verify access
    const referrer = await EventReferrer.findOne({
      where: { id: referrerId },
      include: [{
        model: Event,
        as: 'event',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // Check for duplicate referral codes (excluding current referrer)
    const existingReferrer = await EventReferrer.findOne({
      where: { 
        referral_code,
        id: { [require('sequelize').Op.ne]: referrerId }
      }
    });

    if (existingReferrer) {
      return res.status(400).json({ error: 'A referrer with this referral code already exists' });
    }

    // Update the referrer
    await referrer.update({
      name,
      referral_code
    });

    res.json({
      message: 'Event referrer updated successfully',
      referrer: {
        id: referrer.id,
        name: referrer.name,
        referral_code: referrer.referral_code,
        referral_shortlink: referrer.referral_shortlink
      }
    });
  } catch (error) {
    console.error('Update event referrer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEventReferrer = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const referrerId = parseInt(id, 10);

    if (isNaN(referrerId)) {
      return res.status(400).json({ error: 'Invalid referrer ID' });
    }

    // Find the referrer and verify access
    const referrer = await EventReferrer.findOne({
      where: { id: referrerId },
      include: [{
        model: Event,
        as: 'event',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // Check if there are any tickets associated with this referrer
    const ticketCount = await Ticket.count({
      where: { referrer_id: referrerId }
    });

    if (ticketCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete referrer as there are tickets associated with it' 
      });
    }

    // Delete the referrer
    await referrer.destroy();

    res.json({
      message: 'Event referrer deleted successfully'
    });
  } catch (error) {
    console.error('Delete event referrer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelTicket = async (req: AuthRequest, res: Response) => {
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

    if (ticket.status === 'Canceled') {
      return res.status(400).json({ error: 'Ticket is already canceled' });
    }

    const originalStatus = ticket.status;

    // Update ticket status to canceled
    await ticket.update({ status: 'Canceled' });

    // Send cancellation email if ticket was already paid/sent
    if (originalStatus === 'Payment Confirmed' || originalStatus === 'Ticket sent.') {
      const emailSent = await sendTicketCancellationEmail(
        {
          email_address: ticket.email_address,
          name: ticket.name,
          ticket_code: ticket.ticket_code
        },
        {
          title: ticket.event.title
        },
        {
          brand_name: ticket.event.brand?.brand_name
        },
        req.user.brand_id
      );
      
      if (!emailSent) {
        console.warn('Failed to send cancellation email, but continuing with cancellation');
      }
    }

    res.json({ 
      message: 'Ticket canceled successfully',
      ticket: {
        id: ticket.id,
        status: 'Canceled'
      }
    });
  } catch (error) {
    console.error('Cancel ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resendTicket = async (req: AuthRequest, res: Response) => {
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

    if (ticket.status === 'New' || ticket.status === 'Canceled') {
      return res.status(400).json({ 
        error: 'Cannot resend ticket - ticket must be paid or already sent' 
      });
    }

    // Send ticket email using helper function
    const emailSent = await sendTicketEmail(
      {
        email_address: ticket.email_address,
        name: ticket.name,
        ticket_code: ticket.ticket_code,
        number_of_entries: ticket.number_of_entries
      },
      {
        title: ticket.event.title,
        date_and_time: ticket.event.date_and_time,
        venue: ticket.event.venue,
        rsvp_link: ticket.event.rsvp_link
      },
      {
        brand_name: ticket.event.brand?.brand_name
      },
      req.user.brand_id
    );

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send ticket email' });
    }

    // Update status to "Ticket sent." if it wasn't already
    if (ticket.status !== 'Ticket sent.') {
      await ticket.update({ status: 'Ticket sent.' });
    }

    res.json({ 
      message: 'Ticket resent successfully',
      ticket: {
        id: ticket.id,
        status: 'Ticket sent.'
      }
    });
  } catch (error) {
    console.error('Resend ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};