import { Request, Response } from 'express';
import { Ticket, Event, EventReferrer, Brand, User, Domain, Artist, Release, ArtistImage, TicketType, Song } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendBrandedEmail } from '../utils/emailService';
import { generateUniqueTicketCode, sendTicketEmail } from '../utils/ticketEmailService';
import { getBrandFrontendUrl, getBrandIdFromDomain } from '../utils/brandUtils';
import { getEventDisplayPriceSync } from '../utils/eventPriceUtils';
import { Op } from 'sequelize';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const paymentService = new PaymentService();

// Helper function to extract domain from request
const getRequestDomain = (req: Request): string => {
  let requestDomain = '';

  // Try Origin header first (for CORS/XHR requests - contains the frontend domain)
  const originHeader = req.get('origin') || '';
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      requestDomain = url.hostname;
    } catch (error) {
      console.error('Invalid origin header:', originHeader);
    }
  }

  // Fallback to Referer header (for navigation/redirect - also contains frontend domain)
  if (!requestDomain) {
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    if (refererUrl) {
      try {
        const url = new URL(refererUrl);
        requestDomain = url.hostname;
      } catch (error) {
        console.error('Invalid referer URL:', refererUrl);
      }
    }
  }

  return requestDomain;
};

// Helper function to determine if countdown should be shown for an event
const shouldShowCountdown = (event: any): boolean => {
  const now = new Date();
  
  // Use close_time if available, otherwise fall back to event date
  const closeTime = event.close_time ? new Date(event.close_time) : new Date(event.date_and_time);
  const timeDiff = closeTime.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  // Don't show countdown if ticket sales have already closed
  if (timeDiff <= 0) {
    return false;
  }

  switch (event.countdown_display) {
    case 'always':
      return true;
    case '1_week':
      return daysDiff <= 7;
    case '3_days':
      return daysDiff <= 3;
    case '1_day':
      return daysDiff <= 1;
    case 'never':
    default:
      return false;
  }
};

