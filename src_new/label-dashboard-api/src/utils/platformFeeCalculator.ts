import { Brand, Release, RecuperableExpense, Royalty } from '../models';

export interface PlatformFeeCalculation {
  fixedFee: number;
  percentageFee: number;
  totalPlatformFee: number;
}

/**
 * Calculate platform fee for a music earning based on brand fee settings
 * @param brandId - The brand ID
 * @param grossAmount - The gross earning amount
 * @param netRevenue - The net revenue after recuperable expenses and royalties
 * @returns Platform fee calculation breakdown
 */
export async function calculatePlatformFeeForMusicEarnings(
  brandId: number,
  grossAmount: number,
  netRevenue: number
): Promise<PlatformFeeCalculation> {
  // Get brand fee settings
  const brand = await Brand.findByPk(brandId);
  
  if (!brand) {
    throw new Error('Brand not found');
  }

  let fixedFee = 0;
  let percentageFee = 0;

  // 1. Fixed fee per transaction
  if (brand.music_transaction_fixed_fee && brand.music_transaction_fixed_fee > 0) {
    fixedFee = brand.music_transaction_fixed_fee;
  }

  // 2. Percentage fee calculation
  if (brand.music_revenue_percentage_fee && brand.music_revenue_percentage_fee > 0) {
    if (brand.music_fee_revenue_type === 'gross') {
      // Apply percentage to gross earning amount
      percentageFee = (grossAmount * brand.music_revenue_percentage_fee) / 100;
    } else if (brand.music_fee_revenue_type === 'net') {
      // Apply percentage to net revenue
      percentageFee = (netRevenue * brand.music_revenue_percentage_fee) / 100;
    }
  }

  const totalPlatformFee = parseFloat((fixedFee + percentageFee).toFixed(2));

  return {
    fixedFee: parseFloat(fixedFee.toFixed(2)),
    percentageFee: parseFloat(percentageFee.toFixed(2)),
    totalPlatformFee
  };
}

/**
 * Calculate platform fee for an event ticket based on brand fee settings
 * @param brandId - The brand ID
 * @param pricePerTicket - The price per ticket
 * @param numberOfEntries - The number of entries (tickets purchased)
 * @param paymentProcessingFee - The payment processing fee already charged
 * @returns Platform fee calculation breakdown
 */
export async function calculatePlatformFeeForEventTickets(
  brandId: number,
  pricePerTicket: number,
  numberOfEntries: number,
  paymentProcessingFee: number = 0
): Promise<PlatformFeeCalculation> {
  // Get brand fee settings
  const brand = await Brand.findByPk(brandId);
  
  if (!brand) {
    throw new Error('Brand not found');
  }

  let fixedFee = 0;
  let percentageFee = 0;

  // Calculate gross revenue (price of tickets times number of entries)
  const grossRevenue = pricePerTicket * numberOfEntries;
  
  // Calculate net revenue (gross minus processing fees, then subtract 0.5%)
  const afterProcessingFees = grossRevenue - paymentProcessingFee;
  const netRevenue = afterProcessingFees - (afterProcessingFees * 0.005); // Subtract 0.5%

  // 1. Fixed fee per transaction
  if (brand.event_transaction_fixed_fee && brand.event_transaction_fixed_fee > 0) {
    fixedFee = brand.event_transaction_fixed_fee;
  }

  // 2. Percentage fee calculation
  if (brand.event_revenue_percentage_fee && brand.event_revenue_percentage_fee > 0) {
    if (brand.event_fee_revenue_type === 'gross') {
      // Apply percentage to gross revenue
      percentageFee = (grossRevenue * brand.event_revenue_percentage_fee) / 100;
    } else if (brand.event_fee_revenue_type === 'net') {
      // Apply percentage to net revenue
      percentageFee = (netRevenue * brand.event_revenue_percentage_fee) / 100;
    }
  }

  const totalPlatformFee = parseFloat((fixedFee + percentageFee).toFixed(2));

  return {
    fixedFee: parseFloat(fixedFee.toFixed(2)),
    percentageFee: parseFloat(percentageFee.toFixed(2)),
    totalPlatformFee
  };
}

