import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Event, Ticket, EventReferrer, Brand, Domain, TicketType } from '../models';
import { PaymentService } from '../utils/paymentService';
import { sendTicketEmail, sendTicketCancellationEmail, sendPaymentLinkEmail, sendPaymentConfirmationEmail, generateUniqueTicketCode, deleteTicketQRCode } from '../utils/ticketEmailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { calculatePlatformFeeForEventTickets } from '../utils/platformFeeCalculator';
import { sendEmail, sendEmailWithInlineImages, loadEmailTemplate, processTemplate } from '../utils/emailService';

// Helper function to add responsive image styling to content
const addResponsiveImageStyling = (content: string): string => {
  // Add responsive styling to images
  return content.replace(
    /<img([^>]*)>/gi, 
    '<img$1 style="max-width: 100%; height: auto; display: block;">'
  );
};
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
  console.log('createShortLink called with:', { originalUrl, path });
  
  const shortIoDomain = process.env.SHORT_IO_DOMAIN;
  const shortIoKey = process.env.SHORT_IO_KEY;
  
  console.log('Environment variables:', { 
    shortIoDomain: shortIoDomain ? 'configured' : 'missing',
    shortIoKey: shortIoKey ? 'configured' : 'missing'
  });
  
  // If Short.io is not configured, create a fallback short link
  if (!shortIoDomain || !shortIoKey) {
    console.log('Short.io not configured, using fallback URL');
    return originalUrl;
  }

  const maxAttempts = 10; // Prevent infinite loops
  let finalPath = path;
  let counter = 1;

  // Try to create the shortlink, handling 409 conflicts by appending numbers
  while (counter <= maxAttempts) {
    try {
      console.log(`Attempting to create shortlink with path: "${finalPath}"`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

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
          path: finalPath
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as { secureShortURL: string };
        console.log('Short.io success:', data.secureShortURL);
        return data.secureShortURL;
      }

      // Check if it's a 409 conflict error (path already exists)
      if (response.status === 409) {
        console.log(`Path "${finalPath}" already exists (409 conflict), trying with number suffix`);
        finalPath = `${path}${counter}`;
        counter++;
        continue;
      }

      // For other errors, throw to fall back to original URL
      const errorText = await response.text();
      console.error('Short.io API error:', response.status, errorText);
      throw new Error(`Short.io API error: ${response.status} - ${errorText}`);

    } catch (error: any) {
      // If it's not a 409 conflict or we've reached max attempts, give up
      if (counter >= maxAttempts || !error.message?.includes('409')) {
        console.error('Failed to create short link, using fallback:', error);
        return originalUrl;
      }

      // For 409 conflicts in catch block, try the next iteration
      console.log(`Conflict detected, trying with number suffix`);
      finalPath = `${path}${counter}`;
      counter++;
    }
  }

  console.warn(`Could not create shortlink after ${maxAttempts} attempts, using fallback URL`);
  return originalUrl;
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
        { model: EventReferrer, as: 'referrers' },
        { model: TicketType, as: 'ticketTypes' }
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
        { model: EventReferrer, as: 'referrers' },
        { model: TicketType, as: 'ticketTypes' }
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

    console.log('createEvent status field:', req.body.status);

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
      show_tickets_remaining,
      google_place_id,
      venue_address,
      venue_latitude,
      venue_longitude,
      venue_phone,
      venue_website,
      venue_maps_url,
      status,
      ticketTypes
    } = req.body;

    // Parse ticketTypes if it's a string (from FormData)
    let parsedTicketTypes = ticketTypes;
    if (typeof ticketTypes === 'string') {
      try {
        parsedTicketTypes = JSON.parse(ticketTypes);
      } catch (error) {
        console.error('Failed to parse ticketTypes JSON:', error);
        return res.status(400).json({ 
          error: 'Invalid ticketTypes format' 
        });
      }
    }

    // Validate basic fields
    if (!title || !date_and_time || !venue) {
      return res.status(400).json({ 
        error: 'Title, date/time, and venue are required' 
      });
    }

    // Validate ticket types - ensure at least one is provided
    if (!parsedTicketTypes || !Array.isArray(parsedTicketTypes) || parsedTicketTypes.length === 0) {
      // Fallback to legacy ticket_price approach if ticketTypes not provided
      if (!ticket_price && ticket_price !== 0) {
        return res.status(400).json({ 
          error: 'At least one ticket type is required' 
        });
      }
    } else {
      // Validate ticket types structure
      for (let i = 0; i < parsedTicketTypes.length; i++) {
        const ticketType = parsedTicketTypes[i];
        if (!ticketType.name || ticketType.price === undefined) {
          return res.status(400).json({ 
            error: `Ticket type ${i + 1}: Name and price are required` 
          });
        }
        if (isNaN(parseFloat(ticketType.price)) || parseFloat(ticketType.price) < 0) {
          return res.status(400).json({ 
            error: `Ticket type ${i + 1}: Invalid price` 
          });
        }
      }
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
      show_tickets_remaining: show_tickets_remaining !== undefined ? show_tickets_remaining : true,
      brand_id: req.user.brand_id,
      google_place_id: google_place_id || null,
      venue_address: venue_address || null,
      venue_latitude: venue_latitude || null,
      venue_longitude: venue_longitude || null,
      venue_phone: venue_phone || null,
      venue_website: venue_website || null,
      venue_maps_url: venue_maps_url || null,
      status: status || 'draft'
    });

    // Only generate shortlinks if event is being published    
    if (event.status === 'published') {
      try {
        const eventSlug = (slug && slug.trim()) ? slug.trim() : generateEventSlug(event.title);
        let finalVerificationLink = verification_link;
        let finalBuyLink = buy_shortlink;
        
        // Generate shortlinks if not provided for published events
        if (!verification_link || verification_link.trim() === '') {
          finalVerificationLink = await generateVerificationLink(event.id, eventSlug, req.user.brand_id);
        }
        
        if (!buy_shortlink || buy_shortlink.trim() === '') {
          finalBuyLink = await generateBuyLink(event.id, eventSlug, req.user.brand_id);
        }
        
        // Update event with generated shortlinks
        await event.update({
          verification_link: finalVerificationLink || '',
          buy_shortlink: finalBuyLink || ''
        });
        
        // Refresh event to get updated values
        await event.reload();
      } catch (error) {
        console.error('URL generation error:', error);
        // Event was created but URL generation failed - still return success but log error
        console.warn('Event created but shortlink generation failed:', error.message);
      }
    }

    // Create ticket types
    if (parsedTicketTypes && Array.isArray(parsedTicketTypes) && parsedTicketTypes.length > 0) {
      // Create provided ticket types
      for (const ticketType of parsedTicketTypes) {
        await TicketType.create({
          event_id: event.id,
          name: ticketType.name.trim(),
          price: parseFloat(ticketType.price)
        });
      }
    } else {
      // Create default ticket type using legacy ticket_price and ticket_naming
      await TicketType.create({
        event_id: event.id,
        name: ticket_naming || 'Regular',
        price: parseFloat(ticket_price)
      });
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
      show_tickets_remaining,
      google_place_id,
      venue_address,
      venue_latitude,
      venue_longitude,
      venue_phone,
      venue_website,
      venue_maps_url,
      status
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
    
    // Only regenerate URLs for published events
    const isPublished = (status !== undefined ? status : event.status) === 'published';
    const needsUrlRegeneration = isPublished && (slug || (title && title !== event.title)) && (!verification_link || !buy_shortlink);

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
      show_tickets_remaining: show_tickets_remaining !== undefined ? show_tickets_remaining : event.show_tickets_remaining,
      google_place_id: google_place_id !== undefined ? (google_place_id === '' ? null : google_place_id) : event.google_place_id,
      venue_address: venue_address !== undefined ? (venue_address === '' ? null : venue_address) : event.venue_address,
      venue_latitude: venue_latitude !== undefined ? (venue_latitude === '' ? null : venue_latitude) : event.venue_latitude,
      venue_longitude: venue_longitude !== undefined ? (venue_longitude === '' ? null : venue_longitude) : event.venue_longitude,
      venue_phone: venue_phone !== undefined ? (venue_phone === '' ? null : venue_phone) : event.venue_phone,
      venue_website: venue_website !== undefined ? (venue_website === '' ? null : venue_website) : event.venue_website,
      venue_maps_url: venue_maps_url !== undefined ? (venue_maps_url === '' ? null : venue_maps_url) : event.venue_maps_url,
      status: status !== undefined ? status : event.status
    });

    // Reload the event with tickets to return complete data
    const updatedEventWithTickets = await Event.findByPk(event.id, {
      include: [
        {
          model: require('../models').Ticket,
          as: 'tickets',
          attributes: ['id', 'name', 'status', 'number_of_entries']
        }
      ]
    });

    res.json({
      message: 'Event updated successfully',
      event: updatedEventWithTickets
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
        ticket_type_id,
        name,
        email_address,
        contact_number,
        number_of_entries = 1
      } = ticket;

      if (!event_id || !ticket_type_id || !name || !email_address) {
        const errorMsg = ticketsData.length > 1 
          ? `Ticket ${i + 1}: Event ID, ticket type ID, name, and email are required` 
          : 'Event ID, ticket type ID, name, and email are required';
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
        ticket_type_id,
        name,
        email_address,
        contact_number,
        number_of_entries = 1,
        referrer_code,
        send_email = true,
        price_per_ticket,
        payment_processing_fee,
        platform_fee,
        ticket_paid = false,
        order_timestamp
      } = ticketData;

      const eventIdNum = parseInt(event_id, 10);
      const ticketTypeIdNum = parseInt(ticket_type_id, 10);

      if (!ticket_type_id || isNaN(ticketTypeIdNum)) {
        const errorMsg = ticketsData.length > 1 
          ? `Ticket ${name}: Ticket type ID is required` 
          : 'Ticket type ID is required';
        return res.status(400).json({ error: errorMsg });
      }

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

      // Get and validate ticket type
      const ticketType = await TicketType.findOne({
        where: {
          id: ticketTypeIdNum,
          event_id: eventIdNum
        }
      });

      if (!ticketType) {
        const errorMsg = ticketsData.length > 1 
          ? `Invalid ticket type for ticket: ${name}` 
          : 'Invalid ticket type';
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

      // Use custom price if provided, otherwise use ticket type's price
      const ticketPrice = price_per_ticket !== undefined ? price_per_ticket : ticketType.price;

      // Calculate total amount and processing fee
      const totalAmount = ticketPrice * number_of_entries;
      const processingFee = payment_processing_fee !== undefined ? Number(payment_processing_fee) : 0;

      // Use provided platform fee if available (for transfers), otherwise calculate it
      let platformFeeValue;
      if (platform_fee !== undefined && platform_fee !== null) {
        // Use the provided platform fee (including 0)
        platformFeeValue = Number(platform_fee);
      } else {
        // Calculate platform fee based on brand settings
        const platformFeeCalc = await calculatePlatformFeeForEventTickets(
          event.brand_id,
          ticketPrice,
          number_of_entries,
          processingFee
        );
        // Ensure it's always a number, default to 0 if calculation returns null/undefined
        platformFeeValue = platformFeeCalc.totalPlatformFee ?? 0;
      }

      let paymentLink = null;
      let ticket;

      if (ticket_paid) {
        // For paid tickets, create without payment link
        ticket = await Ticket.create({
          event_id: eventIdNum,
          ticket_type_id: ticketTypeIdNum,
          name,
          email_address,
          contact_number,
          number_of_entries,
          ticket_code: ticketCode,
          status: 'Payment Confirmed',
          price_per_ticket: ticketPrice,
          payment_processing_fee: processingFee,
          platform_fee: platformFeeValue,
          referrer_id: referrer?.id || null,
          order_timestamp: order_timestamp ? new Date(order_timestamp) : new Date(),
          date_paid: new Date()
        });
      } else {
        // Create PayMongo payment link for unpaid tickets
        paymentLink = await paymentService.createPaymentLink({
          amount: totalAmount * 100, // Convert to cents
          description: `${event.title} - ${number_of_entries} ${ticketType.name} ${number_of_entries === 1 ? 'ticket' : 'tickets'}`,
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
          ticket_type_id: ticketTypeIdNum,
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
          platform_fee: platformFeeValue,
          referrer_id: referrer?.id || null,
          order_timestamp: order_timestamp ? new Date(order_timestamp) : new Date()
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
              payment_processing_fee: processingFee,
              ticket_type: {
                id: ticketType.id,
                name: ticketType.name
              }
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
        // For tickets tab - show "Ticket sent." and "Refunded" tickets
        where.status = ['Ticket sent.', 'Refunded'];
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
    const allowedSortColumns = ['id', 'name', 'email_address', 'contact_number', 'number_of_entries', 'ticket_code', 'status', 'order_timestamp', 'date_paid', 'number_of_claimed_entries'];
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
        { model: EventReferrer, as: 'referrer' },
        { model: TicketType, as: 'ticketType' }
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

    const { ticket_id, ticket_ids } = req.body;

    // Handle both single ticket_id and array of ticket_ids
    let ticketIds: number[];
    if (ticket_ids) {
      // Array format (bulk operations)
      if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
        return res.status(400).json({ error: 'Ticket IDs must be a non-empty array' });
      }
      ticketIds = ticket_ids.filter(id => Number.isInteger(id) && id > 0);
      if (ticketIds.length !== ticket_ids.length) {
        return res.status(400).json({ error: 'All ticket IDs must be valid positive integers' });
      }
    } else if (ticket_id) {
      // Single ticket format (backward compatibility)
      if (!Number.isInteger(ticket_id) || ticket_id <= 0) {
        return res.status(400).json({ error: 'Ticket ID must be a valid positive integer' });
      }
      ticketIds = [ticket_id];
    } else {
      return res.status(400).json({ error: 'Either ticket_id or ticket_ids is required' });
    }

    // Find tickets that belong to user's brand and can be marked as paid (New status)
    const tickets = await Ticket.findAll({
      where: { 
        id: ticketIds,
        status: 'New'
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id },
          include: [{ model: Brand, as: 'brand' }]
        }
      ]
    });

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'No eligible tickets found for marking as paid (only New status tickets can be marked as paid)' });
    }

    // Update all tickets to 'Payment Confirmed' status and set platform fee
    for (const ticket of tickets) {
      // Calculate platform fee for this ticket
      const platformFeeCalc = await calculatePlatformFeeForEventTickets(
        ticket.event.brand_id,
        ticket.price_per_ticket || 0,
        ticket.number_of_entries,
        ticket.payment_processing_fee || 0
      );

      // Update individual ticket with platform fee
      await ticket.update({
        status: 'Payment Confirmed',
        platform_fee: platformFeeCalc.totalPlatformFee,
        date_paid: new Date()
      });
    }

    // Send payment confirmation emails
    let emailErrors = 0;
    for (const ticket of tickets) {
      try {
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
          emailErrors++;
          console.warn(`Failed to send payment confirmation email for ticket ${ticket.id}`);
        }
      } catch (error) {
        emailErrors++;
        console.error(`Error sending payment confirmation email for ticket ${ticket.id}:`, error);
      }
    }

    const message = tickets.length === 1 
      ? 'Ticket marked as paid successfully'
      : `${tickets.length} tickets marked as paid successfully`;

    res.json({ 
      message: emailErrors > 0 ? `${message} (${emailErrors} email notifications failed)` : message,
      updated_count: tickets.length,
      ticket_ids: tickets.map(t => t.id),
      tickets: tickets.length === 1 ? tickets[0] : tickets
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

    const { ticket_id, ticket_ids } = req.body;

    // Handle both single ticket_id and array of ticket_ids
    let ticketIds: number[];
    if (ticket_ids) {
      // Array format (bulk operations)
      if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
        return res.status(400).json({ error: 'Ticket IDs must be a non-empty array' });
      }
      ticketIds = ticket_ids.filter(id => Number.isInteger(id) && id > 0);
      if (ticketIds.length !== ticket_ids.length) {
        return res.status(400).json({ error: 'All ticket IDs must be valid positive integers' });
      }
    } else if (ticket_id) {
      // Single ticket format (backward compatibility)
      if (!Number.isInteger(ticket_id) || ticket_id <= 0) {
        return res.status(400).json({ error: 'Ticket ID must be a valid positive integer' });
      }
      ticketIds = [ticket_id];
    } else {
      return res.status(400).json({ error: 'Either ticket_id or ticket_ids is required' });
    }

    // Find tickets that belong to user's brand and are not already canceled
    const tickets = await Ticket.findAll({
      where: { 
        id: ticketIds,
        status: { [Op.ne]: 'Canceled' }
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id },
          include: [{ model: Brand, as: 'brand' }]
        }
      ]
    });

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'No eligible tickets found for cancellation (tickets may already be canceled or not found)' });
    }

    // Update all tickets to 'Canceled' status
    await Ticket.update(
      { status: 'Canceled' },
      { 
        where: { 
          id: tickets.map(t => t.id)
        }
      }
    );

    // Process cancellation emails and QR code deletion for paid/sent tickets
    let emailErrors = 0;
    let qrCodeErrors = 0;
    for (const ticket of tickets) {
      const originalStatus = ticket.status;
      
      // Send cancellation email if ticket was already paid/sent
      if (originalStatus === 'Payment Confirmed' || originalStatus === 'Ticket sent.') {
        try {
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
            emailErrors++;
            console.warn(`Failed to send cancellation email for ticket ${ticket.id}`);
          }
        } catch (error) {
          emailErrors++;
          console.error(`Error sending cancellation email for ticket ${ticket.id}:`, error);
        }
        
        // Delete QR code from S3
        try {
          const qrDeleted = await deleteTicketQRCode(ticket.event.id, ticket.ticket_code);
          if (!qrDeleted) {
            qrCodeErrors++;
            console.warn(`Failed to delete QR code from S3 for ticket ${ticket.id}`);
          }
        } catch (error) {
          qrCodeErrors++;
          console.error(`Error deleting QR code for ticket ${ticket.id}:`, error);
        }
      }
    }

    const message = tickets.length === 1 
      ? 'Ticket canceled successfully'
      : `${tickets.length} tickets canceled successfully`;

    let warningMessage = '';
    if (emailErrors > 0 || qrCodeErrors > 0) {
      const warnings = [];
      if (emailErrors > 0) warnings.push(`${emailErrors} cancellation emails failed`);
      if (qrCodeErrors > 0) warnings.push(`${qrCodeErrors} QR code deletions failed`);
      warningMessage = ` (${warnings.join(', ')})`;
    }

    res.json({ 
      message: `${message}${warningMessage}`,
      cancelled_count: tickets.length,
      ticket_ids: tickets.map(t => t.id),
      tickets: tickets.length === 1 ? { id: tickets[0].id, status: 'Canceled' } : tickets.map(t => ({ id: t.id, status: 'Canceled' }))
    });
  } catch (error) {
    console.error('Cancel ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refundTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { ticket_id, ticket_ids, reason } = req.body;

    // Handle both single ticket_id and array of ticket_ids
    let ticketIds: number[];
    if (ticket_ids) {
      // Array format (bulk operations)
      if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
        return res.status(400).json({ error: 'Ticket IDs must be a non-empty array' });
      }
      ticketIds = ticket_ids.filter(id => Number.isInteger(id) && id > 0);
      if (ticketIds.length !== ticket_ids.length) {
        return res.status(400).json({ error: 'All ticket IDs must be valid positive integers' });
      }
    } else if (ticket_id) {
      // Single ticket format (backward compatibility)
      if (!Number.isInteger(ticket_id) || ticket_id <= 0) {
        return res.status(400).json({ error: 'Ticket ID must be a valid positive integer' });
      }
      ticketIds = [ticket_id];
    } else {
      return res.status(400).json({ error: 'Either ticket_id or ticket_ids is required' });
    }

    // Find tickets that belong to user's brand and are eligible for refund
    const tickets = await Ticket.findAll({
      where: {
        id: ticketIds,
        status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.'] },
        number_of_claimed_entries: 0 // Only unclaimed tickets can be refunded
      },
      include: [
        {
          model: Event,
          as: 'event',
          where: { brand_id: req.user.brand_id },
          include: [{ model: Brand, as: 'brand' }]
        }
      ]
    });

    if (tickets.length === 0) {
      return res.status(404).json({
        error: 'No eligible tickets found for refund (tickets must be paid, not sent, and not claimed)'
      });
    }

    // Process refunds through Paymongo
    const refundResults = [];
    const refundErrors = [];

    for (const ticket of tickets) {
      try {
        await paymentService.refundTicket(ticket.id, reason);
        refundResults.push({
          id: ticket.id,
          status: 'Refunded',
          success: true
        });
      } catch (error: any) {
        refundErrors.push({
          id: ticket.id,
          error: error.message || 'Refund failed'
        });
      }
    }

    const successCount = refundResults.length;
    const errorCount = refundErrors.length;

    if (successCount === 0) {
      return res.status(500).json({
        error: 'All refunds failed',
        details: refundErrors
      });
    }

    const message = successCount === 1
      ? 'Ticket refunded successfully'
      : `${successCount} ticket${successCount > 1 ? 's' : ''} refunded successfully`;

    let warningMessage = '';
    if (errorCount > 0) {
      warningMessage = ` (${errorCount} refund${errorCount > 1 ? 's' : ''} failed)`;
    }

    res.json({
      message: `${message}${warningMessage}`,
      refunded_count: successCount,
      failed_count: errorCount,
      refunded_tickets: refundResults,
      failed_refunds: refundErrors.length > 0 ? refundErrors : undefined
    });
  } catch (error) {
    console.error('Refund ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resendTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { ticket_id, ticket_ids } = req.body;

    // Handle both single ticket_id and array of ticket_ids
    let ticketIds: number[];
    if (ticket_ids) {
      // Array format (bulk operations)
      if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
        return res.status(400).json({ error: 'Ticket IDs must be a non-empty array' });
      }
      ticketIds = ticket_ids.filter(id => Number.isInteger(id) && id > 0);
      if (ticketIds.length !== ticket_ids.length) {
        return res.status(400).json({ error: 'All ticket IDs must be valid positive integers' });
      }
    } else if (ticket_id) {
      // Single ticket format (backward compatibility)
      if (!Number.isInteger(ticket_id) || ticket_id <= 0) {
        return res.status(400).json({ error: 'Ticket ID must be a valid positive integer' });
      }
      ticketIds = [ticket_id];
    } else {
      return res.status(400).json({ error: 'Either ticket_id or ticket_ids is required' });
    }

    // Find tickets that belong to user's brand and can be resent (Payment Confirmed or Ticket sent status)
    const tickets = await Ticket.findAll({
      where: { 
        id: ticketIds,
        status: ['Payment Confirmed', 'Ticket sent.']
      },
      include: [
        { 
          model: Event, 
          as: 'event',
          where: { brand_id: req.user.brand_id },
          include: [{ model: Brand, as: 'brand' }]
        },
        { 
          model: TicketType, 
          as: 'ticketType',
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'No eligible tickets found for resending (only Payment Confirmed and Ticket sent tickets can be resent)' });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each ticket
    for (const ticket of tickets) {
      try {
        // Send ticket email using helper function
        const emailSent = await sendTicketEmail(
          {
            email_address: ticket.email_address,
            name: ticket.name,
            ticket_code: ticket.ticket_code,
            number_of_entries: ticket.number_of_entries,
            ticket_type: (ticket as any).ticketType ? {
              id: (ticket as any).ticketType.id,
              name: (ticket as any).ticketType.name
            } : undefined
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

        if (emailSent) {
          // Update status to "Ticket sent." if it wasn't already
          if (ticket.status !== 'Ticket sent.') {
            await ticket.update({ status: 'Ticket sent.' });
          }
          successCount++;
        } else {
          failedCount++;
          errors.push(`Ticket ${ticket.id}: Failed to send email`);
        }
      } catch (error) {
        console.error(`Failed to resend ticket ${ticket.id}:`, error);
        failedCount++;
        errors.push(`Ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (successCount === 0) {
      return res.status(500).json({ 
        error: 'Failed to send any tickets',
        errors: errors
      });
    }

    const message = tickets.length === 1 
      ? 'Ticket resent successfully'
      : `${successCount} ticket(s) resent successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`;

    res.json({ 
      message: message,
      success_count: successCount,
      failed_count: failedCount,
      errors: failedCount > 0 ? errors : undefined,
      tickets: tickets.length === 1 ? { id: tickets[0].id, status: 'Ticket sent.' } : tickets.map(t => ({ id: t.id, status: 'Ticket sent.' }))
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

// Helper function to prepare branded email HTML
const prepareBrandedEmailHtml = (
  messageContent: string, 
  event: any, 
  includeBanner: boolean, 
  isTestEmail: boolean = false
): string => {
  const brandName = event.brand?.brand_name || 'Label Dashboard';
  
  if (!includeBanner || !event.brand) {
    // For non-branded emails, create a simple wrapper with footer
    const testHeader = isTestEmail ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <small style="color: #666; font-size: 11px; font-style: italic;">Test email</small>
      </div>
    ` : '';
    
    const footer = `
      <div style="border-top: 1px solid #D9D9D9; margin-top: 30px; padding-top: 20px; text-align: center;">
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; color: #666;">
          This message was sent by ${brandName}. Not sure why you are receiving this? <a href="mailto:support@melt-records.com" style="color: #1595e7; text-decoration: none;">Contact us for help</a>.
        </div>
      </div>
    `;
    
    // Apply responsive image styling to content
    const styledContent = `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5;">
        <style>
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block;
          }
          @media (max-width: 620px) {
            .email-content {
              font-size: 16px !important;
            }
          }
          @media (max-width: 520px) {
            .email-content {
              font-size: 16px !important;
            }
          }
        </style>
        <div class="email-content">
          ${testHeader}
          ${messageContent}
          ${footer}
        </div>
      </div>
    `;
    
    return styledContent;
  }

  const brandColor = event.brand.brand_color || '#1595e7';
  const brandLogo = event.brand.logo_url || '';
  
  // Use mobile-friendly div-based structure instead of complex table template
  // This matches the structure used for non-branded emails for consistent mobile behavior
  const brandedBanner = `
    <div style="background-color: ${brandColor}; padding: 20px; text-align: center; margin-bottom: 20px;">
      ${brandLogo ? `<img src="${brandLogo}" alt="${event.brand.brand_name}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
      <h2 style="color: white; margin: 0; font-family: Arial, sans-serif;">${event.title}</h2>
    </div>
  `;
  
  const footer = `
    <div style="border-top: 1px solid #D9D9D9; margin-top: 30px; padding-top: 20px; text-align: center;">
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; color: #666;">
        This message was sent by ${brandName}. Not sure why you are receiving this? <a href="mailto:support@melt-records.com" style="color: #1595e7; text-decoration: none;">Contact us for help</a>.
      </div>
    </div>
  `;
  
  const testHeader = isTestEmail ? `
    <div style="text-align: center; margin-bottom: 20px;">
      <small style="color: #666; font-size: 11px; font-style: italic;">Test email</small>
    </div>
  ` : '';
  
  // Use the same mobile-friendly structure as non-branded emails
  const styledContent = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5;">
      <style>
        img {
          max-width: 100% !important;
          height: auto !important;
          display: block;
        }
        @media (max-width: 620px) {
          .email-content {
            font-size: 16px !important;
          }
        }
        @media (max-width: 520px) {
          .email-content {
            font-size: 16px !important;
          }
        }
      </style>
      <div class="email-content">
        ${testHeader}
        ${brandedBanner}
        ${messageContent}
        ${footer}
      </div>
    </div>
  `;
  
  return styledContent;
};

// Shared function for sending event emails (both regular and test)
const sendEventEmailShared = async (
  recipients: string[],
  subject: string,
  message: string,
  event: any,
  includeBanner: boolean,
  isTestEmail: boolean,
  brandId: number
): Promise<{ successCount: number; failedCount: number }> => {
  // Add responsive image styling to message content
  const styledMessage = addResponsiveImageStyling(message);
  
  // Prepare branded email HTML using shared helper
  const htmlMessage = prepareBrandedEmailHtml(styledMessage, event, includeBanner, isTestEmail);

  let successCount = 0;
  let failedCount = 0;

  // Send email to each recipient
  for (const email of recipients) {
    try {
      const emailSubject = isTestEmail ? `[TEST] ${subject}` : subject;
      const eventContext = {
        eventTitle: event.title,
        messageContent: message, // Use original message for text version
        isTestEmail: isTestEmail
      };
      const success = await sendEmailWithInlineImages(
        [email], 
        emailSubject, 
        htmlMessage, 
        brandId, 
        undefined, // textBody
        eventContext
      );
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      console.error(`Failed to send ${isTestEmail ? 'test ' : ''}email to ${email}:`, error);
      failedCount++;
    }
  }

  return { successCount, failedCount };
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
    
    // Use shared email sending function
    const { successCount, failedCount } = await sendEventEmailShared(
      uniqueEmails,
      subject,
      message,
      event,
      include_banner,
      false, // isTestEmail = false
      req.user.brand_id
    );

    res.json({
      message: `Email sending completed. ${successCount} sent successfully, ${failedCount} failed.`,
      recipients_count: uniqueEmails.length,
      success_count: successCount,
      failed_count: failedCount,
      event_title: event.title
    });
  } catch (error) {
    console.error('Send event email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendTestEventEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event_id, subject, message, emails, include_banner = true } = req.body;

    if (!event_id || !subject || !message || !emails) {
      return res.status(400).json({ 
        error: 'Event ID, subject, message, and emails are required' 
      });
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ 
        error: 'Emails must be a non-empty array' 
      });
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
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

    if (emails.length > 10) { // Limit test emails to 10 recipients
      return res.status(400).json({ 
        error: 'Too many test recipients (maximum 10 allowed)' 
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

    // Use shared email sending function
    const { successCount, failedCount } = await sendEventEmailShared(
      emails,
      subject,
      message,
      event,
      include_banner,
      true, // isTestEmail = true
      req.user.brand_id
    );

    res.json({
      message: `Test email sending completed. ${successCount} sent successfully, ${failedCount} failed.`,
      recipients_count: emails.length,
      success_count: successCount,
      failed_count: failedCount,
      event_title: event.title
    });
  } catch (error) {
    console.error('Send test event email error:', error);
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
        'number_of_claimed_entries',
        'price_per_ticket',
        'payment_processing_fee',
        'platform_fee'
      ]
    });

    // Filter confirmed tickets (both Payment Confirmed and Ticket sent) - EXCLUDING Refunded
    const confirmedTickets = allTickets.filter(ticket =>
      ticket.status === 'Ticket sent.' || ticket.status === 'Payment Confirmed'
    );

    // Get refunded tickets (for fee calculations)
    const refundedTickets = allTickets.filter(ticket => ticket.status === 'Refunded');

    // Count only "Ticket sent." tickets for tickets sold (matching PHP logic) - EXCLUDING Refunded
    const totalTicketsSold = allTickets
      .filter(ticket => ticket.status === 'Ticket sent.')
      .reduce((sum, ticket) => sum + ticket.number_of_entries, 0);

    // Count total checked in guests from all confirmed tickets (refunded cannot be checked in)
    const totalCheckedIn = confirmedTickets.reduce((sum, ticket) => sum + (ticket.number_of_claimed_entries || 0), 0);

    // Calculate total revenue from confirmed/sent tickets ONLY (refunded tickets excluded)
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      const price = Number(ticket.price_per_ticket) || 0;
      const entries = Number(ticket.number_of_entries) || 0;
      return sum + (price * entries);
    }, 0);

    // Calculate total processing fees from confirmed/sent tickets AND refunded tickets
    const totalProcessingFee = [...confirmedTickets, ...refundedTickets].reduce((sum, ticket) => {
      return sum + (Number(ticket.payment_processing_fee) || 0);
    }, 0);

    // Calculate total platform fees from confirmed/sent tickets AND refunded tickets
    const platformFee = [...confirmedTickets, ...refundedTickets].reduce((sum, ticket) => {
      return sum + (Number(ticket.platform_fee) || 0);
    }, 0);

    // Grand total after platform fee (only from non-refunded tickets)
    const grandTotal = Number((totalRevenue - platformFee).toFixed(2)) || 0;

    // Net revenue after processing fees (only from non-refunded tickets)
    const netRevenue = Number((totalRevenue - totalProcessingFee).toFixed(2)) || 0;
    
    // Tax calculation (0.5% of net revenue)
    const tax = Number((netRevenue * 0.005).toFixed(2)) || 0;
    
    // Admin grand total after processing fees and tax
    const adminGrandTotal = Number((netRevenue * 0.995).toFixed(2)) || 0;

    res.json({
      event_id: eventIdNum,
      summary: {
        total_tickets_sold: totalTicketsSold,
        total_checked_in: totalCheckedIn,
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

export const publishEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { slug } = req.body;
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

    if (event.status === 'published') {
      return res.status(400).json({ error: 'Event is already published' });
    }

    // Generate shortlinks when publishing if they don't exist
    let updatedFields: any = { status: 'published' };
    
    if (!event.verification_link || !event.buy_shortlink) {
      // Use provided slug or generate from title
      const eventSlug = (slug && slug.trim()) ? slug.trim() : generateEventSlug(event.title);
      console.log('Publishing event with slug:', eventSlug);
      
      if (!event.verification_link) {
        console.log('Generating verification link...');
        updatedFields.verification_link = await generateVerificationLink(event.id, eventSlug, req.user.brand_id);
        console.log('Generated verification link:', updatedFields.verification_link);
      }
      
      if (!event.buy_shortlink) {
        console.log('Generating buy link...');
        updatedFields.buy_shortlink = await generateBuyLink(event.id, eventSlug, req.user.brand_id);
        console.log('Generated buy link:', updatedFields.buy_shortlink);
      }
    }

    await event.update(updatedFields);
    await event.reload(); // Reload to get the updated data

    // Reload the event with tickets to return complete data
    const eventWithTickets = await Event.findByPk(event.id, {
      include: [
        {
          model: require('../models').Ticket,
          as: 'tickets',
          attributes: ['id', 'name', 'status', 'number_of_entries']
        }
      ]
    });

    res.json({
      message: 'Event published successfully',
      event: eventWithTickets
    });
  } catch (error) {
    console.error('Publish event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unpublishEvent = async (req: AuthRequest, res: Response) => {
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

    if (event.status === 'draft') {
      return res.status(400).json({ error: 'Event is already a draft' });
    }

    // Check if there are any confirmed tickets
    const confirmedTicketsCount = await Ticket.count({
      where: {
        event_id: eventId,
        status: ['Payment Confirmed', 'Ticket sent.']
      }
    });

    if (confirmedTicketsCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot unpublish event with confirmed tickets' 
      });
    }

    await event.update({ status: 'draft' });

    // Reload the event with tickets to return complete data
    const eventWithTickets = await Event.findByPk(event.id, {
      include: [
        {
          model: require('../models').Ticket,
          as: 'tickets',
          attributes: ['id', 'name', 'status', 'number_of_entries']
        }
      ]
    });

    res.json({
      message: 'Event unpublished successfully',
      event: eventWithTickets
    });
  } catch (error) {
    console.error('Unpublish event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};