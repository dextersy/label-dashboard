import { Request, Response } from 'express';
import { Artist, Brand, Royalty, Payment, PaymentMethod } from '../models';
import { auditLogger } from '../utils/auditLogger';
import { PaymentService } from '../utils/paymentService';

/**
 * System Controller
 *
 * Handles cross-brand data access for system users.
 * All endpoints return brand context for each record.
 *
 * Security: All methods assume authentication has been verified by middleware
 */

/**
 * Get artists due for payment (cross-brand)
 *
 * Returns ALL artists with pending balances across ALL brands.
 * Used by automated payment jobs.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (max: 100, default: 50)
 * - min_balance: Filter artists with balance >= this amount (default: 0)
 */
export const getArtistsDuePayment = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
    const offset = (page - 1) * limit;

    // Optional filter for minimum balance
    const minBalance = parseFloat(req.query.min_balance as string) || 0;

    // Query ALL artists across ALL brands (no brand_id filter)
    const { count, rows: artists } = await Artist.findAndCountAll({
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name'],
          required: true // Ensure artist has a valid brand
        }
      ],
      limit,
      offset,
      order: [['brand_id', 'ASC'], ['name', 'ASC']] // Order by brand first, then artist name
    });

    // Calculate balances and filter by payment readiness
    const artistsWithBalance = await Promise.all(
      artists.map(async (artist) => {
        // Calculate total royalties (earnings)
        const totalRoyalties = await Royalty.sum('amount', {
          where: {
            artist_id: artist.id
          }
        }) || 0;

        // Calculate total payments made
        const totalPayments = await Payment.sum('amount', {
          where: {
            artist_id: artist.id
          }
        }) || 0;

        // Calculate pending balance
        const balance = totalRoyalties - totalPayments;

        // Check if artist has payment methods
        const paymentMethods = await PaymentMethod.findAll({
          where: { artist_id: artist.id }
        });

        // Artist is ready for payment if:
        // 1. balance > payout_point (not >=, must exceed)
        // 2. has at least one payment method
        // 3. hold_payouts = false (already filtered in query)
        const isReadyForPayment = balance > artist.payout_point && paymentMethods.length > 0;

        return {
          artist_id: artist.id,
          artist_name: artist.name,
          brand_id: artist.brand_id,
          brand_name: artist.brand?.brand_name,
          balance: parseFloat(balance.toFixed(2)),
          total_royalties: parseFloat(totalRoyalties.toFixed(2)),
          total_payments: parseFloat(totalPayments.toFixed(2)),
          payout_point: artist.payout_point,
          hold_payouts: artist.hold_payouts,
          has_payment_method: paymentMethods.length > 0,
          is_ready_for_payment: isReadyForPayment,
          last_updated: artist.updatedAt
        };
      })
    );

    // Filter by:
    // 1. Minimum balance
    // 2. Must be ready for payment (balance > payout_point AND has payment method)
    const filteredArtists = artistsWithBalance.filter(
      a => a.balance >= minBalance && a.is_ready_for_payment
    );

    // Log data access
    auditLogger.logDataAccess(req, 'artists-due-payment', 'READ', filteredArtists.length, {
      page,
      limit,
      minBalance,
      totalArtists: count
    });

    res.json({
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      results: filteredArtists,
      filters: {
        min_balance: minBalance
      }
    });

  } catch (error) {
    console.error('Error fetching artists due payment:', error);
    auditLogger.logSystemAccess(req, 'ERROR_ARTISTS_DUE_PAYMENT', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get wallet balances for all brands (cross-brand)
 *
 * Returns Paymongo wallet balances for all brands that have wallets configured.
 * Used by automated payment jobs to check if sufficient funds are available.
 */
export const getWalletBalances = async (req: Request, res: Response) => {
  try {
    // Get all brands with wallet IDs
    const brands = await Brand.findAll({
      where: {
        paymongo_wallet_id: {
          [require('sequelize').Op.not]: null
        }
      },
      attributes: ['id', 'brand_name', 'paymongo_wallet_id']
    });

    const paymentService = new PaymentService();

    // Fetch wallet balance for each brand
    const walletBalances = await Promise.all(
      brands.map(async (brand) => {
        const balance = await paymentService.getWalletBalance(brand.paymongo_wallet_id!);

        return {
          brand_id: brand.id,
          brand_name: brand.brand_name,
          wallet_id: brand.paymongo_wallet_id,
          available_balance: balance,
          currency: 'PHP'
        };
      })
    );

    // Calculate total across all brands
    const totalBalance = walletBalances.reduce((sum, wallet) => {
      return sum + (wallet.available_balance > 0 ? wallet.available_balance : 0);
    }, 0);

    // Log data access
    auditLogger.logDataAccess(req, 'wallet-balances', 'READ', walletBalances.length, {
      brandCount: brands.length,
      totalBalance
    });

    res.json({
      total_brands: brands.length,
      total_balance: parseFloat(totalBalance.toFixed(2)),
      wallets: walletBalances.map(w => ({
        ...w,
        available_balance: w.available_balance > 0 ? parseFloat(w.available_balance.toFixed(2)) : 0
      })),
      currency: 'PHP'
    });

  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    auditLogger.logSystemAccess(req, 'ERROR_WALLET_BALANCES', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