// Helper function to set ticket access cookie
const setTicketAccessCookie = (res: Response, ticketId: number, eventId: number): void => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured, skipping cookie');
    return;
  }

  const token = jwt.sign(
    { ticketId, eventId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Cookie expires in 1 hour
  );

  res.cookie('ticket_access_token', token, {
    httpOnly: true,  // Prevents JavaScript access (XSS protection)
    secure: true, // Required for sameSite=none (browser enforced, regardless of actual protocol)
    sameSite: 'none', // Allow cross-origin cookies (frontend and backend on different ports)
    maxAge: 3600000  // 1 hour in milliseconds
  });
};

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
    const requestDomain = getRequestDomain(req);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await Event.findOne({
      where: {
        id: eventId,
        status: 'published'
      },
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
        },
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price']
        }
      ]
    });


    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate that the event belongs to the brand associated with the current domain
    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);

      if (!isDomainValid) {
        return res.status(403).json({ error: 'Invalid domain' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(403).json({ error: 'Can\'t validate domain : ' + requestDomain });
    }

    // Check if event is closed due to time
    const isClosedByTime = event.close_time && new Date() > event.close_time;

    // Check if event is closed due to no available ticket types
    const ticketTypes = await TicketType.findAll({
      where: { event_id: eventId }
    });

    let hasAvailableTicketTypes = false;
    for (const ticketType of ticketTypes) {
      const isAvailable = ticketType.isAvailable();
      const isSoldOut = await ticketType.isSoldOut();

      if (isAvailable && !isSoldOut) {
        hasAvailableTicketTypes = true;
        break;
      }
    }

    // Event is closed if time has passed OR no ticket types are available
    const isEventClosed = isClosedByTime || !hasAvailableTicketTypes;

    // Calculate remaining tickets if max_tickets is set
    let remainingTickets = null;
    if (event.max_tickets && event.max_tickets > 0) {
      const totalSold = await getTotalTicketsSold(eventId);
      remainingTickets = event.max_tickets - totalSold;
    }

    // Get display price from ticket types
    const priceDisplay = getEventDisplayPriceSync(event);

    res.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        date_and_time: event.date_and_time,
        close_time: event.close_time,
        venue: event.venue,
        poster_url: event.poster_url,
        ticket_price: priceDisplay.amount,
        ticket_price_display: priceDisplay.displayText,
        ticket_naming: event.ticket_naming || 'Regular',
        max_tickets: event.max_tickets,
        remaining_tickets: remainingTickets,
        is_closed: isEventClosed,
        show_countdown: shouldShowCountdown(event),
        show_tickets_remaining: (event as any).show_tickets_remaining !== undefined ? (event as any).show_tickets_remaining : true,
        supports_card: event.supports_card,
        supports_gcash: event.supports_gcash,
        supports_qrph: event.supports_qrph,
        supports_ubp: event.supports_ubp,
        supports_dob: event.supports_dob,
        supports_maya: event.supports_maya,
        supports_grabpay: event.supports_grabpay,
        buy_shortlink: event.buy_shortlink,
        google_place_id: event.google_place_id,
        venue_address: event.venue_address,
        venue_latitude: event.venue_latitude,
        venue_longitude: event.venue_longitude,
        venue_phone: event.venue_phone,
        venue_website: event.venue_website,
        venue_maps_url: event.venue_maps_url,
        brand: event.brand ? {
          id: event.brand.id,
          name: event.brand.brand_name,
          color: event.brand.brand_color,
          logo_url: event.brand.logo_url
        } : null,
        ticketTypes: (event as any).ticketTypes || []
      }
    });
  } catch (error) {
    console.error('Get event for public error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get available ticket types for public purchase (respects availability rules)
export const getAvailableTicketTypesPublic = async (req: Request, res: Response) => {
  try {
    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id as string, 10);

    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Get all ticket types for the event
    const ticketTypes = await TicketType.findAll({
      where: { event_id: eventIdNum },
      include: [{
        model: Ticket,
        as: 'tickets',
        required: false,
        attributes: ['id']
      }],
      order: [['id', 'ASC']]
    });

    const availableTicketTypes = [];

    for (const ticketType of ticketTypes) {
      const isAvailable = ticketType.isAvailable();
      const isSoldOut = await ticketType.isSoldOut();
      const remainingTickets = await ticketType.getRemainingTickets();

      // For public buy page, include all tickets but mark availability status
      // Hide only those outside date range, but show sold out ones as grayed out
      if (!isAvailable) {
        continue; // Only hide if outside date range
      }

      // Get the actual sold count using the same logic as isSoldOut()
      const soldCount = await ticketType.getSoldCount();

      availableTicketTypes.push({
        ...ticketType.toJSON(),
        is_available: isAvailable,
        is_sold_out: isSoldOut,
        remaining_tickets: remainingTickets,
        sold_count: soldCount
      });
    }
    res.json({ ticketTypes: availableTicketTypes });
  } catch (error) {
    console.error('Get available ticket types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unified endpoint to get ticket details - supports both cookie and code-based authentication
export const getTicketDetails = async (req: Request, res: Response) => {
  try {
    // Check if authenticating via cookie or via code/pin parameters
    const token = req.cookies?.ticket_access_token;
    const { ticket_code, event_id, verification_pin } = req.body;

    // Try cookie authentication first (but fall through to code auth if JWT is invalid)
    if (token && process.env.JWT_SECRET) {
      // Verify and decode the JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { ticketId, eventId } = decoded;

        // Validate JWT payload data
        if (!ticketId || !eventId ||
            typeof ticketId !== 'number' || typeof eventId !== 'number' ||
            !Number.isInteger(ticketId) || !Number.isInteger(eventId) ||
            ticketId <= 0 || eventId <= 0) {
          console.warn('Invalid JWT payload: ticketId or eventId is not a valid positive integer');
          // Fall through to code-based auth
          throw new Error('Invalid token payload');
        }

        // Load ticket with related data
        const ticket = await Ticket.findOne({
          where: { id: ticketId, event_id: eventId },
          include: [
            {
              model: Event,
              as: 'event',
              include: [
                {
                  model: Brand,
                  as: 'brand'
                }
              ]
            },
            {
              model: TicketType,
              as: 'ticketType'
            }
          ]
        });

        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }

        // Return ticket details for cookie-authenticated request
        return res.json({
          success: true,
          ticket: {
            id: ticket.id,
            ticket_code: ticket.ticket_code,
            name: ticket.name,
            email_address: ticket.email_address,
            contact_number: ticket.contact_number,
            number_of_entries: ticket.number_of_entries,
            status: ticket.status,
            price_per_ticket: ticket.price_per_ticket,
            total_price: ticket.price_per_ticket * ticket.number_of_entries,
            order_timestamp: ticket.order_timestamp,
            date_paid: ticket.date_paid,
            event: ticket.event ? {
              id: ticket.event.id,
              title: ticket.event.title,
              date_and_time: ticket.event.date_and_time,
              venue: ticket.event.venue,
              venue_address: ticket.event.venue_address,
              venue_maps_url: ticket.event.venue_maps_url,
              poster_url: ticket.event.poster_url,
              brand: ticket.event.brand ? {
                id: ticket.event.brand.id,
                name: ticket.event.brand.brand_name,
                color: ticket.event.brand.brand_color,
                logo_url: ticket.event.brand.logo_url
              } : undefined
            } : undefined,
            ticketType: ticket.ticketType ? {
              id: ticket.ticketType.id,
              name: ticket.ticketType.name,
              price: ticket.ticketType.price
            } : undefined
          }
        });
      } catch (jwtError) {
        // JWT verification failed - fall through to code-based auth if available
        // Don't return early to allow fallback authentication
      }
    }

    // Fall back to code-based authentication
    if (!event_id || !ticket_code || !verification_pin) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Extract domain from request for multibrand validation
    const requestDomain = getRequestDomain(req);

    const ticket = await Ticket.findOne({
      where: {
        event_id,
        ticket_code: ticket_code.toUpperCase()
      },
      include: [
        {
          model: Event,
          as: 'event',
          include: [{
            model: Brand,
            as: 'brand',
            include: [{
              model: Domain,
              as: 'domains',
              attributes: ['domain_name']
            }]
          }]
        },
        {
          model: TicketType,
          as: 'ticketType',
          attributes: ['id', 'name', 'price']
        },
        { model: EventReferrer, as: 'referrer' }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate that the event belongs to the brand associated with the current domain
    if (ticket.event.brand && ticket.event.brand.domains && requestDomain) {
      const eventBrandDomains = ticket.event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);

      if (!isDomainValid) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify PIN matches the event's verification PIN
    if (verification_pin !== ticket.event.verification_pin) {
      return res.status(403).json({ error: 'Invalid verification PIN' });
    }

    // Only show tickets that are confirmed (matching PHP logic)
    if (ticket.status !== 'Ticket sent.') {
      return res.status(404).json({ error: 'Ticket not found or not confirmed' });
    }

    // Calculate remaining entries
    const remainingEntries = ticket.number_of_entries - ticket.number_of_claimed_entries;

    // Return ticket details for code-authenticated request
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
          price: (ticket as any).ticketType.price
        } : null
      }
    });
  } catch (error) {
    console.error('Get ticket details error:', error);
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
      ticket_type_id,
      referral_code
    } = req.body;

    if (!event_id || !name || !email_address || !contact_number) {
      return res.status(400).json({ 
        error: 'Event ID, name, email, and contact number are required' 
      });
    }

    const eventIdNum = parseInt(event_id, 10);
    const requestDomain = getRequestDomain(req);

    // Get event details
    const event = await Event.findOne({
      where: { id: eventIdNum },
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
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate that the event belongs to the brand associated with the current domain
    if (event.brand && event.brand.domains && requestDomain) {
      const eventBrandDomains = event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);
      
      if (!isDomainValid) {
        return res.status(404).json({ error: 'Invalid domain' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(404).json({ error: 'Invalid domain' });
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

    // Determine ticket price based on selected ticket type
    let ticketPrice = event.ticket_price; // Default to legacy price
    let selectedTicketType = null;
    
    if (ticket_type_id && (event as any).ticketTypes) {
      selectedTicketType = (event as any).ticketTypes.find((tt: any) => tt.id === parseInt(ticket_type_id));
      if (selectedTicketType) {
        ticketPrice = selectedTicketType.price;
      }
    }

    // Generate unique ticket code
    const ticketCode = await generateUniqueTicketCode(eventIdNum);

    // Calculate total amount
    const totalAmount = ticketPrice * number_of_entries;
    const ticketTypeName = selectedTicketType?.name || event.ticket_naming || 'Regular';
    const description = `${event.title} - ${number_of_entries} ${ticketTypeName} ${number_of_entries === 1 ? 'ticket' : 'tickets'}`;

    // Get brand's domain for success URL
    const brandDomain = await getBrandFrontendUrl(event.brand_id);

    // Handle FREE tickets (skip payment workflow)
    if (totalAmount === 0) {
      // Create ticket record with "Ticket sent." status
      const ticket = await Ticket.create({
        event_id: eventIdNum,
        name,
        email_address,
        contact_number,
        number_of_entries,
        ticket_code: ticketCode,
        status: 'Ticket sent.',
        price_per_ticket: 0,
        ticket_type_id: selectedTicketType?.id || null,
        referrer_id: referrer?.id || null,
        order_timestamp: new Date(),
        date_paid: new Date()
      });

      // Send ticket email immediately
      try {
        await sendTicketEmail(
          {
            email_address: ticket.email_address,
            name: ticket.name,
            ticket_code: ticket.ticket_code,
            number_of_entries: ticket.number_of_entries,
            ticket_type: selectedTicketType ? {
              id: selectedTicketType.id,
              name: selectedTicketType.name
            } : undefined
          },
          {
            id: event.id,
            title: event.title,
            date_and_time: event.date_and_time,
            venue: event.venue,
            rsvp_link: event.rsvp_link,
            venue_address: event.venue_address,
            venue_latitude: event.venue_latitude,
            venue_longitude: event.venue_longitude,
            venue_maps_url: event.venue_maps_url
          },
          {
            brand_name: event.brand?.brand_name
          },
          event.brand_id
        );
      } catch (emailError) {
        console.error('Failed to send free ticket email:', emailError);
        // Continue even if email fails - ticket is still registered
      }

      // Set secure cookie for success page access
      setTicketAccessCookie(res, ticket.id, eventIdNum);

      // Return success response with direct URL to success page
      return res.json({
        success: true,
        ticket_id: ticket.id,
        ticket_code: ticketCode,
        total_amount: 0,
        url: `${brandDomain}/public/tickets/success`,
        message: 'Free ticket registered successfully!'
      });
    }

    // Handle PAID tickets (PayMongo checkout flow)
    // Prepare payment methods based on event settings
    const paymentMethods: string[] = [];
    if (event.supports_card) paymentMethods.push('card');
    if (event.supports_gcash) paymentMethods.push('gcash');
    if (event.supports_ubp) paymentMethods.push('dob_ubp');
    if (event.supports_dob) paymentMethods.push('dob');
    if (event.supports_qrph) paymentMethods.push('qrph');
    if (event.supports_maya) paymentMethods.push('paymaya');
    if (event.supports_grabpay) paymentMethods.push('grab_pay');

    // Create checkout session with billing information (matching PHP implementation)
    const checkoutSession = await paymentService.createCheckoutSession({
      line_items: [{
        name: 'Tickets',
        amount: ticketPrice * 100, // Convert to cents
        currency: 'PHP',
        quantity: number_of_entries
      }],
      payment_method_types: paymentMethods,
      success_url: `${brandDomain}/public/tickets/success`,
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
      price_per_ticket: ticketPrice,
      ticket_type_id: selectedTicketType?.id || null,
      referrer_id: referrer?.id || null,
      order_timestamp: new Date()
    });

    // Store checkout session info in ticket
    await ticket.update({
      payment_link: checkoutSession.attributes.checkout_url,
      checkout_key: checkoutSession.attributes.client_key,
      payment_link_id: null
    });

    // Set secure cookie for success page access (will persist through PayMongo redirect)
    setTicketAccessCookie(res, ticket.id, eventIdNum);

    res.json({
      success: true,
      ticket_id: ticket.id,
      ticket_code: ticketCode,
      total_amount: totalAmount,
      url: checkoutSession.attributes.checkout_url,
      message: 'Ticket created successfully. Redirecting to payment...'
    });
  } catch (error) {
    console.error('Buy ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadTicketPDF = async (req: Request, res: Response) => {
  let doc: any = null; // Declare doc outside try block for cleanup in catch

  try {
    const token = req.cookies.ticket_access_token;

    if (!token) {
      return res.status(401).json({ error: 'No ticket access token found' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify and decode the JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired ticket access token' });
    }

    const { ticketId, eventId } = decoded;

    // Validate JWT payload data
    if (!ticketId || !eventId ||
        typeof ticketId !== 'number' || typeof eventId !== 'number' ||
        !Number.isInteger(ticketId) || !Number.isInteger(eventId) ||
        ticketId <= 0 || eventId <= 0) {
      console.warn('Invalid JWT payload in PDF download: ticketId or eventId is not a valid positive integer');
      return res.status(400).json({ error: 'Invalid ticket access token payload' });
    }

    // Load ticket with related data
    const ticket = await Ticket.findOne({
      where: { id: ticketId, event_id: eventId },
      include: [
        {
          model: Event,
          as: 'event',
          include: [
            {
              model: Brand,
              as: 'brand'
            }
          ]
        },
        {
          model: TicketType,
          as: 'ticketType'
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate ticket status - only allow PDF download for confirmed/paid tickets
    const validStatuses = ['Payment Confirmed', 'Ticket sent.'];
    if (!validStatuses.includes(ticket.status)) {
      return res.status(403).json({
        error: 'PDF download is only available for confirmed tickets'
      });
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(ticket.ticket_code, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 200,
      margin: 1
    });

    // Validate QR code data URL format BEFORE creating PDF
    const qrDataParts = qrCodeDataUrl.split(',');
    if (qrDataParts.length < 2) {
      console.error('Invalid QR code data URL format:', qrCodeDataUrl);
      return res.status(500).json({ error: 'Failed to generate ticket QR code' });
    }

    // Create PDF document
    doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Buffer the PDF in memory to ensure atomic success/failure
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      // PDF generation completed successfully - now send it
      const pdfBuffer = Buffer.concat(chunks);

      // Set response headers for PDF download (sanitize ticket code for filename safety)
      const ticketCode = ticket.ticket_code || 'download';
      const sanitizedCode = ticketCode.replace(/[^A-Z0-9]/gi, '');
      const filename = `ticket-${sanitizedCode}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
    });
    doc.on('error', (err: Error) => {
      // PDF generation failed - send error response (headers not sent yet)
      console.error('PDF generation error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate PDF' });
      }
    });

    // Get brand info
    const brandName = ticket.event?.brand?.brand_name || 'Melt Records';

    const pageWidth = doc.page.width;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Header: Brand Tickets
    doc.fontSize(10).fillColor('#060606').text(`${brandName} Tickets`, { align: 'center' });
    doc.moveDown(0.3);

    // Main heading: "You're In!"
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000').text("You're In!", { align: 'center' });
    doc.moveDown(0.5);

    // Thank you message
    doc.fontSize(11).font('Helvetica').fillColor('#333333').text('Thank you for your purchase!', { align: 'center' });
    const eventText = `This is your official ticket to ${ticket.event?.title || 'the event'}!`;
    doc.text(eventText, { align: 'center' });
    doc.moveDown(0.5);

    // Divider line
    doc.strokeColor('#D9D9D9').lineWidth(1.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Ticket holder
    doc.fontSize(10).fillColor('#333333').text(`This ticket is issued to ${ticket.name}.`, { align: 'center' });
    doc.moveDown(0.5);

    // Ticket type
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333').text(ticket.ticketType?.name || 'Regular', { align: 'center' });
    doc.moveDown(0.5);

    // QR Code (centered, smaller)
    // Extract base64 data from validated data URL
    const qrImageBuffer = Buffer.from(qrDataParts[1], 'base64');
    const qrSize = 140;
    const qrX = (pageWidth - qrSize) / 2;
    doc.image(qrImageBuffer, qrX, doc.y, { width: qrSize });
    doc.moveDown(9);

    // Ticket code (large, bold, centered)
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#333333').text(ticket.ticket_code, { align: 'center' });
    doc.moveDown(0.5);

    // Admit X person(s)
    doc.fontSize(11).font('Helvetica').fillColor('#333333').text(
      `Admit ${ticket.number_of_entries} person(s).`,
      { align: 'center' }
    );
    doc.moveDown(0.5);

    // Divider line
    doc.strokeColor('#D9D9D9').lineWidth(1.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Event Details box (light gray background)
    const boxY = doc.y;
    const boxPadding = 15;
    const lineHeight = 16;
    const boxHeight = ticket.event?.venue_address ? 100 : 85;
    doc.rect(margin, boxY, contentWidth, boxHeight).fillAndStroke('#f8f9fa', '#f8f9fa');

    // Event Details heading
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Event Details', margin + boxPadding, boxY + boxPadding);

    if (ticket.event) {
      const eventDate = new Date(ticket.event.date_and_time);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila'
      });
      const formattedTime = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });

      let detailY = boxY + boxPadding + 25;
      doc.fontSize(9).font('Helvetica').fillColor('#333333');

      doc.font('Helvetica-Bold').text('Date: ', margin + boxPadding, detailY, { continued: true });
      doc.font('Helvetica').text(formattedDate);

      detailY += lineHeight;
      doc.font('Helvetica-Bold').text('Time: ', margin + boxPadding, detailY, { continued: true });
      doc.font('Helvetica').text(formattedTime);

      detailY += lineHeight;
      doc.font('Helvetica-Bold').text('Venue: ', margin + boxPadding, detailY, { continued: true });
      doc.font('Helvetica').text(ticket.event.venue);

      if (ticket.event.venue_address) {
        detailY += lineHeight;
        doc.font('Helvetica-Bold').text('Address: ', margin + boxPadding, detailY, { continued: true });
        doc.font('Helvetica').text(ticket.event.venue_address, { width: contentWidth - boxPadding * 3 });
      }
    }

    doc.y = boxY + boxHeight + 15;

    // Divider line
    doc.strokeColor('#D9D9D9').lineWidth(1.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Important reminders
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text('Important reminders:', margin, doc.y);
    doc.moveDown(0.3);

    doc.fontSize(8).font('Helvetica').fillColor('#333333');
    const reminders = [
      'Please show this ticket at the gate to gain admission to the event.',
      'Tickets are non-refundable.',
      'If you need to change the name for this ticket, please contact us for support.',
      'Do not share this ticket code to anyone else, to avoid unauthorized use.'
    ];

    reminders.forEach(reminder => {
      doc.text(`• ${reminder}`, margin + 5, doc.y);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.3);

    // Divider line
    doc.strokeColor('#D9D9D9').lineWidth(1.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // Footer
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666').text(
      'Powered by Melt Records Tickets.',
      { align: 'center' }
    );

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error('Download ticket PDF error:', error);

    // Clean up PDF document stream if it was created
    if (doc) {
      try {
        doc.destroy();
      } catch (destroyError) {
        console.error('Error destroying PDF document:', destroyError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
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

    // Extract domain from request for multibrand validation
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

    // Use the actual verification PIN from the event
    if (pin !== event.verification_pin) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    res.json({ 
      valid: true, 
      message: 'PIN verified successfully',
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
    console.error('Check PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check in ticket entries (equivalent to PHP action.verify.php)
export const checkInTicket = async (req: Request, res: Response) => {
  try {
    const { event_id, verification_pin, ticket_code, entries_to_claim } = req.body;

    if (!event_id || !ticket_code || !verification_pin || !entries_to_claim) {
      return res.status(400).json({ error: 'Event ID, ticket code, verification PIN, and entries to claim are required' });
    }

    // Parse entries_to_claim as integer to prevent string concatenation
    const entriesToClaimNum = parseInt(entries_to_claim, 10);
    
    if (isNaN(entriesToClaimNum) || entriesToClaimNum < 1) {
      return res.status(400).json({ error: 'Entries to claim must be a valid number greater than 0' });
    }

    // Extract domain from request for multibrand validation
    const requestDomain = getRequestDomain(req);

    const ticket = await Ticket.findOne({
      where: { 
        event_id,
        ticket_code: ticket_code.toUpperCase()
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          include: [{
            model: Brand,
            as: 'brand',
            include: [{
              model: Domain,
              as: 'domains',
              attributes: ['domain_name']
            }]
          }]
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate that the event belongs to the brand associated with the current domain
    if (ticket.event.brand && ticket.event.brand.domains && requestDomain) {
      const eventBrandDomains = ticket.event.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = eventBrandDomains.includes(requestDomain);
      
      if (!isDomainValid) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify PIN matches the event's verification PIN
    if (verification_pin !== ticket.event.verification_pin) {
      return res.status(403).json({ error: 'Invalid verification PIN' });
    }

    // Only allow check-in for confirmed tickets (matching PHP logic)
    if (ticket.status !== 'Ticket sent.') {
      return res.status(400).json({ error: 'Ticket is not confirmed and cannot be checked in' });
    }

    // Calculate remaining entries - model now handles type conversion automatically
    const remainingEntries = ticket.number_of_entries - ticket.number_of_claimed_entries;

    if (entriesToClaimNum > remainingEntries) {
      return res.status(400).json({ 
        error: `Cannot claim ${entriesToClaimNum} entries. Only ${remainingEntries} entries remaining.` 
      });
    }

    // Update claimed entries (matching PHP logic) - model ensures numeric addition
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
    console.error('Check in ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get public event information by ID (without PIN requirement)
export const getPublicEventInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    // Extract domain from request for multibrand validation
    const requestDomain = getRequestDomain(req);

    const event = await Event.findOne({
      where: { 
        id,
        status: 'published'
      },
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

    res.json({
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
    console.error('Get public event info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate SEO page on-demand for social media crawlers
export const generateEventSEOPage = async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    
    if (isNaN(eventId)) {
      return res.status(404).send('Event not found');
    }

    // Get event details with brand information (no domain validation for SEO pages)
    const event = await Event.findOne({
      where: {
        id: eventId,
        status: 'published'
      },
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
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    if (!event) {
      return res.status(404).send('Event not found');
    }

    // Use the brand's primary domain for the frontend URL
    const brandDomain = event.brand?.domains?.[0]?.domain_name;
    if (!brandDomain) {
      return res.status(404).send('Event not found');
    }
    const frontendUrl = `https://${brandDomain}/public/tickets/buy/${event.id}`;

    // Check if this is a social media crawler
    const userAgent = req.get('User-Agent') || '';
    const isSocialCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|linktreebot|linktree/i.test(userAgent);

    // For social media crawlers, serve SEO page with meta tags
    // For regular users and browsers, redirect immediately with HTTP 302
    if (!isSocialCrawler) {
      return res.redirect(302, frontendUrl);
    }

    // Generate meta tags for social sharing
    const title = `Buy tickets to ${event.title}`;
    const description = event.description || `Get your tickets for ${event.title} at ${event.venue || 'this amazing event'}.`;
    const image = event.poster_url || '';
    const siteName = event.brand?.brand_name || 'Melt Records';

    // Get display price from ticket types
    const priceDisplay = getEventDisplayPriceSync(event);

    // Generate structured data
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "description": description,
      "startDate": event.date_and_time,
      "location": {
        "@type": "Place",
        "name": event.venue
      },
      "image": event.poster_url,
      "offers": {
        "@type": "Offer",
        "price": priceDisplay.amount,
        "priceCurrency": "PHP",
        "availability": "https://schema.org/InStock",
        "url": frontendUrl
      },
      "organizer": {
        "@type": "Organization",
        "name": siteName
      }
    };

    // Generate SEO-optimized HTML for social media crawlers only
    const seoHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title.replace(/"/g, '&quot;')}</title>
  <base href="/">
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
  
  <!-- SEO Meta Tags for ${event.title.replace(/"/g, '&quot;')} -->
  <meta name="description" content="${description.replace(/"/g, '&quot;')}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="${frontendUrl}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  ${image ? `<meta property="og:image:width" content="1200">` : ''}
  ${image ? `<meta property="og:image:height" content="630">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${frontendUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
${JSON.stringify(structuredData, null, 4)}
  </script>
  
  <!-- Styles for crawler display -->
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { 
      max-width: 500px; 
      background: white; 
      border-radius: 12px; 
      box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
      overflow: hidden;
    }
    .poster { 
      width: 100%; 
      height: 300px; 
      object-fit: cover; 
    }
    .content { 
      padding: 30px; 
    }
    .title { 
      color: #1a1a1a; 
      margin: 0 0 15px 0; 
      font-size: 24px; 
      font-weight: 700; 
      line-height: 1.3;
    }
    .details { 
      color: #666; 
      line-height: 1.6; 
      font-size: 16px; 
      margin-bottom: 20px;
    }
    .detail-item {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    .detail-icon {
      margin-right: 8px;
      font-size: 18px;
    }
    .price { 
      font-size: 20px; 
      font-weight: 700; 
      color: #10b981; 
      margin: 15px 0; 
    }
    .cta-button { 
      display: inline-block; 
      background: linear-gradient(45deg, #667eea, #764ba2); 
      color: white; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 16px;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    ${image ? `<img src="${image}" alt="${event.title.replace(/"/g, '&quot;')}" class="poster">` : ''}
    <div class="content">
      <h1 class="title">${event.title}</h1>
      <div class="details">
        <div class="detail-item">
          <span class="detail-icon">📅</span>
          <span><strong>Date:</strong> ${new Date(event.date_and_time).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })}</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">📍</span>
          <span><strong>Venue:</strong> ${event.venue}</span>
        </div>
        ${event.description ? `
        <div class="detail-item" style="align-items: flex-start; margin-top: 15px;">
          <span class="detail-icon">📝</span>
          <div><strong>About:</strong><br>${event.description}</div>
        </div>` : ''}
      </div>
      <div class="price">🎫 ${priceDisplay.displayText}</div>
      <a href="${frontendUrl}" class="cta-button">🎟️ Get Your Tickets Now</a>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(seoHTML);

  } catch (error) {
    console.error('Generate SEO page error:', error);
    res.status(500).send('Internal server error');
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

// Get all events for a domain (brand and its sublabels)
export const getAllEventsForDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    // Find the brand by domain
    const domainRecord = await Domain.findOne({
      where: { domain_name: domain },
      include: [
        {
          model: Brand,
          as: 'brand',
          required: true
        }
      ]
    });

    if (!domainRecord || !domainRecord.brand) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const mainBrand = domainRecord.brand;

    // Get all child brands (sublabels)
    const childBrands = await Brand.findAll({
      where: { parent_brand: mainBrand.id }
    });

    // Combine main brand and child brands
    const allBrands = [mainBrand, ...childBrands];
    const brandIds = allBrands.map(brand => brand.id);

    // Get all events for these brands
    const events = await Event.findAll({
      where: {
        brand_id: { [Op.in]: brandIds },
        date_and_time: { [Op.gte]: new Date() }, // Only future events
        status: 'published' // Only published events
      },
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name', 'brand_color', 'logo_url']
        },
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price']
        }
      ],
      order: [['date_and_time', 'ASC']]
    });

    // Group events by brand
    const brandEvents = allBrands.map(brand => {
      const brandEventsFiltered = events
        .filter(event => event.brand_id === brand.id)
        .map(event => {
          const priceDisplay = getEventDisplayPriceSync(event);
          return {
            id: event.id,
            title: event.title,
            date_and_time: event.date_and_time,
            venue: event.venue,
            poster_url: event.poster_url,
            ticket_price: priceDisplay.amount,
            ticket_price_display: priceDisplay.displayText,
            ticket_naming: event.ticket_naming,
            buy_shortlink: event.buy_shortlink,
            is_closed: new Date() > new Date(event.close_time || event.date_and_time)
          };
        });

      return {
        id: brand.id,
        name: brand.brand_name,
        color: brand.brand_color,
        logo_url: brand.logo_url,
        events: brandEventsFiltered
      };
    }).filter(brand => brand.events.length > 0); // Only include brands with events

    res.json({
      brands: brandEvents
    });

  } catch (error) {
    console.error('Get all events for domain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate SEO page for public events listing
export const generateEventsListSEOPage = async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    
    // Find the brand by domain
    const domainRecord = await Domain.findOne({
      where: { domain_name: domain },
      include: [
        {
          model: Brand,
          as: 'brand',
          required: true
        }
      ]
    });

    if (!domainRecord || !domainRecord.brand) {
      return res.status(404).send('Domain not found');
    }

    const mainBrand = domainRecord.brand;

    // Get all child brands (sublabels)
    const childBrands = await Brand.findAll({
      where: { parent_brand: mainBrand.id }
    });

    // Combine main brand and child brands
    const allBrands = [mainBrand, ...childBrands];
    const brandIds = allBrands.map(brand => brand.id);

    // Get latest events for SEO
    const events = await Event.findAll({
      where: {
        brand_id: { [Op.in]: brandIds },
        date_and_time: { [Op.gte]: new Date() }, // Only future events
        status: 'published' // Only published events
      },
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name', 'brand_color', 'logo_url']
        },
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price']
        }
      ],
      order: [['date_and_time', 'ASC']],
      limit: 10 // Limit for SEO purposes
    });

    // Find the latest event with a poster for og:image
    let latestEventPoster = '';
    for (const event of events) {
      const isTimeClosed = new Date() > new Date(event.close_time || event.date_and_time);
      
      // Check if sold out (if max_tickets is set)
      let isSoldOut = false;
      if (event.max_tickets && event.max_tickets > 0) {
        const ticketsSold = await getTotalTicketsSold(event.id);
        isSoldOut = ticketsSold >= event.max_tickets;
      }
      
      const isClosed = isTimeClosed || isSoldOut;
      
      if (event.poster_url && !isClosed) {
        latestEventPoster = event.poster_url;
        break;
      }
    }

    // Generate meta tags for social sharing
    const title = `Live Music Directory by ${mainBrand.brand_name}`;
    const description = `Check out upcoming events from ${mainBrand.brand_name} and affiliated labels. Get your tickets now!`;
    const siteName = mainBrand.brand_name;
    const frontendUrl = `https://${domain}/public/events`;

    // Generate structured data for events listing
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": title,
      "description": description,
      "numberOfItems": events.length,
      "itemListElement": events.slice(0, 5).map((event, index) => {
        const priceDisplay = getEventDisplayPriceSync(event);
        return {
          "@type": "Event",
          "position": index + 1,
          "name": event.title,
          "startDate": event.date_and_time,
          "location": {
            "@type": "Place",
            "name": event.venue
          },
          "image": event.poster_url,
          "offers": {
            "@type": "Offer",
            "price": priceDisplay.amount,
            "priceCurrency": "PHP",
            "availability": "https://schema.org/InStock",
            "url": `https://${domain}/public/tickets/buy/${event.id}`
          },
          "organizer": {
            "@type": "Organization",
            "name": event.brand?.brand_name || siteName
          }
        };
      })
    };

    // Generate SEO-optimized HTML
    const seoHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title.replace(/"/g, '&quot;')}</title>
  <base href="/">
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
  
  <!-- SEO Meta Tags for ${mainBrand.brand_name} Events -->
  <meta name="description" content="${description.replace(/"/g, '&quot;')}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="${frontendUrl}">
  ${latestEventPoster ? `<meta property="og:image" content="${latestEventPoster}">` : ''}
  ${latestEventPoster ? `<meta property="og:image:width" content="1200">` : ''}
  ${latestEventPoster ? `<meta property="og:image:height" content="630">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
  ${latestEventPoster ? `<meta name="twitter:image" content="${latestEventPoster}">` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${frontendUrl}">
  
  <!-- Meta refresh backup for non-crawler users -->
  <meta http-equiv="refresh" content="0; url=${frontendUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
${JSON.stringify(structuredData, null, 4)}
  </script>
  
  <!-- Auto-redirect for regular users (non-crawlers) -->
  <script>
    (function() {
      const userAgent = navigator.userAgent.toLowerCase();
      const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|linktreebot|linktree/i.test(userAgent);
      
      if (!isCrawler) {
        window.location.replace('${frontendUrl}');
      }
    })();
  </script>
  
  <!-- Styles for crawler display -->
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(to bottom, #6c757d 0%, #ffffff 100%);
      min-height: 100vh;
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto;
      background: white; 
      border-radius: 12px; 
      box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
      overflow: hidden;
      padding: 2rem;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      color: #495057;
    }
    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
    }
    .event-card {
      border: 1px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
      background: #f8f9fa;
    }
    .event-poster {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .event-details {
      padding: 1rem;
    }
    .event-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #2c3e50;
    }
    .event-info {
      font-size: 0.9rem;
      color: #6c757d;
      margin-bottom: 0.25rem;
    }
    .event-price {
      font-weight: 600;
      color: #28a745;
    }
    .cta {
      text-align: center;
      margin-top: 2rem;
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .cta a {
      display: inline-block;
      padding: 1rem 2rem;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${description}</p>
    </div>
    
    <div class="events-grid">
      ${events.slice(0, 6).map(event => {
        const priceDisplay = getEventDisplayPriceSync(event);
        return `
        <div class="event-card">
          ${event.poster_url ? `<img src="${event.poster_url}" alt="${event.title}" class="event-poster">` : ''}
          <div class="event-details">
            <div class="event-title">${event.title}</div>
            <div class="event-info">${new Date(event.date_and_time).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}</div>
            <div class="event-info">${event.venue}</div>
            <div class="event-price">${priceDisplay.displayText}</div>
          </div>
        </div>
      `;
      }).join('')}
    </div>
    
    <div class="cta">
      <p>View all events and get your tickets!</p>
      <a href="${frontendUrl}">Browse All Events</a>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(seoHTML);

  } catch (error) {
    console.error('Generate events list SEO page error:', error);
    res.status(500).send('Internal server error');
  }
};

// Get public EPK (Electronic Press Kit) for an artist
export const getArtistEPK = async (req: Request, res: Response) => {
  try {
    const { artist_id } = req.params;
    const artistId = parseInt(artist_id, 10);

    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    // Extract domain from request for multibrand validation
    const requestDomain = getRequestDomain(req);

    // Get artist with brand and domain information for validation
    const artist = await Artist.findOne({
      where: { id: artistId },
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name', 'brand_color', 'logo_url'],
          include: [
            {
              model: Domain,
              as: 'domains',
              attributes: ['domain_name']
            }
          ]
        }
      ],
      attributes: [
        'id',
        'name',
        'bio',
        'profile_photo',
        'instagram_handle',
        'facebook_handle',
        'twitter_handle',
        'tiktok_handle',
        'youtube_channel',
        'website_page_url',
        'epk_template'
      ]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Validate that the artist belongs to the brand associated with the current domain
    if (artist.brand && artist.brand.domains && requestDomain) {
      const artistBrandDomains = artist.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = artistBrandDomains.includes(requestDomain);
      
      if (!isDomainValid) {
        return res.status(404).json({ error: 'Artist not found' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Get artist's media gallery using ArtistImage model
    const gallery = await ArtistImage.findAll({
      where: { artist_id: artistId },
      attributes: ['id', 'path', 'credits', 'date_uploaded'],
      order: [['date_uploaded', 'DESC']]
    });

    // Get artist's releases using the proper many-to-many relationship
    const releases = await Release.findAll({
      include: [
        {
          model: Artist,
          as: 'artists',
          where: { id: artistId },
          attributes: [],
          through: { attributes: [] } // Don't include junction table data
        },
        {
          model: Song,
          as: 'songs',
          attributes: ['id', 'title', 'track_number', 'audio_file'],
          where: {
            audio_file: {
              [Op.not]: null
            }
          },
          required: false, // LEFT JOIN - include releases even without songs
          order: [['track_number', 'ASC']]
        }
      ],
      attributes: [
        'id',
        'title',
        'description',
        'cover_art',
        'release_date',
        'spotify_link',
        'apple_music_link',
        'youtube_link'
      ],
      order: [['release_date', 'DESC']]
    });

    // Format the response
    const epkData = {
      artist: {
        id: artist.id,
        name: artist.name,
        bio: artist.bio,
        profile_photo: artist.profile_photo,
        epk_template: artist.epk_template || 1,
        social_media: {
          instagram: artist.instagram_handle,
          facebook: artist.facebook_handle,
          twitter: artist.twitter_handle,
          youtube: artist.youtube_channel,
          tiktok: artist.tiktok_handle,
          website: artist.website_page_url
        }
      },
      brand: artist.brand ? {
        id: artist.brand.id,
        name: artist.brand.brand_name,
        color: artist.brand.brand_color,
        logo_url: artist.brand.logo_url
      } : null,
      gallery: gallery.map(item => ({
        id: item.id,
        image_url: item.path,
        caption: item.credits
      })),
      releases: releases.map(release => ({
        id: release.id,
        title: release.title,
        description: release.description,
        cover_art_url: release.cover_art,
        release_date: release.release_date,
        release_type: 'Release', // Default since not in model
        streaming_links: {
          spotify: release.spotify_link,
          apple_music: release.apple_music_link,
          youtube: release.youtube_link,
          soundcloud: null,
          bandcamp: null
        },
        songs: (release as any).songs?.map((song: any) => ({
          id: song.id,
          title: song.title,
          track_number: song.track_number,
          has_audio: !!song.audio_file
        })) || []
      }))
    };

    res.json(epkData);

  } catch (error) {
    console.error('Get artist EPK error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate SEO page on-demand for social media crawlers (Artist EPK)
export const generateArtistEPKSEOPage = async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    
    if (isNaN(artistId)) {
      return res.status(404).send('Artist not found');
    }

    // Get artist details with brand information (no domain validation for SEO pages)
    const artist = await Artist.findOne({
      where: { id: artistId },
      include: [
        {
          model: Brand,
          as: 'brand',
          include: [{
            model: Domain,
            as: 'domains',
            attributes: ['domain_name']
          }]
        }
      ]
    });

    if (!artist) {
      return res.status(404).send('Artist not found');
    }

    // Generate meta tags for social sharing
    const title = `${artist.name} - Electronic Press Kit`;
    const description = artist.bio 
      ? artist.bio.replace(/<[^>]*>/g, '').substring(0, 160) + '...'
      : `Check out ${artist.name}'s music, bio, and latest releases.`;
    const image = artist.profile_photo 
      ? (artist.profile_photo.startsWith('http') ? artist.profile_photo : `https://dashboard-uploads-test.s3.ap-southeast-1.amazonaws.com/${artist.profile_photo}`)
      : '';
    const siteName = artist.brand?.brand_name || 'Melt Records';
    
    // Use the brand's primary domain for the frontend URL
    const brandDomain = artist.brand?.domains?.[0]?.domain_name || 'testbrand.melt-records.com';
    const frontendUrl = `https://${brandDomain}/public/epk/${artist.id}`;

    // Generate structured data for Artist/MusicGroup
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      "name": artist.name,
      "description": description,
      "image": image,
      "url": frontendUrl,
      "sameAs": [
        artist.website_page_url,
        artist.instagram_handle ? `https://instagram.com/${artist.instagram_handle.replace('@', '')}` : null,
        artist.facebook_handle ? `https://facebook.com/${artist.facebook_handle}` : null,
        artist.twitter_handle ? `https://twitter.com/${artist.twitter_handle.replace('@', '')}` : null,
        artist.tiktok_handle ? `https://tiktok.com/@${artist.tiktok_handle.replace('@', '')}` : null,
        artist.youtube_channel
      ].filter(Boolean),
      "recordLabel": {
        "@type": "Organization",
        "name": siteName
      }
    };

    // Generate SEO-optimized HTML
    const seoHTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title.replace(/"/g, '&quot;')}</title>
  <base href="/">
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
  
  <!-- SEO Meta Tags for ${artist.name.replace(/"/g, '&quot;')} -->
  <meta name="description" content="${description.replace(/"/g, '&quot;')}">
  
  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="${frontendUrl}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  ${image ? `<meta property="og:image:width" content="1200">` : ''}
  ${image ? `<meta property="og:image:height" content="630">` : ''}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${frontendUrl}">
  
  <!-- Meta refresh backup for non-crawler users -->
  <meta http-equiv="refresh" content="0; url=${frontendUrl}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
${JSON.stringify(structuredData, null, 4)}
  </script>
  
  <link rel="icon" type="image/x-icon" href="${artist.brand?.favicon_url || '/favicon.ico'}">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(to bottom, ${artist.brand?.brand_color || '#667eea'} 0%, #ffffff 100%); min-height: 100vh;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; padding: 2rem;">
    <div style="text-align: center; margin-bottom: 2rem;">
      ${image ? `<img src="${image}" alt="${artist.name}" style="width: 200px; height: 200px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem; border: 4px solid white; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">` : ''}
      <h1 style="color: #2c3e50; margin: 1rem 0;">${artist.name}</h1>
      ${artist.brand ? `<span style="display: inline-block; padding: 0.5rem 1rem; border-radius: 20px; background: ${artist.brand.brand_color || '#667eea'}; color: white; font-weight: 600; font-size: 0.9rem; text-transform: uppercase;">${siteName}</span>` : ''}
    </div>
    
    ${artist.bio ? `
    <div style="margin-bottom: 2rem;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid ${artist.brand?.brand_color || '#667eea'}; padding-bottom: 0.5rem;">About</h2>
      <div style="line-height: 1.7; color: #495057;">${artist.bio}</div>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin-top: 2rem;">
      <p style="color: #6c757d;">This is a preview for social media crawlers.</p>
      <p><a href="${frontendUrl}" style="color: ${artist.brand?.brand_color || '#667eea'}; text-decoration: none; font-weight: 600;">View Full EPK →</a></p>
    </div>
    
    <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #dee2e6;">
      <p style="font-size: 12px; color: #6c757d;">Powered by Melt Records Dashboard</p>
    </div>
  </div>
  
  <script>
    // Redirect non-crawlers immediately
    if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
      window.location.href = '${frontendUrl}';
    }
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(seoHTML);
    
  } catch (error) {
    console.error('Generate artist EPK SEO page error:', error);
    res.status(500).send('Internal server error');
  }
};

// Stream audio for public EPK (no authentication required, but validated against artist/brand)
export const streamPublicAudio = async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.songId, 10);
    const artistId = parseInt(req.params.artistId, 10);

    if (isNaN(songId) || isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Extract domain from request for multibrand validation
    const requestDomain = getRequestDomain(req);

    // Find song and verify it belongs to a release associated with the specified artist
    // Also get the artist's brand and domains for CORS validation
    const song = await Song.findOne({
      where: { id: songId },
      include: [
        {
          model: Release,
          as: 'release',
          required: true,
          include: [
            {
              model: Artist,
              as: 'artists',
              where: { id: artistId },
              attributes: ['id', 'name'],
              through: { attributes: [] },
              include: [
                {
                  model: Brand,
                  as: 'brand',
                  attributes: ['id'],
                  include: [
                    {
                      model: Domain,
                      as: 'domains',
                      attributes: ['domain_name']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found or does not belong to this artist' });
    }

    if (!song.audio_file) {
      return res.status(404).json({ error: 'No audio file available for this song' });
    }

    // Validate request domain against artist's brand domains
    const artist = (song as any).release?.artists?.[0];
    if (artist?.brand?.domains && requestDomain) {
      const artistBrandDomains = artist.brand.domains.map((d: any) => d.domain_name);
      const isDomainValid = artistBrandDomains.includes(requestDomain);
      
      if (!isDomainValid) {
        return res.status(403).json({ error: 'Access denied from this domain' });
      }
    } else {
      // Fail securely: if we cannot validate brand/domain, deny access
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get audio file from S3
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION
    });

    const params = {
      Bucket: process.env.S3_BUCKET_MASTERS!,
      Key: song.audio_file
    };

    // Get file metadata
    const headData = await s3.headObject(params).promise();
    const fileSize = headData.ContentLength || 0;

    // Set response headers for streaming (but don't expose filename to prevent easy downloads)
    // Use validated origin for CORS instead of wildcard to prevent bandwidth theft
    const origin = req.get('origin') || '';
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Stream the file
    const fileStream = s3.getObject(params).createReadStream();
    fileStream.on('error', (error: any) => {
      console.error('S3 streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming audio file' });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error('Stream public audio error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};