import { Request, Response } from 'express';
import { Earning, Royalty, Payment, PaymentMethod, Artist, Release, RecuperableExpense, ReleaseArtist, Brand } from '../models';
import { sendBrandedEmail } from '../utils/emailService';

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
    const { artist_id, release_id } = req.query;

    const where: any = {};
    const includeConditions: any[] = [
      { model: Artist, as: 'artist', where: { brand_id: req.user.brand_id } }
    ];

    if (artist_id) {
      where.artist_id = artist_id;
    }

    if (release_id) {
      where.release_id = release_id;
      includeConditions.push({ model: Release, as: 'release' });
    }

    const royalties = await Royalty.findAll({
      where,
      include: includeConditions,
      order: [['date_recorded', 'DESC']]
    });

    res.json({ royalties });
  } catch (error) {
    console.error('Get royalties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all earnings
export const getEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { release_id, type } = req.query;

    const where: any = {};
    if (release_id) {
      where.release_id = release_id;
    }
    if (type) {
      where.type = type;
    }

    const earnings = await Earning.findAll({
      where,
      include: [
        { 
          model: Release, 
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_recorded', 'DESC']]
    });

    res.json({ earnings });
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
    const { type } = req.query;

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

    // Build where clause for earnings
    const earningsWhere: any = {};
    if (type) {
      earningsWhere.type = type;
    }

    // Get earnings for releases associated with this artist
    const earnings = await Earning.findAll({
      where: earningsWhere,
      include: [
        {
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id },
          include: [
            {
              model: ReleaseArtist,
              as: 'releaseArtists',
              where: { artist_id: artist_id },
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
      order: [['date_recorded', 'DESC']]
    });

    res.json({ 
      earnings,
      artist: {
        id: artist.id,
        name: artist.name
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
      send_notification = true
    } = req.body;

    if (!artist_id || !amount || !date_paid) {
      return res.status(400).json({ 
        error: 'Artist ID, amount, and date are required' 
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

    const payment = await Payment.create({
      artist_id,
      amount,
      description,
      date_paid: new Date(date_paid),
      paid_thru_type,
      paid_thru_account_name,
      paid_thru_account_number
    });

    // Send payment notification if requested
    if (send_notification) {
      // Get artist team members
      const { ArtistAccess, User } = require('../models');
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id },
        include: [{ model: User, as: 'user' }]
      });

      const recipients = artistAccess.map(access => access.user.email_address);

      if (recipients.length > 0) {
        await sendBrandedEmail(
          recipients,
          `Payment Processed - ${artist.name}`,
          'payment_notification',
          {
            body: `
              <h2>Payment Processed</h2>
              <p>A payment has been processed for ${artist.name}:</p>
              <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p><strong>Amount:</strong> ₱${amount}</p>
                <p><strong>Date:</strong> ${new Date(date_paid).toLocaleDateString()}</p>
                <p><strong>Method:</strong> ${paid_thru_type || 'Not specified'}</p>
                <p><strong>Description:</strong> ${description || 'Payment'}</p>
              </div>
            `
          },
          artist.brand
        );
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

    const where: any = {};
    if (artist_id) {
      where.artist_id = artist_id;
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

    // Get payments for this artist
    const payments = await Payment.findAll({
      where: { artist_id: artist_id },
      include: [
        { 
          model: Artist, 
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }
      ],
      order: [['date_paid', 'DESC']]
    });

    res.json({ 
      payments,
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

// PAYMENT METHODS MANAGEMENT
export const addPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const {
      artist_id,
      type,
      account_name,
      account_number_or_email,
      bank_code,
      is_default = false
    } = req.body;

    if (!artist_id || !type || !account_name || !account_number_or_email) {
      return res.status(400).json({ 
        error: 'Artist ID, type, account name, and account number/email are required' 
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

    // If this is set as default, remove default from other methods
    if (is_default) {
      await PaymentMethod.update(
        { is_default_for_artist: false },
        { where: { artist_id } }
      );
    }

    const paymentMethod = await PaymentMethod.create({
      artist_id,
      type,
      account_name,
      account_number_or_email,
      bank_code: bank_code || 'N/A',
      is_default_for_artist: is_default
    });

    res.status(201).json({
      message: 'Payment method added successfully',
      payment_method: paymentMethod
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// EXPENSES MANAGEMENT
export const addRecuperableExpense = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      release_id,
      expense_description,
      expense_amount,
      date_recorded
    } = req.body;

    if (!release_id || !expense_description || !expense_amount) {
      return res.status(400).json({ 
        error: 'Release ID, description, and amount are required' 
      });
    }

    // Verify release belongs to user's brand
    const release = await Release.findOne({
      where: { 
        id: release_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const expense = await RecuperableExpense.create({
      release_id,
      expense_description,
      expense_amount,
      date_recorded: date_recorded ? new Date(date_recorded) : new Date(),
      brand_id: req.user.brand_id
    });

    res.status(201).json({
      message: 'Recuperable expense added successfully',
      expense
    });
  } catch (error) {
    console.error('Add recuperable expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.query;

    let summary: any = {};

    if (artist_id) {
      // Artist-specific summary
      const artist = await Artist.findOne({
        where: { 
          id: artist_id,
          brand_id: req.user.brand_id 
        }
      });

      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }

      const totalRoyalties = await Royalty.sum('amount', {
        where: { artist_id }
      }) || 0;

      const totalPayments = await Payment.sum('amount', {
        where: { artist_id }
      }) || 0;

      summary = {
        artist_id,
        artist_name: artist.name,
        total_royalties: totalRoyalties,
        total_payments: totalPayments,
        current_balance: totalRoyalties - totalPayments,
        payout_point: artist.payout_point
      };
    } else {
      // Brand-wide summary
      const totalEarnings = await Earning.sum('amount', {
        include: [{
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id }
        }]
      }) || 0;

      const totalRoyalties = await Royalty.sum('amount', {
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }]
      }) || 0;

      const totalPayments = await Payment.sum('amount', {
        include: [{
          model: Artist,
          as: 'artist',
          where: { brand_id: req.user.brand_id }
        }]
      }) || 0;

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