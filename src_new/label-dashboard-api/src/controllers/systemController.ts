import { Request, Response } from 'express';
import { Artist, Brand, Royalty, Payment, PaymentMethod, ArtistImage, ArtistDocument, Event, Release, Earning, Ticket, LabelPayment, LabelPaymentMethod, Song, SongAuthor, SongComposer, ReleaseArtist, ReleaseSong, Fundraiser, PressCampaign, PressCampaignArtistPhoto, WristbandOrder, AudienceUser, User } from '../models';
import ReleaseTask from '../models/ReleaseTask';
import { auditLogger } from '../utils/auditLogger';
import { PaymentService } from '../utils/paymentService';
import { createNotificationsForUsers } from '../utils/notificationService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { Op, literal } from 'sequelize';
import { sequelize } from '../config/database';

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
    // Returns all brands with artist payable balances. Each brand includes its own
    // direct artists plus any sublabel artists, scoped to amounts owed by that brand.
    // Parent brands and sublabels are each processed independently.
    const brands = await Brand.findAll({
      attributes: ['id', 'brand_name', 'logo_url', 'send_artist_balance_reminders'],
    });

    const results = await Promise.all(brands.map(async (brand) => {
      const sublabels = await Brand.findAll({
        where: { parent_brand: brand.id },
        attributes: ['id', 'brand_name'],
      });
      const brandIdScope = [brand.id, ...sublabels.map(s => s.id)];
      const sublabelNameById = new Map(sublabels.map(s => [s.id, s.brand_name]));

      const artists = await Artist.findAll({
        where: { brand_id: { [Op.in]: brandIdScope } },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'brand_id', 'payout_point', 'hold_payouts'],
      });

      if (artists.length === 0) {
        const adminUsers = await User.findAll({
          where: { brand_id: brand.id, is_admin: true },
          attributes: ['email_address'],
        });
        return {
          brand_id: brand.id,
          brand_name: brand.brand_name,
          logo_url: brand.logo_url ?? null,
          send_artist_balance_reminders: brand.send_artist_balance_reminders ?? false,
          admin_emails: adminUsers.map(u => (u as any).email_address).filter(Boolean),
          artists: [],
          total_payable: 0,
        };
      }

      const artistIds = artists.map(a => a.id);
      const ownArtistIds = artists.filter(a => a.brand_id === brand.id).map(a => a.id);
      const sublabelArtistIds = artists.filter(a => a.brand_id !== brand.id).map(a => a.id);

      // Royalties split by artist group to match the dashboard's balance view:
      // - Own-brand artists: royalties from earnings recorded by this brand (recorded_by_brand_id IS NULL)
      // - Sublabel artists: royalties from earnings recorded by the parent brand (recorded_by_brand_id IS NOT NULL)
      const allRoyaltyRows: any[] = [];
      if (ownArtistIds.length > 0) {
        const ownRoyaltyRows: any[] = await sequelize.query(
          `SELECT r.artist_id, COALESCE(SUM(r.amount), 0) AS total
           FROM royalty r
           LEFT JOIN earning e ON r.earning_id = e.id
           WHERE r.artist_id IN (:artistIds)
             AND (r.earning_id IS NULL OR e.recorded_by_brand_id IS NULL)
           GROUP BY r.artist_id`,
          { replacements: { artistIds: ownArtistIds }, type: 'SELECT' }
        );
        allRoyaltyRows.push(...ownRoyaltyRows);
      }
      if (sublabelArtistIds.length > 0) {
        const sublabelRoyaltyRows: any[] = await sequelize.query(
          `SELECT r.artist_id, COALESCE(SUM(r.amount), 0) AS total
           FROM royalty r
           JOIN earning e ON r.earning_id = e.id
           WHERE r.artist_id IN (:artistIds)
             AND e.recorded_by_brand_id = :parentBrandId
           GROUP BY r.artist_id`,
          { replacements: { artistIds: sublabelArtistIds, parentBrandId: brand.id }, type: 'SELECT' }
        );
        allRoyaltyRows.push(...sublabelRoyaltyRows);
      }
      const royaltiesByArtist: Record<number, number> = {};
      allRoyaltyRows.forEach((row: any) => {
        royaltiesByArtist[row.artist_id] = parseFloat(parseFloat(row.total).toFixed(2));
      });

      // Payments made by this parent brand (matches the dashboard's parent-view scoping)
      const paymentRows: any[] = await sequelize.query(
        `SELECT artist_id, COALESCE(SUM(amount), 0) AS total
         FROM payment
         WHERE artist_id IN (:artistIds)
           AND paid_by_brand_id = :parentBrandId
           AND status = 'succeeded'
         GROUP BY artist_id`,
        { replacements: { artistIds, parentBrandId: brand.id }, type: 'SELECT' }
      );
      const paymentsByArtist: Record<number, number> = {};
      paymentRows.forEach((row: any) => {
        paymentsByArtist[row.artist_id] = parseFloat(parseFloat(row.total).toFixed(2));
      });

      // Batch payment method lookup
      const pmRows: any[] = await sequelize.query(
        `SELECT DISTINCT artist_id FROM payment_method WHERE artist_id IN (:artistIds)`,
        { replacements: { artistIds }, type: 'SELECT' }
      );
      const hasPaymentMethodByArtist = new Set(pmRows.map((r: any) => r.artist_id));

      const artistsWithBalance = artists.map(artist => {
        const totalRoyalties = royaltiesByArtist[artist.id] ?? 0;
        const totalPayments = paymentsByArtist[artist.id] ?? 0;
        const balance = parseFloat((totalRoyalties - totalPayments).toFixed(2));
        const hasPaymentMethod = hasPaymentMethodByArtist.has(artist.id);
        return {
          artist_id: artist.id,
          artist_name: artist.name,
          sublabel_name: sublabelNameById.get(artist.brand_id) ?? null,
          balance,
          total_royalties: totalRoyalties,
          total_payments: totalPayments,
          payout_point: artist.payout_point,
          hold_payouts: artist.hold_payouts,
          has_payment_method: hasPaymentMethod,
          is_ready_for_payment: balance > artist.payout_point && hasPaymentMethod,
        };
      });

      const payableArtists = artistsWithBalance.filter(a => a.balance > 0);

      const adminUsers = await User.findAll({
        where: { brand_id: brand.id, is_admin: true },
        attributes: ['email_address'],
      });

      return {
        brand_id: brand.id,
        brand_name: brand.brand_name,
        logo_url: brand.logo_url ?? null,
        send_artist_balance_reminders: brand.send_artist_balance_reminders ?? false,
        admin_emails: adminUsers.map(u => (u as any).email_address).filter(Boolean),
        artists: payableArtists,
        total_payable: parseFloat(payableArtists.filter(a => a.is_ready_for_payment).reduce((sum, a) => sum + a.balance, 0).toFixed(2)),
      };
    }));

    auditLogger.logDataAccess(req, 'artists-due-payment', 'READ', results.length, {
      brandCount: results.length,
    });

    res.json({ brands: results });

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
        paymongo_wallet_id: { [Op.not]: null },
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

    // Log data access
    auditLogger.logDataAccess(req, 'wallet-balances', 'READ', walletBalances.length, {
      brandCount: brands.length,
    });

    res.json({
      total_brands: brands.length,
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

    // 7. Fundraiser URLs (poster_url)
    const fundraisers = await Fundraiser.findAll({
      attributes: ['id', 'title', 'poster_url', 'brand_id']
    });

    fundraisers.forEach(fundraiser => {
      if (fundraiser.poster_url) allUrls.add(fundraiser.poster_url);
    });

    // 8. Song audio files (audio_file, audio_file_mp3)
    const songs = await Song.findAll({
      attributes: ['id', 'title', 'audio_file', 'audio_file_mp3']
    });

    songs.forEach(song => {
      if (song.audio_file) allUrls.add(song.audio_file);
      if (song.audio_file_mp3) allUrls.add(song.audio_file_mp3);
    });

    // 9. Press Campaign URLs (cover_art, mp3_file)
    const pressCampaigns = await PressCampaign.findAll({
      attributes: ['id', 'cover_art', 'mp3_file']
    });

    pressCampaigns.forEach((campaign: any) => {
      if (campaign.cover_art) allUrls.add(campaign.cover_art);
      if (campaign.mp3_file) allUrls.add(campaign.mp3_file);
    });

    // 10. Press Campaign Artist Photos (path)
    const pressCampaignPhotos = await PressCampaignArtistPhoto.findAll({
      attributes: ['id', 'path']
    });

    pressCampaignPhotos.forEach((photo: any) => {
      if (photo.path) allUrls.add(photo.path);
    });

    // 11. Wristband Order design URLs
    const wristbandOrders = await WristbandOrder.findAll({ attributes: ['design_url'] });
    wristbandOrders.forEach((o: any) => { if (o.design_url) allUrls.add(o.design_url); });

    // 12. Audience user profile photos
    const audienceUsers = await AudienceUser.findAll({ attributes: ['id', 'profile_photo_url'] });
    audienceUsers.forEach((u: any) => { if (u.profile_photo_url) allUrls.add(u.profile_photo_url); });

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
      releaseCount: releases.length,
      fundraiserCount: fundraisers.length,
      songCount: songs.length,
      pressCampaignCount: pressCampaigns.length,
      pressCampaignPhotoCount: pressCampaignPhotos.length
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
        releases: releases.length,
        fundraisers: fundraisers.length,
        songs: songs.length,
        press_campaigns: pressCampaigns.length,
        press_campaign_photos: pressCampaignPhotos.length
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
            brand_id: sublabel.id,
            status: 'succeeded'
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

/**
 * Get release and song status (cross-brand)
 *
 * Returns ALL releases across ALL brands with their songs and metadata
 * for generating status reports. Includes song author/composer counts,
 * ISRC, lyrics, and audio file status.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (max: 100, default: 50)
 * - status: Filter by release status (optional)
 */
export const getReleaseStatus = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status as string;

    const whereClause: any = {};
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const { count, rows: releases } = await Release.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name'],
          required: true
        },
        {
          model: Artist,
          as: 'artists',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        },
        {
          model: Song,
          as: 'songs',
          attributes: ['id', 'title', 'isrc', 'lyrics', 'audio_file'],
          through: { attributes: ['track_number'] },
          include: [
            {
              model: SongAuthor,
              as: 'authors',
              attributes: ['id']
            },
            {
              model: SongComposer,
              as: 'composers',
              attributes: ['id']
            }
          ]
        }
      ],
      order: [
        ['brand_id', 'ASC'],
        ['status', 'ASC'],
        ['title', 'ASC'],
        [{ model: Song, as: 'songs' }, ReleaseSong, 'track_number', 'ASC']
      ],
      limit,
      offset,
      distinct: true
    });

    const results = releases.map(release => {
      const r = release.toJSON() as any;

      const songs = (r.songs || []).map((song: any) => ({
        id: song.id,
        track_number: song.release_song?.track_number ?? null,
        title: song.title,
        isrc: song.isrc || null,
        has_lyrics: !!(song.lyrics && song.lyrics.trim()),
        has_audio: !!(song.audio_file && song.audio_file.trim()),
        author_count: song.authors?.length || 0,
        composer_count: song.composers?.length || 0
      })).sort((a: any, b: any) => (a.track_number || 0) - (b.track_number || 0));

      return {
        id: r.id,
        title: r.title || '',
        catalog_no: r.catalog_no,
        status: r.status,
        UPC: r.UPC || null,
        cover_art: r.cover_art || null,
        release_date: r.release_date || null,
        description: r.description || null,
        brand_id: r.brand?.id,
        brand_name: r.brand?.brand_name,
        artists: (r.artists || []).map((a: any) => a.name),
        song_count: songs.length,
        songs
      };
    });

    auditLogger.logDataAccess(req, 'release-status', 'READ', results.length, {
      page,
      limit,
      statusFilter,
      totalReleases: count
    });

    res.json({
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      results
    });

  } catch (error) {
    console.error('Error fetching release status:', error);
    auditLogger.logSystemAccess(req, 'ERROR_RELEASE_STATUS', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get task digest (cross-brand)
 *
 * Returns all incomplete tasks that are overdue, due today, or due within the next 7 days,
 * grouped by assigned user and release. Used by the daily task-digest Lambda to
 * send email reminders and trigger in-app notifications.
 */
export const getTaskDigest = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = `${weekEnd.getFullYear()}-${pad(weekEnd.getMonth() + 1)}-${pad(weekEnd.getDate())}`;

    const tasks = await ReleaseTask.findAll({
      where: {
        assigned_user_id: { [Op.not]: null },
        status: { [Op.ne]: 'done' },
        due_date: { [Op.lte]: weekEndStr },
      },
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'email_address', 'first_name', 'last_name'],
          required: true,
        },
        {
          model: Release,
          as: 'release',
          attributes: ['id', 'title', 'catalog_no'],
          required: true,
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brand_name', 'brand_color', 'logo_url'],
          required: true,
        },
      ],
      order: [['due_date', 'ASC']],
    });

    // Group by user_id + release_id
    const digestMap = new Map<string, any>();

    for (const task of tasks) {
      const t = task as any;
      const key = `${t.assigned_user_id}:${t.release_id}`;

      if (!digestMap.has(key)) {
        const frontendUrl = await getBrandFrontendUrl(t.brand_id);
        digestMap.set(key, {
          user_id: t.assigned_user_id,
          user_email: t.assignedUser.email_address,
          user_name: t.assignedUser.first_name
            ? `${t.assignedUser.first_name} ${t.assignedUser.last_name || ''}`.trim()
            : t.assignedUser.email_address,
          release_id: t.release_id,
          release_title: t.release.title || t.release.catalog_no,
          brand_id: t.brand_id,
          brand_name: t.brand.brand_name,
          brand_color: t.brand.brand_color || null,
          brand_logo_url: t.brand.logo_url || null,
          tasks_url: `${frontendUrl}/music/releases/edit/${t.release_id}?tab=planning`,
          tasks_overdue: [],
          tasks_due_today: [],
          tasks_due_this_week: [],
        });
      }

      const digest = digestMap.get(key)!;
      const taskObj = {
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        status: t.status,
        notes: t.notes || null,
      };

      if (t.due_date < todayStr) {
        digest.tasks_overdue.push(taskObj);
      } else if (t.due_date === todayStr) {
        digest.tasks_due_today.push(taskObj);
      } else {
        digest.tasks_due_this_week.push(taskObj);
      }
    }

    const digests = Array.from(digestMap.values());

    auditLogger.logDataAccess(req, 'task-digest', 'READ', digests.length, {
      date: todayStr,
      totalTasks: tasks.length,
    });

    res.json({ digests, date: todayStr });
  } catch (error) {
    console.error('Error fetching task digest:', error);
    auditLogger.logSystemAccess(req, 'ERROR_TASK_DIGEST', { error: (error as any).message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create in-app notifications for tasks due today (cross-brand)
 *
 * Creates one in-app notification per user per release for tasks due today.
 * Called by the task-digest Lambda after sending emails.
 */
export const createTaskDigestNotifications = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const tasks = await ReleaseTask.findAll({
      where: {
        assigned_user_id: { [Op.not]: null },
        status: { [Op.ne]: 'done' },
        due_date: todayStr,
      },
      include: [
        {
          model: Release,
          as: 'release',
          attributes: ['id', 'title', 'catalog_no'],
          required: true,
        },
      ],
      order: [['release_id', 'ASC']],
    });

    if (tasks.length === 0) {
      return res.json({ notifications_created: 0 });
    }

    // Group by user_id + release_id so we send one notification per user per release
    const notifMap = new Map<string, { userId: number; brandId: number; releaseId: number; releaseTitle: string; taskCount: number }>();

    for (const task of tasks) {
      const t = task as any;
      const key = `${t.assigned_user_id}:${t.release_id}`;
      if (!notifMap.has(key)) {
        notifMap.set(key, {
          userId: t.assigned_user_id,
          brandId: t.brand_id,
          releaseId: t.release_id,
          releaseTitle: t.release.title || t.release.catalog_no,
          taskCount: 0,
        });
      }
      notifMap.get(key)!.taskCount++;
    }

    let notificationsCreated = 0;
    for (const { userId, brandId, releaseId, releaseTitle, taskCount } of notifMap.values()) {
      const title = taskCount === 1
        ? `You have 1 task due today on "${releaseTitle}"`
        : `You have ${taskCount} tasks due today on "${releaseTitle}"`;

      await createNotificationsForUsers(
        [userId],
        brandId,
        'task_due_today',
        title,
        undefined,
        `/music/releases/edit/${releaseId}?tab=planning`
      );
      notificationsCreated++;
    }

    auditLogger.logDataAccess(req, 'task-digest-notifications', 'CREATE', notificationsCreated, {
      date: todayStr,
      totalTasks: tasks.length,
    });

    res.json({ notifications_created: notificationsCreated, date: todayStr });
  } catch (error) {
    console.error('Error creating task digest notifications:', error);
    auditLogger.logSystemAccess(req, 'ERROR_TASK_DIGEST_NOTIFICATIONS', { error: (error as any).message });
    res.status(500).json({ error: 'Internal server error' });
  }
};


