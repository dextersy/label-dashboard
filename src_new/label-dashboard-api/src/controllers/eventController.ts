import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Event, Ticket, EventReferrer, Brand, Domain } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendTicketEmail, sendTicketCancellationEmail, sendPaymentLinkEmail, sendPaymentConfirmationEmail, generateUniqueTicketCode, deleteTicketQRCode } from '../utils/ticketEmailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { sendEmail } from '../utils/emailService';
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

// Helper function to process base64 images in HTML and upload to S3
const processImagesInHtml = async (htmlContent: string, eventId: number): Promise<{html: string, stats: {processed: number, skipped: number, reasons: string[]}}> => {
  // Regular expression to find base64 images in HTML
  const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/gi;
  let processedHtml = htmlContent;
  let match;
  
  // Image size limits
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
  const MAX_TOTAL_IMAGES = 10; // Maximum 10 images per email
  let imageCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  const skipReasons: string[] = [];
  
  while ((match = base64ImageRegex.exec(htmlContent)) !== null) {
    try {
      const [fullMatch, imageType, base64Data] = match;
      
      // Check image count limit
      imageCount++;
      if (imageCount > MAX_TOTAL_IMAGES) {
        skippedCount++;
        skipReasons.push(`Image limit exceeded (max: ${MAX_TOTAL_IMAGES} images)`);
        console.warn(`Email image limit exceeded: skipping image ${imageCount} (max: ${MAX_TOTAL_IMAGES})`);
        continue;
      }
      
      // Validate image type
      const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
      if (!allowedTypes.includes(imageType.toLowerCase())) {
        skippedCount++;
        skipReasons.push(`Unsupported image type: ${imageType}`);
        console.warn(`Unsupported image type: ${imageType}, skipping image`);
        continue;
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Check image size limit
      if (imageBuffer.length > MAX_IMAGE_SIZE) {
        skippedCount++;
        skipReasons.push(`Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
        console.warn(`Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${MAX_IMAGE_SIZE / 1024 / 1024}MB), skipping image`);
        continue;
      }
      
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileName = `email-image-${eventId}-${uniqueSuffix}.${imageType}`;
      
      // Upload to S3
      const uploadParams = {
        Bucket: process.env.S3_BUCKET!,
        Key: fileName,
        Body: imageBuffer,
        ContentType: `image/${imageType}`,
        ACL: 'public-read' // Make images publicly accessible for emails
      };
      
      const result = await s3.upload(uploadParams).promise();
      
      // Replace the base64 src with S3 URL in the HTML
      const newImgTag = fullMatch.replace(/src="data:image\/[^;]+;base64,[^"]+"/, `src="${result.Location}"`);
      processedHtml = processedHtml.replace(fullMatch, newImgTag);
      
      processedCount++;
      console.log(`Successfully uploaded email image: ${fileName} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);
      
    } catch (error) {
      skippedCount++;
      skipReasons.push(`Upload failed: ${error.message}`);
      console.error('Failed to upload email image to S3:', error);
      // Continue processing other images even if one fails
    }
  }
  
  return {
    html: processedHtml,
    stats: {
      processed: processedCount,
      skipped: skippedCount,
      reasons: skipReasons
    }
  };
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
      slug,
      countdown_display,
      google_place_id,
      venue_address,
      venue_latitude,
      venue_longitude,
      venue_phone,
      venue_website,
      venue_maps_url
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
      countdown_display: countdown_display || '1_week',
      brand_id: req.user.brand_id,
      google_place_id: google_place_id || null,
      venue_address: venue_address || null,
      venue_latitude: venue_latitude || null,
      venue_longitude: venue_longitude || null,
      venue_phone: venue_phone || null,
      venue_website: venue_website || null,
      venue_maps_url: venue_maps_url || null
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
      slug,
      countdown_display,
      google_place_id,
      venue_address,
      venue_latitude,
      venue_longitude,
      venue_phone,
      venue_website,
      venue_maps_url
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
      buy_shortlink: updatedBuyLink,
      countdown_display: countdown_display !== undefined ? countdown_display : event.countdown_display,
      google_place_id: google_place_id !== undefined ? (google_place_id === '' ? null : google_place_id) : event.google_place_id,
      venue_address: venue_address !== undefined ? (venue_address === '' ? null : venue_address) : event.venue_address,
      venue_latitude: venue_latitude !== undefined ? (venue_latitude === '' ? null : venue_latitude) : event.venue_latitude,
      venue_longitude: venue_longitude !== undefined ? (venue_longitude === '' ? null : venue_longitude) : event.venue_longitude,
      venue_phone: venue_phone !== undefined ? (venue_phone === '' ? null : venue_phone) : event.venue_phone,
      venue_website: venue_website !== undefined ? (venue_website === '' ? null : venue_website) : event.venue_website,
      venue_maps_url: venue_maps_url !== undefined ? (venue_maps_url === '' ? null : venue_maps_url) : event.venue_maps_url
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

    // Check if request body contains an array of tickets or a single ticket
    const isArrayRequest = Array.isArray(req.body) || Array.isArray(req.body.tickets);
    const ticketsData = isArrayRequest 
      ? (Array.isArray(req.body) ? req.body : req.body.tickets)
      : [req.body]; // Wrap single ticket in array

    if (!Array.isArray(ticketsData) || ticketsData.length === 0) {
      return res.status(400).json({ 
        error: 'Ticket data is required' 
      });
    }

    // Validate all tickets first
    for (let i = 0; i < ticketsData.length; i++) {
      const ticket = ticketsData[i];
      const {
        event_id,
        name,
        email_address,
        contact_number,
        number_of_entries = 1
      } = ticket;

      if (!event_id || !name || !email_address) {
        const errorMsg = ticketsData.length > 1 
          ? `Ticket ${i + 1}: Event ID, name, and email are required` 
          : 'Event ID, name, and email are required';
        return res.status(400).json({ error: errorMsg });
      }

      if (!contact_number) {
        const errorMsg = ticketsData.length > 1 
          ? `Ticket ${i + 1}: Contact number is required` 
          : 'Contact number is required';
        return res.status(400).json({ error: errorMsg });
      }
    }

    const createdTickets = [];

    // Process each ticket
    for (const ticketData of ticketsData) {
      const {
        event_id,
        name,
        email_address,
        contact_number,
        number_of_entries = 1,
        referrer_code,
        send_email = true,
        price_per_ticket,
        payment_processing_fee,
        ticket_paid = false
      } = ticketData;

      const eventIdNum = parseInt(event_id, 10);

      // Get event details (validate each ticket against its event)
      const event = await Event.findOne({
        where: { 
          id: eventIdNum,
          brand_id: req.user.brand_id
        },
        include: [{ model: Brand, as: 'brand' }]
      });

      if (!event) {
        const errorMsg = ticketsData.length > 1 
          ? `Event not found for ticket: ${name}` 
          : 'Event not found';
        return res.status(404).json({ error: errorMsg });
      }

      // Check if event is past (admins can create custom tickets even when sales are closed)
      if (event.date_and_time && new Date() > new Date(event.date_and_time)) {
        const errorMsg = ticketsData.length > 1 
          ? `Cannot create tickets for past event: ${event.title}` 
          : 'Cannot create tickets for past events';
        return res.status(400).json({ error: errorMsg });
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

      // Use custom price if provided, otherwise use event's default price
      const ticketPrice = price_per_ticket !== undefined ? price_per_ticket : event.ticket_price;
      
      // Calculate total amount and processing fee
      const totalAmount = ticketPrice * number_of_entries;
      const processingFee = payment_processing_fee !== undefined ? Number(payment_processing_fee) : 0;

      let paymentLink = null;
      let ticket;

      if (ticket_paid) {
        // For paid tickets, create without payment link
        ticket = await Ticket.create({
          event_id: eventIdNum,
          name,
          email_address,
          contact_number,
          number_of_entries,
          ticket_code: ticketCode,
          status: 'Payment Confirmed',
          price_per_ticket: ticketPrice,
          payment_processing_fee: processingFee,
          referrer_id: referrer?.id || null,
          order_timestamp: new Date()
        });
      } else {
        // Create PayMongo payment link for unpaid tickets
        paymentLink = await paymentService.createPaymentLink({
          amount: totalAmount * 100, // Convert to cents
          description: `${event.title} - ${number_of_entries} ticket(s)`,
          remarks: `Ticket code: ${ticketCode}`
        });

        if (!paymentLink) {
          const errorMsg = ticketsData.length > 1 
            ? `Failed to create payment link for ticket: ${name}` 
            : 'Failed to create payment link';
          return res.status(500).json({ error: errorMsg });
        }

        ticket = await Ticket.create({
          event_id: eventIdNum,
          name,
          email_address,
          contact_number,
          number_of_entries,
          ticket_code: ticketCode,
          status: 'New',
          payment_link: paymentLink.attributes.checkout_url,
          payment_link_id: paymentLink.id,
          price_per_ticket: ticketPrice,
          payment_processing_fee: processingFee,
          referrer_id: referrer?.id || null,
          order_timestamp: new Date()
        });

        // Send payment link email if requested
        if (send_email) {
          const emailSent = await sendPaymentLinkEmail(
            {
              email_address,
              name,
              ticket_code: ticketCode,
              number_of_entries,
              price_per_ticket: ticketPrice,
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
            console.warn(`Failed to send payment link email for ticket: ${name}, but ticket was created successfully`);
          }
        }
      }

      createdTickets.push({
        id: ticket.id,
        ticket_code: ticketCode,
        name,
        email_address,
        status: ticket.status,
        payment_link: paymentLink?.attributes?.checkout_url || null,
        total_amount: totalAmount
      });
    }

    // Return appropriate response based on single vs multiple tickets
    if (ticketsData.length === 1) {
      // Single ticket response (backward compatibility)
      res.status(201).json({
        message: 'Ticket created successfully',
        ticket: createdTickets[0]
      });
    } else {
      // Multiple tickets response
      res.status(201).json({
        message: `${createdTickets.length} tickets created successfully`,
        tickets: createdTickets
      });
    }
  } catch (error) {
    console.error('Add ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      event_id, 
      page = '1', 
      per_page = '20', 
      sort_column, 
      sort_direction = 'desc',
      status_filter,  // Add status filter for specific tab filtering
      ...filters 
    } = req.query;
    
    const eventIdNum = event_id ? parseInt(event_id as string, 10) : undefined;
    const pageNum = parseInt(page as string, 10);
    const perPageNum = Math.min(parseInt(per_page as string, 10), 100); // Max 100 per page
    const offset = (pageNum - 1) * perPageNum;

    // Validate event_id if provided
    if (event_id && (isNaN(eventIdNum!) || eventIdNum! <= 0)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    if (isNaN(perPageNum) || perPageNum < 1) {
      return res.status(400).json({ error: 'Invalid per_page number' });
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

    // Apply status filter for specific tabs
    if (status_filter) {
      if (status_filter === 'sent') {
        // For tickets tab - only show "Ticket sent." tickets
        where.status = 'Ticket sent.';
      } else if (status_filter === 'pending') {
        // For abandoned orders tab - show "New" and "Payment Confirmed"
        where.status = ['New', 'Payment Confirmed'];
      } else if (typeof status_filter === 'string') {
        where.status = status_filter;
      }
    }

    // Apply search filters
    if (filters.name) {
      where.name = { [Op.like]: `%${filters.name}%` };
    }
    if (filters.email_address) {
      where.email_address = { [Op.like]: `%${filters.email_address}%` };
    }
    if (filters.contact_number) {
      where.contact_number = { [Op.like]: `%${filters.contact_number}%` };
    }
    if (filters.ticket_code) {
      where.ticket_code = { [Op.like]: `%${filters.ticket_code}%` };
    }
    if (filters.status && !status_filter) {
      where.status = filters.status;
    }
    if (filters.number_of_entries) {
      where.number_of_entries = parseInt(filters.number_of_entries as string, 10);
    }

    // Build sorting
    const allowedSortColumns = ['id', 'name', 'email_address', 'contact_number', 'number_of_entries', 'ticket_code', 'status', 'order_timestamp', 'number_of_claimed_entries'];
    const sortColumn = allowedSortColumns.includes(sort_column as string) ? sort_column as string : 'id';
    const sortDir = ['asc', 'desc'].includes(sort_direction as string) ? sort_direction as string : 'desc';
    
    const order: any = [[sortColumn, sortDir]];

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where,
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id }
        },
        { model: EventReferrer, as: 'referrer' }
      ],
      order,
      limit: perPageNum,
      offset: offset,
      distinct: true
    });

    // Build pagination info
    const totalPages = Math.ceil(count / perPageNum);
    const pagination = {
      current_page: pageNum,
      total_pages: totalPages,
      total_count: count,
      per_page: perPageNum,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1
    };

    res.json({ 
      tickets,
      pagination 
    });
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
      
      // Delete QR code from S3 when canceling paid/sent tickets
      const qrDeleted = await deleteTicketQRCode(ticket.event.id, ticket.ticket_code);
      if (!qrDeleted) {
        console.warn('Failed to delete QR code from S3, but continuing with cancellation');
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
        id: ticket.event.id,
        title: ticket.event.title,
        date_and_time: ticket.event.date_and_time,
        venue: ticket.event.venue,
        rsvp_link: ticket.event.rsvp_link,
        venue_address: ticket.event.venue_address,
        venue_latitude: ticket.event.venue_latitude,
        venue_longitude: ticket.event.venue_longitude,
        venue_maps_url: ticket.event.venue_maps_url
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

export const cancelAllUnpaidTickets = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id, 10);

    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify user has access to this event
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

    // Find all unpaid tickets for this event
    const unpaidTickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: 'New'
      }
    });

    if (unpaidTickets.length === 0) {
      return res.json({
        message: 'No unpaid tickets found to cancel',
        canceled_count: 0
      });
    }

    // Update all unpaid tickets to canceled status
    const [updatedCount] = await Ticket.update(
      { status: 'Canceled' },
      {
        where: {
          event_id: eventIdNum,
          status: 'New'
        }
      }
    );

    res.json({
      message: `Successfully canceled ${updatedCount} unpaid ticket(s)`,
      canceled_count: updatedCount,
      event_id: eventIdNum
    });
  } catch (error) {
    console.error('Cancel all unpaid tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyAllPayments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const eventIdNum = parseInt(event_id, 10);

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

    // Find all tickets with payment links (similar to PHP logic)
    const ticketsToVerify = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: 'New',
        payment_link_id: { [Op.not]: null }
      }
    });

    if (ticketsToVerify.length === 0) {
      return res.json({
        message: 'No tickets with payment links found to verify',
        verified_count: 0,
        event_id: eventIdNum
      });
    }

    let verifiedCount = 0;
    const verificationResults = [];

    // Process each ticket's payment verification
    for (const ticket of ticketsToVerify) {
      try {
        // Get payment information from PayMongo using the payment_link_id
        const paymentLink = await paymentService.getPaymentLink(ticket.payment_link_id);
        
        if (paymentLink && paymentLink.attributes?.status === 'paid') {
          // Calculate processing fee from payments
          let processingFee = 0;
          if (paymentLink.attributes?.payments) {
            processingFee = paymentLink.attributes.payments.reduce((total: number, payment: any) => {
              return total + ((payment.data?.attributes?.amount - payment.data?.attributes?.net_amount) / 100);
            }, 0);
          }

          // Update ticket payment status
          const success = await paymentService.updateTicketPaymentStatus(ticket.id, processingFee);
          
          if (success) {
            verifiedCount++;
            verificationResults.push({
              ticket_id: ticket.id,
              status: 'verified',
              processing_fee: processingFee
            });
          } else {
            verificationResults.push({
              ticket_id: ticket.id,
              status: 'failed_to_update'
            });
          }
        } else {
          verificationResults.push({
            ticket_id: ticket.id,
            status: 'payment_not_confirmed'
          });
        }
      } catch (error) {
        console.error(`Failed to verify payment for ticket ${ticket.id}:`, error);
        verificationResults.push({
          ticket_id: ticket.id,
          status: 'verification_error',
          error: error.message
        });
      }
    }

    res.json({
      message: `Payment verification completed. ${verifiedCount} out of ${ticketsToVerify.length} tickets were verified`,
      verified_count: verifiedCount,
      total_checked: ticketsToVerify.length,
      event_id: eventIdNum,
      details: verificationResults
    });
  } catch (error) {
    console.error('Verify all payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendEventEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id, subject, message, include_banner = true } = req.body;

    if (!event_id || !subject || !message) {
      return res.status(400).json({ 
        error: 'Event ID, subject, and message are required' 
      });
    }

    // Additional validation to prevent abuse
    if (subject.length > 500) {
      return res.status(400).json({ 
        error: 'Subject line too long (maximum 500 characters)' 
      });
    }

    if (message.length > 10 * 1024 * 1024) { // 10MB limit for message content
      return res.status(400).json({ 
        error: 'Message content too large (maximum 10MB)' 
      });
    }

    const eventIdNum = parseInt(event_id, 10);

    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify user has access to this event
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

    // Get all confirmed ticket holders (Payment Confirmed or Ticket sent)
    const tickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: ['Payment Confirmed', 'Ticket sent.']
      }
    });

    if (tickets.length === 0) {
      return res.json({
        message: 'No confirmed ticket holders found for this event',
        recipients_count: 0,
        success_count: 0,
        failed_count: 0
      });
    }

    // Get unique email addresses from ticket holders
    const uniqueEmails = [...new Set(tickets.map(ticket => ticket.email_address))];
    
    // Process any base64 images in the message and upload to S3
    let processedMessage = message;
    let imageStats = { processed: 0, skipped: 0, reasons: [] };
    try {
      const imageResult = await processImagesInHtml(message, eventIdNum);
      processedMessage = imageResult.html;
      imageStats = imageResult.stats;
    } catch (error) {
      console.error('Failed to process images in email:', error);
      // Continue with original message if image processing fails
    }
    
    let htmlMessage = processedMessage;
    
    // Add email banner if requested
    if (include_banner && event.brand) {
      const brandColor = event.brand.brand_color || '#1595e7';
      const brandLogo = event.brand.logo_url || '';
      
      const bannerHtml = `
        <div style="background-color: ${brandColor}; padding: 20px; text-align: center; margin-bottom: 20px;">
          ${brandLogo ? `<img src="${brandLogo}" alt="${event.brand.brand_name}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
          <h2 style="color: white; margin: 0; font-family: Arial, sans-serif;">${event.title}</h2>
        </div>
      `;
      
      htmlMessage = bannerHtml + processedMessage;
    }

    let successCount = 0;
    let failedCount = 0;

    // Send email to each unique recipient
    for (const email of uniqueEmails) {
      try {
        const success = await sendEmail([email], subject, htmlMessage, req.user.brand_id);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        failedCount++;
      }
    }

    res.json({
      message: `Email sending completed. ${successCount} sent successfully, ${failedCount} failed.`,
      recipients_count: uniqueEmails.length,
      success_count: successCount,
      failed_count: failedCount,
      event_title: event.title,
      image_stats: imageStats
    });
  } catch (error) {
    console.error('Send event email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEventTicketHoldersCount = async (req: AuthRequest, res: Response) => {
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

    // Get confirmed ticket holders count
    const tickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: ['Payment Confirmed', 'Ticket sent.']
      },
      attributes: ['email_address']
    });

    // Count unique email addresses
    const uniqueEmails = [...new Set(tickets.map(ticket => ticket.email_address))];
    
    res.json({
      event_id: eventIdNum,
      recipients_count: uniqueEmails.length,
      total_confirmed_tickets: tickets.length
    });
  } catch (error) {
    console.error('Get event ticket holders count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEventTicketSummary = async (req: AuthRequest, res: Response) => {
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

    // Get ALL tickets for this event to calculate summary statistics
    const allTickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum
      },
      attributes: [
        'status', 
        'number_of_entries', 
        'price_per_ticket', 
        'payment_processing_fee'
      ]
    });

    // Filter confirmed tickets (both Payment Confirmed and Ticket sent)
    const confirmedTickets = allTickets.filter(ticket => 
      ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed'
    );

    // Count only "Ticket sent." tickets for tickets sold (matching PHP logic)
    const totalTicketsSold = allTickets
      .filter(ticket => ticket.status === 'Ticket sent.')
      .reduce((sum, ticket) => sum + ticket.number_of_entries, 0);

    // Calculate total revenue from confirmed/sent tickets
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      const price = Number(ticket.price_per_ticket) || 0;
      const entries = Number(ticket.number_of_entries) || 0;
      return sum + (price * entries);
    }, 0);

    // Calculate total processing fees from confirmed/sent tickets
    const totalProcessingFee = confirmedTickets.reduce((sum, ticket) => {
      return sum + (Number(ticket.payment_processing_fee) || 0);
    }, 0);

    // Platform fee is 5% of total revenue
    const platformFee = Number((totalRevenue * 0.05).toFixed(2)) || 0;
    
    // Grand total after platform fee
    const grandTotal = Number((totalRevenue * 0.95).toFixed(2)) || 0;
    
    // Net revenue after processing fees
    const netRevenue = Number((totalRevenue - totalProcessingFee).toFixed(2)) || 0;
    
    // Tax calculation (0.5% of net revenue)
    const tax = Number((netRevenue * 0.005).toFixed(2)) || 0;
    
    // Admin grand total after processing fees and tax
    const adminGrandTotal = Number((netRevenue * 0.995).toFixed(2)) || 0;

    res.json({
      event_id: eventIdNum,
      summary: {
        total_tickets_sold: totalTicketsSold,
        total_revenue: totalRevenue,
        total_processing_fee: totalProcessingFee,
        net_revenue: netRevenue,
        platform_fee: platformFee,
        grand_total: grandTotal,
        tax: tax,
        admin_grand_total: adminGrandTotal
      }
    });
  } catch (error) {
    console.error('Get event ticket summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportEventTicketsCsv = async (req: AuthRequest, res: Response) => {
  try {
    const eventIdNum = parseInt(req.query.event_id as string, 10);
    
    if (isNaN(eventIdNum)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify event exists and belongs to user's brand
    const event = await Event.findOne({
      where: {
        id: eventIdNum,
        brand_id: req.user.brand_id
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get ALL confirmed tickets for this event (no pagination, no filters)
    const tickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: 'Ticket sent.' // Only confirmed tickets like the main view
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          attributes: ['title']
        },
        {
          model: EventReferrer,
          as: 'referrer',
          attributes: ['name'],
          required: false
        }
      ],
      order: [['id', 'DESC']]
    });

    // Format tickets for CSV export (matching frontend format)
    const csvData = tickets.map(ticket => ({
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
      number_of_entries: ticket.number_of_entries,
      ticket_code: ticket.ticket_code,
      referrer_name: ticket.referrer?.name || '',
      notes: '' // Empty notes column to match PHP format
    }));

    res.json({
      event_id: eventIdNum,
      event_title: event.title,
      tickets: csvData,
      total_count: tickets.length
    });
  } catch (error) {
    console.error('Export event tickets CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportEventPendingTicketsCsv = async (req: AuthRequest, res: Response) => {
  try {
    const eventIdNum = parseInt(req.query.event_id as string, 10);
    
    if (isNaN(eventIdNum)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Verify event exists and belongs to user's brand
    const event = await Event.findOne({
      where: {
        id: eventIdNum,
        brand_id: req.user.brand_id
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get ALL pending tickets for this event (no pagination, no filters)
    const tickets = await Ticket.findAll({
      where: {
        event_id: eventIdNum,
        status: ['New', 'Payment Confirmed'] // Pending tickets statuses
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          attributes: ['title']
        },
        {
          model: EventReferrer,
          as: 'referrer',
          attributes: ['name'],
          required: false
        }
      ],
      order: [['id', 'DESC']]
    });

    // Format tickets for CSV export (matching frontend format for pending orders)
    const csvData = tickets.map(ticket => ({
      name: ticket.name,
      email_address: ticket.email_address,
      contact_number: ticket.contact_number || '',
      number_of_entries: ticket.number_of_entries,
      ticket_code: '', // Empty ticket code for pending orders
      referrer_name: ticket.referrer?.name || '',
      notes: '', // Empty notes column to match PHP format
      status: ticket.status
    }));

    res.json({
      event_id: eventIdNum,
      event_title: event.title,
      tickets: csvData,
      total_count: tickets.length
    });
  } catch (error) {
    console.error('Export event pending tickets CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};