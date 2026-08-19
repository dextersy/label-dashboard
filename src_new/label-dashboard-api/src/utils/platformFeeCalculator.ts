import { Brand } from '../models';
import BrandPlan from '../models/BrandPlan';
import Plan from '../models/Plan';

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
  const brand = await Brand.findByPk(brandId);

  if (!brand) {
    throw new Error('Brand not found');
  }

  let fixedFee = 0;
  let percentageFee = 0;

  if (brand.music_transaction_fixed_fee && brand.music_transaction_fixed_fee > 0) {
    fixedFee = brand.music_transaction_fixed_fee;
  }

  if (brand.music_revenue_percentage_fee && brand.music_revenue_percentage_fee > 0) {
    if (brand.music_fee_revenue_type === 'gross') {
      percentageFee = (grossAmount * brand.music_revenue_percentage_fee) / 100;
    } else if (brand.music_fee_revenue_type === 'net') {
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
 * Resolve effective event fee settings for a brand.
 * Brand-level values act as overrides; NULL means fall back to the plan's default.
 */
async function resolveEventFeeSettings(brandId: number): Promise<{
  transactionFixedFee: number;
  revenuePercentageFee: number;
  feeRevenueType: 'net' | 'gross';
}> {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error('Brand not found');

  // If the brand has explicit fee values set, use them directly
  if (brand.event_transaction_fixed_fee !== null || brand.event_revenue_percentage_fee !== null) {
    return {
      transactionFixedFee: brand.event_transaction_fixed_fee ?? 0,
      revenuePercentageFee: brand.event_revenue_percentage_fee ?? 0,
      feeRevenueType: brand.event_fee_revenue_type ?? 'net',
    };
  }

  // Fall back to plan defaults
  const brandPlan = await BrandPlan.findOne({
    where: { brand_id: brandId },
    include: [{ model: Plan, as: 'plan' }],
  });
  const plan = brandPlan?.plan;

  return {
    transactionFixedFee: plan?.default_event_transaction_fixed_fee ?? 0,
    revenuePercentageFee: plan?.default_event_revenue_percentage_fee ?? 0,
    feeRevenueType: plan?.default_event_fee_revenue_type ?? 'net',
  };
}

/**
 * Resolve effective fundraiser fee settings for a brand.
 * Brand-level values act as overrides; NULL means fall back to the plan's default.
 */
async function resolveFundraiserFeeSettings(brandId: number): Promise<{
  transactionFixedFee: number;
  revenuePercentageFee: number;
  feeRevenueType: 'net' | 'gross';
}> {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error('Brand not found');

  // If the brand has explicit fee values set, use them directly
  if (brand.fundraiser_transaction_fixed_fee !== null || brand.fundraiser_revenue_percentage_fee !== null) {
    return {
      transactionFixedFee: brand.fundraiser_transaction_fixed_fee ?? 0,
      revenuePercentageFee: brand.fundraiser_revenue_percentage_fee ?? 0,
      feeRevenueType: brand.fundraiser_fee_revenue_type ?? 'net',
    };
  }

  // Fall back to plan defaults
  const brandPlan = await BrandPlan.findOne({
    where: { brand_id: brandId },
    include: [{ model: Plan, as: 'plan' }],
  });
  const plan = brandPlan?.plan;

  return {
    transactionFixedFee: plan?.default_fundraiser_transaction_fixed_fee ?? 0,
    revenuePercentageFee: plan?.default_fundraiser_revenue_percentage_fee ?? 0,
    feeRevenueType: plan?.default_fundraiser_fee_revenue_type ?? 'net',
  };
}

/**
 * Calculate platform fee for an event ticket.
 * Uses the brand-level fee override if set, otherwise falls back to the plan's default fee.
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
  const { transactionFixedFee, revenuePercentageFee, feeRevenueType } =
    await resolveEventFeeSettings(brandId);

  let fixedFee = 0;
  let percentageFee = 0;

  const grossRevenue = pricePerTicket * numberOfEntries;
  const afterProcessingFees = grossRevenue - paymentProcessingFee;
  const tax = afterProcessingFees * 0.005; // 0.5% tax
  const netRevenue = afterProcessingFees - tax;

  if (transactionFixedFee > 0) {
    fixedFee = transactionFixedFee;
  }

  if (revenuePercentageFee > 0) {
    if (feeRevenueType === 'gross') {
      percentageFee = (grossRevenue * revenuePercentageFee) / 100;
    } else if (feeRevenueType === 'net') {
      percentageFee = (netRevenue * revenuePercentageFee) / 100;
    }
  } else {
    // Special case: When fee is 0%, platform fee depends on revenue type
    if (feeRevenueType === 'net') {
      // For net revenue with 0% fee: platform fee = processing fee + tax
      percentageFee = paymentProcessingFee + tax;
    } else if (feeRevenueType === 'gross') {
      // For gross revenue with 0% fee: platform fee = 0
      percentageFee = 0;
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
 * Calculate platform fee for a fundraiser donation.
 * Uses the brand-level fee override if set, otherwise falls back to the plan's default fee.
 * @param brandId - The brand ID
 * @param donationAmount - The donation amount
 * @param paymentProcessingFee - The payment processing fee already charged
 * @returns Platform fee calculation breakdown
 */
export async function calculatePlatformFeeForFundraiserDonation(
  brandId: number,
  donationAmount: number,
  paymentProcessingFee: number = 0
): Promise<PlatformFeeCalculation> {
  const { transactionFixedFee, revenuePercentageFee, feeRevenueType } =
    await resolveFundraiserFeeSettings(brandId);

  let fixedFee = 0;
  let percentageFee = 0;

  const grossRevenue = donationAmount;
  const netRevenue = grossRevenue - paymentProcessingFee;

  if (transactionFixedFee > 0) {
    fixedFee = transactionFixedFee;
  }

  if (revenuePercentageFee > 0) {
    if (feeRevenueType === 'gross') {
      percentageFee = (grossRevenue * revenuePercentageFee) / 100;
    } else if (feeRevenueType === 'net') {
      percentageFee = (netRevenue * revenuePercentageFee) / 100;
    }
  }
  // When percentage fee is 0%, percentageFee stays 0

  const totalPlatformFee = parseFloat((fixedFee + percentageFee).toFixed(2));

  return {
    fixedFee: parseFloat(fixedFee.toFixed(2)),
    percentageFee: parseFloat(percentageFee.toFixed(2)),
    totalPlatformFee
  };
}
