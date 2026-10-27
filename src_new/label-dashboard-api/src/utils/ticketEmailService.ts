import { sendBrandedEmail } from './emailService';
import { Ticket } from '../models';
import { QRCodeService } from './qrCodeService';

// Helper function to generate 5 random alphabet letters
const generateRandomLetters = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
};

// Helper function to generate unique ticket code for an event
export const generateUniqueTicketCode = async (eventId: number): Promise<string> => {
  let ticketCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  do {
    ticketCode = generateRandomLetters();
    
    // Check if this code already exists for this event
    const existingTicket = await Ticket.findOne({
      where: {
        event_id: eventId,
        ticket_code: ticketCode
      }
    });
    
    isUnique = !existingTicket;
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique ticket code after maximum attempts');
    }
  } while (!isUnique);

  return ticketCode;
};

// Legacy function for backward compatibility (deprecated)
export const generateTicketCode = (): string => {
  return generateRandomLetters();
};

// Send ticket email with QR code
export const sendTicketEmail = async (
  ticket: {
    email_address: string;
    name: string;
    ticket_code: string;
    number_of_entries: number;
    audience_user_id?: number | null;
    ticket_type?: {
      id: number;
      name: string;
      special_instructions?: string | null;
      days?: { date_and_time: Date | string; label?: string | null }[];
    };
  },
  event: {
    id: number;
    title: string;
    date_and_time: Date;
    venue: string;
    rsvp_link?: string;
    venue_address?: string;
    venue_latitude?: number;
    venue_longitude?: number;
    venue_maps_url?: string;
    days?: { date_and_time: Date | string; label?: string | null }[];
  },
  brand: {
    brand_name?: string;
  },
  brandId: number
): Promise<boolean> => {
  try {
    // Get or create QR code from S3
    const qrCodeUrl = await QRCodeService.getOrCreateQRCodeUrl(event.id, ticket.ticket_code);

    const eventDays = event.days || [];
    const isMultiday = eventDays.length > 1;

    const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila'
    });
    const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila'
    });

    // Format event date and time in Philippine timezone
    const eventDate = new Date(event.date_and_time);
    const formattedDate = fmtDate(eventDate);
    const formattedTime = fmtTime(eventDate);

    // Generate Google Calendar "Add to Calendar" link
    const formatGoogleCalendarDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const calendarStart = formatGoogleCalendarDate(eventDate);
    const calendarEnd = formatGoogleCalendarDate(new Date(eventDate.getTime() + 2 * 60 * 60 * 1000));
    const calendarLocation = event.venue_address
      ? `${event.venue}, ${event.venue_address}`
      : event.venue;
    const addToCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${calendarStart}/${calendarEnd}&location=${encodeURIComponent(calendarLocation)}`;

    // Generate Google Maps link only if specific location data is available
    let mapsLink = '';
    if (event.venue_maps_url && event.venue_maps_url.trim()) {
      mapsLink = event.venue_maps_url;
    } else if (event.venue_latitude && event.venue_longitude) {
      mapsLink = `https://www.google.com/maps?q=${event.venue_latitude},${event.venue_longitude}`;
    } else if (event.venue_address && event.venue_address.trim()) {
      mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`;
    }

    // Prepare template data with conditional sections
    const templateData: any = {
      name: ticket.name,
      event_name: event.title,
      event_date: formattedDate,
      event_time: formattedTime,
      event_venue: event.venue,
      event_venue_address: event.venue_address || '',
      event_maps_link: mapsLink,
      qr_code: qrCodeUrl,
      ticket_code: ticket.ticket_code,
      no_of_entries: ticket.number_of_entries,
      add_to_calendar_link: addToCalendarLink,
      rsvp_link: event.rsvp_link || '',
      brand_name: brand.brand_name || 'Melt Records',
      ticket_type_name: ticket.ticket_type?.name || 'Regular'
    };

    // Multiday: build event days HTML and valid dates text
    if (isMultiday) {
      const sortedDays = [...eventDays].sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime());
      const daysHtml = sortedDays.map((day, i) => {
        const label = day.label ? ` (${day.label})` : ` (Day ${i + 1})`;
        return `<div style="margin-bottom: 4px; padding-left: 12px;">${fmtDate(day.date_and_time)}, ${fmtTime(day.date_and_time)}${label}</div>`;
      }).join('');
      templateData.event_days_html = daysHtml;

      templateData.show_single_date = '<!--';
      templateData['/show_single_date'] = '-->';
      templateData.show_multi_date = '';
      templateData['/show_multi_date'] = '';

      // Valid dates below ticket code
      const ticketDays: { date_and_time: Date | string; label?: string | null }[] = ticket.ticket_type?.days || [];
      const validDaysSource = ticketDays.length > 0
        ? [...ticketDays].sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime())
        : sortedDays;

      if (ticketDays.length > 0) {
        templateData.valid_dates_text = `Valid on: ${validDaysSource.map((d, i) => {
          const dayIdx = sortedDays.findIndex(sd =>
            Math.floor(new Date(sd.date_and_time).getTime() / 1000) === Math.floor(new Date(d.date_and_time).getTime() / 1000)
          );
          const lbl = d.label ? ` (${d.label})` : ` (Day ${dayIdx >= 0 ? dayIdx + 1 : '?'})`;
          return fmtDate(d.date_and_time) + lbl;
        }).join(', ')}`;
      } else {
        templateData.valid_dates_text = 'Valid on all days';
      }
      templateData.show_valid_dates = '';
      templateData['/show_valid_dates'] = '';
    } else {
      templateData.event_days_html = '';
      templateData.show_single_date = '';
      templateData['/show_single_date'] = '';
      templateData.show_multi_date = '<!--';
      templateData['/show_multi_date'] = '-->';
      templateData.valid_dates_text = '';
      templateData.show_valid_dates = '<!--';
      templateData['/show_valid_dates'] = '-->';
    }

    // Add conditional special instructions section
    const specialInstructions = ticket.ticket_type?.special_instructions;
    if (specialInstructions && specialInstructions.trim()) {
      templateData.show_special_instructions = '';
      templateData['/show_special_instructions'] = '';
      templateData.special_instructions_ticket_type = ticket.ticket_type?.name || 'Regular';
      templateData.special_instructions_text = specialInstructions.trim();
    } else {
      templateData.show_special_instructions = '<!--';
      templateData['/show_special_instructions'] = '-->';
      templateData.special_instructions_ticket_type = '';
      templateData.special_instructions_text = '';
    }

    // Add conditional Your Scene account section
    if (ticket.audience_user_id) {
      templateData.show_your_scene_account = '';
      templateData['/show_your_scene_account'] = '';
      templateData.audience_app_url = `${process.env.AUDIENCE_APP_URL || ''}/my-shows`;
      templateData.show_register_your_scene = '<!--';
      templateData['/show_register_your_scene'] = '-->';
      templateData.audience_register_url = '';
    } else {
      templateData.show_your_scene_account = '<!--';
      templateData['/show_your_scene_account'] = '-->';
      templateData.audience_app_url = '';
      templateData.show_register_your_scene = '';
      templateData['/show_register_your_scene'] = '';
      templateData.audience_register_url = `${process.env.AUDIENCE_APP_URL || ''}/login?mode=audience`;
    }

    // Add conditional sections
    if (event.venue_address && event.venue_address.trim()) {
      templateData.show_address = '';
      templateData['/show_address'] = '';
    } else {
      templateData.show_address = '<!--';
      templateData['/show_address'] = '-->';
    }

    if (mapsLink && mapsLink.trim()) {
      templateData.show_maps_link = '';
      templateData['/show_maps_link'] = '';
    } else {
      templateData.show_maps_link = '<!--';
      templateData['/show_maps_link'] = '-->';
    }

    await sendBrandedEmail(
      ticket.email_address,
      'event_ticket_email',
      templateData,
      brandId
    );

    return true;
  } catch (error) {
    console.error('Failed to send ticket email:', error);
    return false;
  }
};

// Send ticket cancellation email
export const sendTicketCancellationEmail = async (
  ticket: {
    email_address: string;
    name: string;
    ticket_code: string;
  },
  event: {
    title: string;
  },
  brand: {
    brand_name?: string;
  },
  brandId: number
): Promise<boolean> => {
  try {
    await sendBrandedEmail(
      ticket.email_address,
      'event_ticket_canceled_email',
      {
        name: ticket.name,
        event_name: event.title,
        ticket_code: ticket.ticket_code,
        brand_name: brand.brand_name || 'Melt Records'
      },
      brandId
    );

    return true;
  } catch (error) {
    console.error('Failed to send ticket cancellation email:', error);
    return false;
  }
};

// Send payment link email for new tickets
export const sendPaymentLinkEmail = async (
  ticket: {
    email_address: string;
    name: string;
    ticket_code: string;
    number_of_entries: number;
    price_per_ticket: number;
    payment_processing_fee: number;
    ticket_type?: {
      id: number;
      name: string;
    };
  },
  event: {
    title: string;
    date_and_time: Date;
    venue: string;
  },
  paymentUrl: string,
  brand: {
    brand_name?: string;
  },
  brandId: number
): Promise<boolean> => {
  try {
    const totalAmount = ticket.price_per_ticket * ticket.number_of_entries;
    const ticketTypeName = ticket.ticket_type?.name || 'Regular';

    await sendBrandedEmail(
      ticket.email_address,
      'event_ticket_payment_link',
      {
        name: ticket.name,
        event_name: event.title,
        no_of_entries: ticket.number_of_entries,
        ticket_type_name: ticketTypeName,
        payment_amount: (totalAmount + ticket.payment_processing_fee).toFixed(2),
        payment_link: paymentUrl,
        brand_name: brand.brand_name || 'Melt Records'
      },
      brandId
    );

    return true;
  } catch (error) {
    console.error('Failed to send payment link email:', error);
    return false;
  }
};

// Send payment confirmation email
export const sendPaymentConfirmationEmail = async (
  ticket: {
    email_address: string;
    name: string;
    ticket_code: string;
  },
  event: {
    title: string;
  },
  brand: {
    brand_name?: string;
  },
  brandId: number
): Promise<boolean> => {
  try {
    await sendBrandedEmail(
      ticket.email_address,
      'payment_confirmed',
      {
        name: ticket.name,
        event_name: event.title,
        ticket_code: ticket.ticket_code,
        brand_name: brand.brand_name || 'Melt Records'
      },
      brandId
    );

    return true;
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    return false;
  }
};

// Delete QR code from S3 when ticket is canceled
export const deleteTicketQRCode = async (
  eventId: number,
  ticketCode: string
): Promise<boolean> => {
  try {
    return await QRCodeService.deleteQRCode(eventId, ticketCode);
  } catch (error) {
    console.error('Failed to delete QR code:', error);
    return false;
  }
};