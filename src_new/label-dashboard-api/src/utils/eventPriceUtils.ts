import { TicketType } from '../models';

interface PriceDisplay {
  amount: number;
  displayText: string;
  hasMultiplePrices: boolean;
}

/**
 * Calculate the display price for an event based on its ticket types
 * @param event - Event object with ticketTypes included
 * @returns Price display information
 */
export async function getEventDisplayPrice(event: any): Promise<PriceDisplay> {
  let ticketTypes = event.ticketTypes;

  // If ticket types aren't included, fetch them
  if (!ticketTypes) {
    ticketTypes = await TicketType.findAll({
      where: { event_id: event.id }
    });
  }

  // If no ticket types found, fall back to legacy ticket_price
  if (!ticketTypes || ticketTypes.length === 0) {
    const amount = parseFloat(event.ticket_price || 0);
    return {
      amount,
      displayText: `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      hasMultiplePrices: false
    };
  }

  // Get all prices from ticket types
  const prices = ticketTypes.map((tt: any) => parseFloat(tt.price || 0));

  // Find the lowest price
  const lowestPrice = Math.min(...prices);

  // Check if there are multiple different prices
  const uniquePrices = [...new Set(prices)];
  const hasMultiplePrices = uniquePrices.length > 1;

  // Format display text
  const formattedAmount = lowestPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const displayText = hasMultiplePrices
    ? `Starts at ₱${formattedAmount}`
    : `₱${formattedAmount}`;

  return {
    amount: lowestPrice,
    displayText,
    hasMultiplePrices
  };
}

/**
 * Synchronous version for when ticket types are already loaded
 * @param event - Event object with ticketTypes already included
 * @returns Price display information
 */
export function getEventDisplayPriceSync(event: any): PriceDisplay {
  const ticketTypes = event.ticketTypes;

  // If no ticket types found, fall back to legacy ticket_price
  if (!ticketTypes || ticketTypes.length === 0) {
    const amount = parseFloat(event.ticket_price || 0);
    return {
      amount,
      displayText: `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      hasMultiplePrices: false
    };
  }

  // Get all prices from ticket types
  const prices = ticketTypes.map((tt: any) => parseFloat(tt.price || 0));

  // Find the lowest price
  const lowestPrice = Math.min(...prices);

  // Check if there are multiple different prices
  const uniquePrices = [...new Set(prices)];
  const hasMultiplePrices = uniquePrices.length > 1;

  // Format display text
  const formattedAmount = lowestPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const displayText = hasMultiplePrices
    ? `Starts at ₱${formattedAmount}`
    : `₱${formattedAmount}`;

  return {
    amount: lowestPrice,
    displayText,
    hasMultiplePrices
  };
}
