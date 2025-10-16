import { Request, Response } from 'express';
import { Artist, Brand, Royalty, Payment, PaymentMethod, ArtistImage, ArtistDocument, Event, Release, Earning, Ticket, LabelPayment, LabelPaymentMethod } from '../models';
import { auditLogger } from '../utils/auditLogger';
import { PaymentService } from '../utils/paymentService';
import { Op, literal } from 'sequelize';

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

/**
 * Get all S3 URLs/paths used in the database (cross-brand)
 *
 * Returns all file URLs and paths stored in the database across ALL brands.
 * Used by S3 cleanup jobs to identify which files are still in use.
 */
export const getUsedS3Urls = async (req: Request, res: Response) => {
  try {
    console.log('Fetching all used S3 URLs from database...');

    const allUrls: Set<string> = new Set();

    // 1. Brand URLs (logo_url, favicon_url, release_submission_url)
    const brands = await Brand.findAll({
      attributes: ['id', 'brand_name', 'logo_url', 'favicon_url', 'release_submission_url']
    });

    brands.forEach(brand => {
      if (brand.logo_url) allUrls.add(brand.logo_url);
      if (brand.favicon_url) allUrls.add(brand.favicon_url);
      if (brand.release_submission_url) allUrls.add(brand.release_submission_url);
    });

    // 2. Event URLs (poster_url, venue_maps_url)
    const events = await Event.findAll({
      attributes: ['id', 'title', 'poster_url', 'venue_maps_url', 'brand_id']
    });

    events.forEach(event => {
      if (event.poster_url) allUrls.add(event.poster_url);
      if (event.venue_maps_url) allUrls.add(event.venue_maps_url);
    });

    // 3. Artist URLs (website_page_url)
    const artists = await Artist.findAll({
      attributes: ['id', 'name', 'website_page_url', 'brand_id']
    });

    artists.forEach(artist => {
      if (artist.website_page_url) allUrls.add(artist.website_page_url);
    });

    // 4. Artist Images (path)
    const artistImages = await ArtistImage.findAll({
      attributes: ['id', 'path', 'artist_id']
    });

    artistImages.forEach(image => {
      if (image.path) allUrls.add(image.path);
    });

    // 5. Artist Documents (path)
    const artistDocuments = await ArtistDocument.findAll({
      attributes: ['id', 'path', 'artist_id']
    });

    artistDocuments.forEach(doc => {
      if (doc.path) allUrls.add(doc.path);
    });

    // 6. Release URLs (cover_art)
    const releases = await Release.findAll({
      attributes: ['id', 'catalog_no', 'cover_art', 'brand_id']
    });

    releases.forEach(release => {
      if (release.cover_art) allUrls.add(release.cover_art);
    });

    // Convert Set to Array and filter out empty/null values
    const urlsArray = Array.from(allUrls).filter(url => url && url.trim().length > 0);

    console.log(`Found ${urlsArray.length} unique URLs/paths in use across all brands`);

    // Log data access
    auditLogger.logDataAccess(req, 's3-used-urls', 'READ', urlsArray.length, {
      brandCount: brands.length,
      eventCount: events.length,
      artistCount: artists.length,
      imageCount: artistImages.length,
      documentCount: artistDocuments.length,
      releaseCount: releases.length
    });

    res.json({
      total_urls: urlsArray.length,
      urls: urlsArray,
      breakdown: {
        brands: brands.length,
        events: events.length,
        artists: artists.length,
        artist_images: artistImages.length,
        artist_documents: artistDocuments.length,
        releases: releases.length
      }
    });

  } catch (error) {
    console.error('Error fetching used S3 URLs:', error);
    auditLogger.logSystemAccess(req, 'ERROR_S3_USED_URLS', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get sublabels due for payment (cross-brand)
 *
 * Returns ALL sublabels (brands with parent_brand) with pending balances across ALL parent brands.
 * Used by automated payment jobs.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (max: 100, default: 50)
 * - min_balance: Filter sublabels with balance >= this amount (default: 0)
 */
export const getSublabelsDuePayment = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
    const offset = (page - 1) * limit;

    // Optional filter for minimum balance
    const minBalance = parseFloat(req.query.min_balance as string) || 0;

    // Query ALL sublabels (brands that have a parent_brand)
    const { count, rows: sublabels } = await Brand.findAndCountAll({
      where: {
        parent_brand: {
          [Op.not]: null
        }
      },
      include: [
        {
          model: Brand,
          as: 'parentBrand',
          attributes: ['id', 'brand_name'],
          required: true
        }
      ],
      limit,
      offset,
      order: [['parent_brand', 'ASC'], ['brand_name', 'ASC']]
    });

    // Calculate balances for each sublabel
    const sublabelsWithBalance = await Promise.all(
      sublabels.map(async (sublabel) => {
        let musicEarnings = 0;
        let musicGrossEarnings = 0;
        let eventEarnings = 0;
        let eventSales = 0;
        let totalRoyalties = 0;

        // Calculate total payments made to this sublabel from label_payment table
        const payments = await LabelPayment.sum('amount', {
          where: {
            brand_id: sublabel.id
          }
        }) || 0;

        // Get all release IDs for this sublabel
        const releaseIds = await Release.findAll({
          where: { brand_id: sublabel.id },
          attributes: ['id'],
          raw: true
        });

        const releaseIdList = releaseIds.map(r => (r as any).id);

        let musicPlatformFees = 0;
        if (releaseIdList.length > 0) {
          // Calculate music earnings
          const totalEarnings = await Earning.sum('amount', {
            where: {
              release_id: { [Op.in]: releaseIdList }
            }
          });

          totalRoyalties = await Royalty.sum('amount', {
            where: {
              release_id: { [Op.in]: releaseIdList }
            }
          }) || 0;

          const totalPlatformFees = await Earning.sum('platform_fee', {
            where: {
              release_id: { [Op.in]: releaseIdList }
            }
          });

          musicGrossEarnings = totalEarnings || 0;
          musicEarnings = musicGrossEarnings - totalRoyalties - (totalPlatformFees || 0);
          musicPlatformFees = totalPlatformFees || 0;
        }

        // Calculate event sales and earnings (ticket sales minus platform fees)
        const eventSalesQuery = await Ticket.findAll({
          attributes: [
            [literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales']
          ],
          include: [{
            model: Event,
            as: 'event',
            where: { brand_id: sublabel.id },
            attributes: []
          }],
          where: {
            status: ['Payment Confirmed', 'Ticket sent.'],
            platform_fee: { [Op.not]: null }
          },
          raw: true
        });

        const eventFeesQuery = await Ticket.findAll({
          attributes: [
            [literal('SUM(platform_fee)'), 'total_platform_fee']
          ],
          include: [{
            model: Event,
            as: 'event',
            where: { brand_id: sublabel.id },
            attributes: []
          }],
          where: {
            status: ['Payment Confirmed', 'Ticket sent.', 'Refunded'],
            platform_fee: { [Op.not]: null }
          },
          raw: true
        });

        let eventPlatformFees = 0;
        if (eventSalesQuery.length > 0 && eventSalesQuery[0]) {
          const salesData = eventSalesQuery[0] as any;
          eventSales = parseFloat(salesData.total_sales) || 0;
        }

        if (eventFeesQuery.length > 0 && eventFeesQuery[0]) {
          const feesData = eventFeesQuery[0] as any;
          eventPlatformFees = parseFloat(feesData.total_platform_fee) || 0;
        }

        eventEarnings = eventSales - eventPlatformFees;

        // Calculate balance
        const balance = musicEarnings + eventEarnings - payments;

        // Check if sublabel has payment methods configured
        // The sublabel needs payment methods so the parent brand knows where to send money
        const paymentMethods = await LabelPaymentMethod.findAll({
          where: { brand_id: sublabel.id }
        });

        // Sublabel is ready for payment if:
        // 1. balance > 0 (has positive balance)
        // 2. sublabel has at least one payment method configured (so parent knows where to send money)
        const isReadyForPayment = balance > 0 && paymentMethods.length > 0;

        return {
          sublabel_id: sublabel.id,
          sublabel_name: sublabel.brand_name,
          parent_brand_id: sublabel.parent_brand,
          parent_brand_name: sublabel.parentBrand?.brand_name,
          balance: parseFloat(balance.toFixed(2)),
          music_earnings: parseFloat(musicEarnings.toFixed(2)),
          music_gross_earnings: parseFloat(musicGrossEarnings.toFixed(2)),
          event_earnings: parseFloat(eventEarnings.toFixed(2)),
          event_sales: parseFloat(eventSales.toFixed(2)),
          total_royalties: parseFloat(totalRoyalties.toFixed(2)),
          platform_fees: parseFloat((musicPlatformFees + eventPlatformFees).toFixed(2)),
          payments: parseFloat(payments.toFixed(2)),
          has_payment_method: paymentMethods.length > 0,
          is_ready_for_payment: isReadyForPayment,
          last_updated: sublabel.updatedAt
        };
      })
    );

    // Filter by:
    // 1. Minimum balance
    // 2. Must be ready for payment (balance > 0 AND parent has payment method)
    const filteredSublabels = sublabelsWithBalance.filter(
      s => s.balance >= minBalance && s.is_ready_for_payment
    );

    // Log data access
    auditLogger.logDataAccess(req, 'sublabels-due-payment', 'READ', filteredSublabels.length, {
      page,
      limit,
      minBalance,
      totalSublabels: count
    });

    res.json({
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      results: filteredSublabels,
      filters: {
        min_balance: minBalance
      }
    });

  } catch (error) {
    console.error('Error fetching sublabels due payment:', error);
    auditLogger.logSystemAccess(req, 'ERROR_SUBLABELS_DUE_PAYMENT', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

