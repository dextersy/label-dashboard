import { Request, Response } from 'express';
import { Earning, Royalty, Payment, PaymentMethod, Artist, Release, RecuperableExpense, ReleaseArtist, Brand, ArtistAccess, User } from '../models';
import { sendBrandedEmail, sendEarningsNotification } from '../utils/emailService';
import { PaymentService } from '../utils/paymentService';

interface AuthRequest extends Request {
  user?: any;
}

// EARNINGS MANAGEMENT
export const addEarning = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      release_id,
      type,
      amount,
      description,
      date_recorded,
      calculate_royalties = false
    } = req.body;

    if (!release_id || !amount || !date_recorded) {
      return res.status(400).json({ 
        error: 'Release ID, amount, and date are required' 
      });
    }

    // Verify release exists and belongs to user's brand
    const release = await Release.findOne({
      where: { 
        id: release_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Create earning record
    const earning = await Earning.create({
      release_id,
      type: type || 'Streaming',
      amount,
      description,
      date_recorded: new Date(date_recorded)
    });

    // Calculate and create royalties if requested
    if (calculate_royalties) {
      await processEarningRoyalties(earning);
    }

    // Send earning notification emails (matching PHP logic)
    await sendEarningNotifications(earning, req.user.brand_id);

    res.status(201).json({
      message: 'Earning added successfully',
      earning
    });
  } catch (error) {
    console.error('Add earning error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bulkAddEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { earnings } = req.body; // Array of earning objects

    if (!Array.isArray(earnings) || earnings.length === 0) {
      return res.status(400).json({ error: 'Earnings array is required' });
    }

    const createdEarnings = [];
    const errors = [];

    for (let i = 0; i < earnings.length; i++) {
      try {
        const earningData = earnings[i];
        
        // Verify release exists
        const release = await Release.findOne({
          where: { 
            id: earningData.release_id,
            brand_id: req.user.brand_id 
          }
        });

        if (!release) {
          errors.push(`Row ${i + 1}: Release not found`);
          continue;
        }

        const earning = await Earning.create({
          release_id: earningData.release_id,
          type: earningData.type || 'Streaming',
          amount: earningData.amount,
          description: earningData.description,
          date_recorded: new Date(earningData.date_recorded)
        });

        if (earningData.calculate_royalties) {
          await processEarningRoyalties(earning);
        }

        // Send earning notification emails (matching PHP logic)
        await sendEarningNotifications(earning, req.user.brand_id);

        createdEarnings.push(earning);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    res.json({
      message: `Processed ${earnings.length} earnings`,
      created: createdEarnings.length,
      errors
    });
  } catch (error) {
    console.error('Bulk add earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to process earning royalties
async function processEarningRoyalties(earning: any) {
  const releaseArtists = await ReleaseArtist.findAll({
    where: { release_id: earning.release_id },
    include: [{ model: Artist, as: 'artist' }]
  });

  for (const releaseArtist of releaseArtists) {
    let royaltyPercentage = 0;
    
    // Get royalty percentage based on earning type
    switch (earning.type) {
      case 'Streaming':
        royaltyPercentage = releaseArtist.streaming_royalty_percentage;
        break;
      case 'Sync':
        royaltyPercentage = releaseArtist.sync_royalty_percentage;
        break;
      case 'Downloads':
        royaltyPercentage = releaseArtist.download_royalty_percentage;
        break;
      case 'Physical':
        royaltyPercentage = releaseArtist.physical_royalty_percentage;
        break;
    }

    if (royaltyPercentage > 0) {
      const royaltyAmount = earning.amount * royaltyPercentage;
      
      await Royalty.create({
        artist_id: releaseArtist.artist_id,
        earning_id: earning.id,
        release_id: earning.release_id,
        percentage_of_earning: royaltyPercentage,
        amount: royaltyAmount,
        description: `${earning.type} royalty from ${earning.description || 'earning'}`,
        date_recorded: earning.date_recorded
      });
    }
  }
}

// ROYALTY MANAGEMENT
export const addRoyalty = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      artist_id,
      earning_id,
      release_id,
      amount,
      description,
      date_recorded
    } = req.body;

    if (!artist_id || !amount || !date_recorded) {
      return res.status(400).json({ 
        error: 'Artist ID, amount, and date are required' 
      });
    }

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const royalty = await Royalty.create({
      artist_id,
      earning_id,
      release_id,
      amount,
      description,
      date_recorded: new Date(date_recorded)
    });

    res.status(201).json({
      message: 'Royalty added successfully',
      royalty
    });
  } catch (error) {
    console.error('Add royalty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRoyalties = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id, release_id, page = '1', limit = '20', sortBy, sortDirection, start_date, end_date, ...filters } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;
    const releaseIdNum = release_id ? parseInt(release_id as string, 10) : undefined;

    const where: any = {};
    
    // Build release where clause for title filtering
    const releaseWhere: any = {};
    
    if (filters.release_title && filters.release_title !== '') {
      releaseWhere.title = { [require('sequelize').Op.like]: `%${filters.release_title}%` };
    }
    
    const includeConditions: any[] = [
      { model: Artist, as: 'artist', where: { brand_id: req.user.brand_id } },
      { model: Release, as: 'release', where: releaseWhere } // Include release with filtering
    ];

    if (artist_id) {
      where.artist_id = artistIdNum;
    }

    if (release_id) {
      where.release_id = releaseIdNum;
    }

    // Add date range filtering
    if (start_date && end_date) {
      where.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    } else if (filters.date_recorded && filters.date_recorded !== '') {
      // Fallback for single date search (exact match for the day)
      const searchDate = new Date(filters.date_recorded as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.date_recorded = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Add search filters
    if (filters.description && filters.description !== '') {
      where.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      where.amount = parseFloat(filters.amount as string);
    }

    // Build order clause
    let orderClause: any[] = [['date_recorded', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_recorded', 'description', 'amount'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    const { count, rows: royalties } = await Royalty.findAndCountAll({
      where,
      include: includeConditions,
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      royalties,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get royalties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all earnings
export const getEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { release_id, type, page = '1', limit = '20' } = req.query;
    const releaseIdNum = release_id ? parseInt(release_id as string, 10) : undefined;

    const where: any = {};
    if (release_id) {
      where.release_id = releaseIdNum;
    }
    if (type) {
      where.type = type;
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    const { count, rows: earnings } = await Earning.findAndCountAll({
      where,
      include: [
        { 
          model: Release, 
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_recorded', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      earnings,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get earning by ID
export const getEarningById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const earning = await Earning.findOne({
      where: { id },
      include: [
        { 
          model: Release, 
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }
      ]
    });

    if (!earning) {
      return res.status(404).json({ error: 'Earning not found' });
    }

    res.json({ earning });
  } catch (error) {
    console.error('Get earning by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get earnings by artist ID
export const getEarningsByArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.params;
    let artistIdNum = parseInt(artist_id, 10);
    
    if (isNaN(artistIdNum)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const { type, page = '1', limit = '20', sortBy, sortDirection, start_date, end_date, ...filters } = req.query;
    
    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artistIdNum,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Build where clause for earnings
    const earningsWhere: any = {};
    if (type) {
      earningsWhere.type = type;
    }

    // Add date range filtering
    if (start_date && end_date) {
      earningsWhere.date_recorded = {
        [require('sequelize').Op.between]: [start_date, end_date]
      };
    } else if (filters.date_recorded && filters.date_recorded !== '') {
      // Fallback for single date search (exact match for the day)
      const searchDate = new Date(filters.date_recorded as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      earningsWhere.date_recorded = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Add search filters
    if (filters.description && filters.description !== '') {
      earningsWhere.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      earningsWhere.amount = parseFloat(filters.amount as string);
    }

    // Build order clause
    let orderClause: any[] = [['date_recorded', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_recorded', 'description', 'amount', 'type'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build release where clause for title filtering
    const releaseWhere: any = { brand_id: req.user.brand_id };
    
    if (filters.release_title && filters.release_title !== '') {
      releaseWhere.title = { [require('sequelize').Op.like]: `%${filters.release_title}%` };
    }

    // Get earnings for releases associated with this artist
    const { count, rows: earnings } = await Earning.findAndCountAll({
      where: earningsWhere,
      include: [
        {
          model: Release,
          as: 'release',
          where: releaseWhere,
          include: [
            {
              model: ReleaseArtist,
              as: 'releaseArtists',
              where: { artist_id: artistIdNum },
              include: [
                {
                  model: Artist,
                  as: 'artist'
                }
              ]
            }
          ]
        }
      ],
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      earnings,
      artist: {
        id: artist.id,
        name: artist.name
      },
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get earnings by artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PAYMENT MANAGEMENT
export const addPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      artist_id,
      amount,
      description,
      date_paid,
      paid_thru_type,
      paid_thru_account_name,
      paid_thru_account_number,
      payment_method_id,
      reference_number,
      payment_processing_fee,
      send_notification = true
    } = req.body;
    
    const artistIdNum = parseInt(artist_id, 10);

    if (!artist_id || amount === undefined || amount === null || amount <= 0 || !date_paid) {
      return res.status(400).json({ 
        error: 'Artist ID, amount (greater than 0), and date are required' 
      });
    }

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    let finalAmount = amount;
    let finalProcessingFee = payment_processing_fee || 0;
    let finalReferenceNumber = reference_number;

    // Handle Paymongo payment processing for non-manual payments
    if (payment_method_id && payment_method_id !== '-1' && req.body.manualPayment !== '1') {
      try {
        const paymentService = new PaymentService();
        const brand = artist.brand;
        
        if (!brand || !brand.paymongo_wallet_id) {
          return res.status(400).json({ error: 'Brand wallet not configured for payments' });
        }

        // Calculate processing fee
        const processingFee = brand.payment_processing_fee_for_payouts || 0;
        const transferAmount = amount - processingFee;

        // Send money through Paymongo
        const referenceNumber = await paymentService.sendMoneyTransfer(
          brand.id,
          payment_method_id,
          transferAmount,
          description
        );

        if (!referenceNumber) {
          return res.status(400).json({ error: 'Payment processing failed' });
        }

        finalProcessingFee = processingFee;
        finalReferenceNumber = referenceNumber;
      } catch (error) {
        console.error('Paymongo payment error:', error);
        return res.status(500).json({ error: 'Payment processing failed' });
      }
    }

    const payment = await Payment.create({
      artist_id: artistIdNum,
      amount: finalAmount,
      description,
      date_paid: new Date(date_paid),
      paid_thru_type,
      paid_thru_account_name,
      paid_thru_account_number,
      payment_method_id: payment_method_id && payment_method_id !== '-1' ? payment_method_id : null,
      reference_number: finalReferenceNumber,
      payment_processing_fee: finalProcessingFee
    });

    // Send payment notification if requested
    if (send_notification) {
      // Get artist team members
      const { ArtistAccess, User } = require('../models');
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id: artistIdNum },
        include: [{ model: User, as: 'user' }]
      });

      const recipients = artistAccess.map(access => access.user.email_address);

      if (recipients.length > 0) {
        for (const recipient of recipients) {
          await sendBrandedEmail(
            recipient,
            'payment_notification',
            {
              artistName: artist.name,
              amount: amount,
              datePaid: new Date(date_paid).toLocaleDateString(),
              method: paid_thru_type || 'Not specified',
              description: description || 'Payment'
            },
            req.user.brand_id
          );
        }
      }
    }

    res.status(201).json({
      message: 'Payment added successfully',
      payment
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;

    const where: any = {};
    if (artist_id) {
      where.artist_id = artistIdNum;
    }

    const payments = await Payment.findAll({
      where,
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_paid', 'DESC']]
    });

    res.json({ payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payment by ID
export const getPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: { id },
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get payments by artist ID  
export const getPaymentsByArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.params;
    const { page = '1', limit = '10', sortBy, sortDirection, ...filters } = req.query;

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build where conditions based on filters
    const where: any = { artist_id: artist_id };
    
    // Add search filters
    if (filters.description && filters.description !== '') {
      where.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.paid_thru_type && filters.paid_thru_type !== '') {
      where.paid_thru_type = { [require('sequelize').Op.like]: `%${filters.paid_thru_type}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      where.amount = parseFloat(filters.amount as string);
    }
    
    if (filters.payment_processing_fee && filters.payment_processing_fee !== '') {
      where.payment_processing_fee = parseFloat(filters.payment_processing_fee as string);
    }
    
    if (filters.date_paid && filters.date_paid !== '') {
      // Search by date (exact match for the day)
      const searchDate = new Date(filters.date_paid as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.date_paid = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Build order clause
    let orderClause: any[] = [['date_paid', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_paid', 'description', 'paid_thru_type', 'amount', 'payment_processing_fee'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    // Get payments for this artist with pagination and filters
    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      payments,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      },
      artist: {
        id: artist.id,
        name: artist.name
      }
    });
  } catch (error) {
    console.error('Get payments by artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Note: Payment methods management moved to artistController.ts

// EXPENSES MANAGEMENT - moved to release information section

export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;
    const artistIdNum = artist_id ? parseInt(artist_id as string, 10) : undefined;

    let summary: any = {};

    if (artist_id) {
      // Artist-specific summary
      const artist = await Artist.findOne({
        where: { 
          id: artistIdNum,
          brand_id: req.user.brand_id 
        }
      });

      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }

      const totalRoyalties = await Royalty.sum('amount', {
        where: { artist_id: artistIdNum }
      }) || 0;

      const totalPayments = await Payment.sum('amount', {
        where: { artist_id: artistIdNum }
      }) || 0;

      // Calculate total earnings for this artist by first finding releases, then summing earnings
      const artistReleases = await ReleaseArtist.findAll({
        where: { artist_id: artistIdNum },
        attributes: ['release_id'],
        include: [{
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id },
          attributes: ['id']
        }]
      });

      const releaseIds = artistReleases.map(ra => ra.release_id);
      
      const totalEarnings = releaseIds.length > 0 ? await Earning.sum('amount', {
        where: {
          release_id: releaseIds
        }
      }) || 0 : 0;

      summary = {
        artist_id,
        artist_name: artist.name,
        total_earnings: totalEarnings,
        total_royalties: totalRoyalties,
        total_payments: totalPayments,
        current_balance: totalRoyalties - totalPayments,
        payout_point: artist.payout_point
      };
    } else {
      // Brand-wide summary
      const earningsResult = await Earning.findAll({
        include: [{
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalEarnings = (earningsResult[0] as any)?.total || 0;

      const royaltiesResult = await Royalty.findAll({
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalRoyalties = (royaltiesResult[0] as any)?.total || 0;

      const paymentsResult = await Payment.findAll({
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }],
        attributes: [
          [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
        ],
        raw: true
      });
      const totalPayments = (paymentsResult[0] as any)?.total || 0;

      summary = {
        brand_id: req.user.brand_id,
        total_earnings: totalEarnings,
        total_royalties: totalRoyalties,
        total_payments: totalPayments,
        label_profit: totalEarnings - totalRoyalties
      };
    }

    res.json({ summary });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// WALLET BALANCE
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    // Get brand information
    const brand = await Brand.findOne({
      where: { id: req.user.brand_id }
    });

    if (!brand || !brand.paymongo_wallet_id) {
      return res.status(400).json({ error: 'Brand wallet not configured' });
    }

    const paymentService = new PaymentService();
    const balance = await paymentService.getWalletBalance(brand.paymongo_wallet_id);

    if (balance === -1) {
      return res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }

    res.json({ balance });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Note: Payout settings management moved to artistController.ts

// Note: Release information management moved to artistController.ts

// ADMIN SUMMARY ENDPOINTS (based on PHP admin-summary-view.php)
export const getAdminEarningsSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get all releases for the brand
    const releases = await Release.findAll({
      where: { brand_id: req.user.brand_id }
    });

    const releaseIds = releases.map(r => r.id);

    if (releaseIds.length === 0) {
      return res.json({
        physical_earnings: 0,
        download_earnings: 0,
        streaming_earnings: 0,
        sync_earnings: 0
      });
    }

    // Get earnings by type for the date range
    const earningsByType = await Earning.findAll({
      where: {
        release_id: releaseIds,
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      },
      attributes: [
        'type',
        [require('sequelize').fn('sum', require('sequelize').col('amount')), 'total']
      ],
      group: ['type'],
      raw: true
    });

    // Initialize summary with zeros
    const summary = {
      physical_earnings: 0,
      download_earnings: 0,
      streaming_earnings: 0,
      sync_earnings: 0
    };

    // Populate summary with actual earnings
    earningsByType.forEach((earning: any) => {
      const total = parseFloat(earning.total) || 0;
      switch (earning.type) {
        case 'Physical':
          summary.physical_earnings = total;
          break;
        case 'Downloads':
          summary.download_earnings = total;
          break;
        case 'Streaming':
          summary.streaming_earnings = total;
          break;
        case 'Sync':
          summary.sync_earnings = total;
          break;
      }
    });

    res.json(summary);
  } catch (error) {
    console.error('Get admin earnings summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAdminPaymentsRoyaltiesSummary = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get all artists for the brand
    const artists = await Artist.findAll({
      where: { brand_id: req.user.brand_id }
    });

    const artistSummaries = [];
    let overallTotalPayments = 0;
    let overallTotalRoyalties = 0;

    for (const artist of artists) {
      // Get total payments for this artist in the date range
      const totalPayments = await Payment.sum('amount', {
        where: {
          artist_id: artist.id,
          date_paid: {
            [require('sequelize').Op.between]: [start_date, end_date]
          }
        }
      }) || 0;

      // Get total royalties for this artist in the date range
      const totalRoyalties = await Royalty.sum('amount', {
        where: {
          artist_id: artist.id,
          date_recorded: {
            [require('sequelize').Op.between]: [start_date, end_date]
          }
        }
      }) || 0;

      // Only include artists with payments or royalties
      if (totalPayments > 0 || totalRoyalties > 0) {
        artistSummaries.push({
          artist_id: artist.id,
          artist_name: artist.name,
          total_payments: totalPayments,
          total_royalties: totalRoyalties
        });

        overallTotalPayments += totalPayments;
        overallTotalRoyalties += totalRoyalties;
      }
    }

    // Get recuperable expenses
    const totalNewRecuperableExpense = await RecuperableExpense.sum('expense_amount', {
      where: {
        brand_id: req.user.brand_id,
        expense_amount: {
          [require('sequelize').Op.gt]: 0
        },
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      }
    }) || 0;

    const totalRecuperatedExpense = await RecuperableExpense.sum('expense_amount', {
      where: {
        brand_id: req.user.brand_id,
        expense_amount: {
          [require('sequelize').Op.lt]: 0  
        },
        date_recorded: {
          [require('sequelize').Op.between]: [start_date, end_date]
        }
      }
    }) || 0;

    res.json({
      artist_summaries: artistSummaries,
      overall_total_payments: overallTotalPayments,
      overall_total_royalties: overallTotalRoyalties,
      total_new_recuperable_expense: totalNewRecuperableExpense,
      total_recuperated_expense: Math.abs(totalRecuperatedExpense)
    });
  } catch (error) {
    console.error('Get admin payments royalties summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to send earning notifications (matching PHP logic)
async function sendEarningNotifications(earning: any, brandId: number) {
  try {
    // Get release with associated artists and brand
    const release = await Release.findByPk(earning.release_id, {
      include: [
        {
          model: ReleaseArtist,
          as: 'releaseArtists',
          include: [
            {
              model: Artist,
              as: 'artist'
            }
          ]
        },
        {
          model: Brand,
          as: 'brand'
        }
      ]
    });

    if (!release || !release.releaseArtists || release.releaseArtists.length === 0) {
      return;
    }

    // Process each artist (matching PHP logic)
    for (const releaseArtist of release.releaseArtists) {
      if (!releaseArtist.artist) {
        continue;
      }

      // Get artist access (team members with email addresses)
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id: releaseArtist.artist.id },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['email_address', 'first_name', 'last_name']
          }
        ]
      });

      if (!artistAccess || artistAccess.length === 0) {
        continue;
      }

      // Get email addresses for team members
      const emailAddresses = artistAccess
        .map((access: any) => access.user?.email_address)
        .filter((email: string) => email); // Remove any undefined emails

      if (emailAddresses.length === 0) {
        continue;
      }

      // Calculate recuperable expenses and royalties (simplified for now)
      const recuperatedAmount = 0; // TODO: Implement recuperable expense calculation
      const recuperableBalance = 0; // TODO: Implement recuperable balance calculation
      
      // Get royalty amount for this artist if it exists
      const royalty = await Royalty.findOne({
        where: { 
          earning_id: earning.id,
          artist_id: releaseArtist.artist.id
        }
      });
      const royaltyAmount = royalty ? royalty.amount : null;

      // Get brand settings
      const brandName = release.brand?.brand_name || 'Label Dashboard';
      const brandColor = release.brand?.brand_color || '#667eea';
      const brandLogo = release.brand?.logo_url || '';
      
      // Generate dashboard URL
      const protocol = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
      const host = process.env.FRONTEND_HOST || 'localhost:4200';
      const dashboardUrl = `${protocol}://${host}/financial#earnings`;

      // Send earnings notification email
      await sendEarningsNotification(
        emailAddresses,
        releaseArtist.artist.name,
        release.title || 'Unknown Release',
        earning.description || `${earning.type} earnings`,
        earning.amount.toString(),
        recuperatedAmount.toString(),
        recuperableBalance.toString(),
        royaltyAmount ? royaltyAmount.toString() : null,
        brandName,
        brandColor,
        brandLogo,
        dashboardUrl,
        release.brand_id
      );
    }

  } catch (error) {
    console.error('Error sending earning notifications:', error);
    // Don't throw error - email failures shouldn't block earning creation
  }
}