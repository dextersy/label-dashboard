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
  },
  event: {
    id: number;
    title: string;
    date_and_time: Date;
    venue: string;
    rsvp_link?: string;
  },
  brand: {
    brand_name?: string;
  },
  brandId: number
): Promise<boolean> => {
  try {
    // Get or create QR code from S3
    const qrCodeUrl = await QRCodeService.getOrCreateQRCodeUrl(event.id, ticket.ticket_code);

    await sendBrandedEmail(
      ticket.email_address,
      'event_ticket_email',
      {
        name: ticket.name,
        event_name: event.title,
        qr_code: qrCodeUrl,
        ticket_code: ticket.ticket_code,
        no_of_entries: ticket.number_of_entries,
        rsvp_link: event.rsvp_link || '',
        brand_name: brand.brand_name || 'Melt Records'
      },
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

    await sendBrandedEmail(
      ticket.email_address,
      'event_ticket_payment_link',
      {
        name: ticket.name,
        event_name: event.title,
        no_of_entries: ticket.number_of_entries,
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