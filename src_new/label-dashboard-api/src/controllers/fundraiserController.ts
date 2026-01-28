import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Fundraiser, Donation, Brand } from '../models';
import multer from 'multer';
import path from 'path';
import AWS from 'aws-sdk';

// Configure S3 client (using aws-sdk v2 for consistency with rest of codebase)
const s3 = new AWS.S3();

// Configure multer for memory storage (we'll upload to S3)
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to upload to S3
async function uploadToS3(file: Express.Multer.File, brandId: number): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not configured');
  }

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(file.originalname);
  const key = `fundraiser-poster-${brandId}-${uniqueSuffix}${ext}`;

  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  const result = await s3.upload(uploadParams).promise();
  return result.Location;
}

/**
 * Get all fundraisers for the current brand
 */
export const getFundraisers = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraisers = await Fundraiser.findAll({
      where: { brand_id: brandId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Donation,
          as: 'donations',
          attributes: ['id', 'amount', 'payment_status'],
          required: false
        }
      ]
    });

    // Calculate totals for each fundraiser
    const fundraisersWithTotals = fundraisers.map(fundraiser => {
      const donations = fundraiser.donations || [];
      const paidDonations = donations.filter((d: any) => d.payment_status === 'paid');
      const totalRaised = paidDonations.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0);
      const donationCount = paidDonations.length;

      return {
        ...fundraiser.toJSON(),
        totalRaised,
        donationCount,
        donations: undefined // Don't send full donations array
      };
    });

    res.json({ fundraisers: fundraisersWithTotals });
  } catch (error) {
    console.error('Error fetching fundraisers:', error);
    res.status(500).json({ error: 'Failed to fetch fundraisers' });
  }
};

/**
 * Get a single fundraiser by ID
 */
export const getFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId },
      include: [
        {
          model: Donation,
          as: 'donations',
          where: { payment_status: 'paid' },
          attributes: ['id', 'amount', 'payment_status'],
          required: false
        }
      ]
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    // Calculate totals
    const donations = fundraiser.donations || [];
    const totalRaised = donations.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0);
    const donationCount = donations.length;

    res.json({
      fundraiser: {
        ...fundraiser.toJSON(),
        totalRaised,
        donationCount,
        donations: undefined
      }
    });
  } catch (error) {
    console.error('Error fetching fundraiser:', error);
    res.status(500).json({ error: 'Failed to fetch fundraiser' });
  }
};

/**
 * Create a new fundraiser
 */
export const createFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { title, description, status } = req.body;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let posterUrl: string | undefined;

    // Handle file upload if present
    if (req.file) {
      try {
        posterUrl = await uploadToS3(req.file, brandId);
      } catch (uploadError) {
        console.error('Error uploading poster:', uploadError);
        return res.status(500).json({ error: 'Failed to upload poster image' });
      }
    }

    const fundraiser = await Fundraiser.create({
      brand_id: brandId,
      title,
      description: description || null,
      poster_url: posterUrl,
      status: status || 'draft'
    });

    res.status(201).json({ fundraiser, message: 'Fundraiser created successfully' });
  } catch (error) {
    console.error('Error creating fundraiser:', error);
    res.status(500).json({ error: 'Failed to create fundraiser' });
  }
};

/**
 * Update an existing fundraiser
 */
export const updateFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);
    const { title, description, status, poster_url } = req.body;

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId }
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    let newPosterUrl = poster_url;

    // Handle file upload if present
    if (req.file) {
      try {
        newPosterUrl = await uploadToS3(req.file, brandId);
      } catch (uploadError) {
        console.error('Error uploading poster:', uploadError);
        return res.status(500).json({ error: 'Failed to upload poster image' });
      }
    }

    await fundraiser.update({
      title: title || fundraiser.title,
      description: description !== undefined ? description : fundraiser.description,
      poster_url: newPosterUrl !== undefined ? newPosterUrl : fundraiser.poster_url,
      status: status || fundraiser.status
    });

    res.json({ fundraiser, message: 'Fundraiser updated successfully' });
  } catch (error) {
    console.error('Error updating fundraiser:', error);
    res.status(500).json({ error: 'Failed to update fundraiser' });
  }
};

/**
 * Publish a fundraiser
 */
export const publishFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId }
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    await fundraiser.update({ status: 'published' });

    res.json({ fundraiser, message: 'Fundraiser published successfully' });
  } catch (error) {
    console.error('Error publishing fundraiser:', error);
    res.status(500).json({ error: 'Failed to publish fundraiser' });
  }
};

/**
 * Unpublish a fundraiser
 */
export const unpublishFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId }
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    await fundraiser.update({ status: 'draft' });

    res.json({ fundraiser, message: 'Fundraiser unpublished successfully' });
  } catch (error) {
    console.error('Error unpublishing fundraiser:', error);
    res.status(500).json({ error: 'Failed to unpublish fundraiser' });
  }
};

/**
 * Close a fundraiser
 */
export const closeFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId }
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    await fundraiser.update({ status: 'closed' });

    res.json({ fundraiser, message: 'Fundraiser closed successfully' });
  } catch (error) {
    console.error('Error closing fundraiser:', error);
    res.status(500).json({ error: 'Failed to close fundraiser' });
  }
};

/**
 * Reopen a closed fundraiser
 */
export const reopenFundraiser = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const fundraiserId = parseInt(id, 10);

    if (!fundraiserId || isNaN(fundraiserId) || fundraiserId <= 0) {
      return res.status(400).json({ error: 'Invalid fundraiser ID' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const fundraiser = await Fundraiser.findOne({
      where: { id: fundraiserId, brand_id: brandId }
    });

    if (!fundraiser) {
      return res.status(404).json({ error: 'Fundraiser not found' });
    }

    if (fundraiser.status !== 'closed') {
      return res.status(400).json({ error: 'Only closed fundraisers can be reopened' });
    }

    await fundraiser.update({ status: 'published' });

    res.json({ fundraiser, message: 'Fundraiser reopened successfully' });
  } catch (error) {
    console.error('Error reopening fundraiser:', error);
    res.status(500).json({ error: 'Failed to reopen fundraiser' });
  }
};

/**
 * Get donations for a fundraiser with pagination
 */
export const getDonations = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { fundraiser_id } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status_filter as string;
    const search = req.query.search as string;
    const allowedSortFields = ['createdAt', 'amount', 'name', 'email', 'payment_status', 'date_paid'];
    const allowedSortOrders = ['ASC', 'DESC'];
    const requestedSortField = req.query.sort_field as string;
    const requestedSortOrder = (req.query.sort_order as string)?.toUpperCase();
    const sortField = allowedSortFields.includes(requestedSortField) ? requestedSortField : 'createdAt';
    const sortOrder = allowedSortOrders.includes(requestedSortOrder) ? requestedSortOrder : 'DESC';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    // Build where clause
    const whereClause: any = {};

    if (fundraiser_id) {
      const parsedFundraiserId = parseInt(fundraiser_id as string, 10);

      // Verify the fundraiser belongs to the brand
      const fundraiser = await Fundraiser.findOne({
        where: { id: parsedFundraiserId, brand_id: brandId }
      });

      if (!fundraiser) {
        return res.status(404).json({ error: 'Fundraiser not found' });
      }

      whereClause.fundraiser_id = parsedFundraiserId;
    } else {
      // Get all fundraiser IDs for this brand
      const brandFundraisers = await Fundraiser.findAll({
        where: { brand_id: brandId },
        attributes: ['id']
      });
      const fundraiserIds = brandFundraisers.map(f => f.id);
      whereClause.fundraiser_id = { [Op.in]: fundraiserIds };
    }

    // Add status filter
    if (statusFilter && statusFilter !== 'all') {
      whereClause.payment_status = statusFilter;
    }

    // Add date range filter
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')]
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    // Add search filter (sanitize and limit length)
    if (search) {
      const sanitizedSearch = search.trim().substring(0, 100);
      if (sanitizedSearch) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${sanitizedSearch}%` } },
          { email: { [Op.like]: `%${sanitizedSearch}%` } }
        ];
      }
    }

    // Get donations with pagination
    const { count, rows: donations } = await Donation.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Fundraiser,
          as: 'fundraiser',
          attributes: ['id', 'title']
        }
      ],
      order: [[sortField, sortOrder]],
      limit,
      offset
    });

    // Calculate summary (for filtered results)
    const allDonations = await Donation.findAll({
      where: whereClause,
      attributes: ['amount', 'processing_fee', 'platform_fee', 'payment_status']
    });

    const paidDonations = allDonations.filter((d: any) => d.payment_status === 'paid');
    const totalRaised = paidDonations.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0);
    const totalProcessingFees = paidDonations.reduce((sum: number, d: any) => sum + parseFloat(d.processing_fee || 0), 0);
    const totalPlatformFees = paidDonations.reduce((sum: number, d: any) => sum + parseFloat(d.platform_fee || 0), 0);
    const netAmount = totalRaised - totalProcessingFees;

    res.json({
      donations,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      summary: {
        totalDonations: paidDonations.length,
        totalRaised,
        totalProcessingFees,
        totalPlatformFees,
        netAmount
      }
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
};

/**
 * Get donation summary for a fundraiser
 */
export const getDonationSummary = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { fundraiser_id } = req.query;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    // Build where clause for fundraiser
    let fundraiserWhere: any = { brand_id: brandId };
    if (fundraiser_id) {
      fundraiserWhere.id = fundraiser_id;
    }

    const fundraisers = await Fundraiser.findAll({
      where: fundraiserWhere,
      attributes: ['id']
    });

    const fundraiserIds = fundraisers.map(f => f.id);

    // Get all paid donations
    const donations = await Donation.findAll({
      where: {
        fundraiser_id: { [Op.in]: fundraiserIds },
        payment_status: 'paid'
      },
      attributes: ['amount', 'processing_fee']
    });

    const totalRaised = donations.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0);
    const totalProcessingFees = donations.reduce((sum: number, d: any) => sum + parseFloat(d.processing_fee || 0), 0);
    const netAmount = totalRaised - totalProcessingFees;
    const totalDonations = donations.length;

    res.json({
      summary: {
        totalDonations,
        totalRaised,
        totalProcessingFees,
        netAmount
      }
    });
  } catch (error) {
    console.error('Error fetching donation summary:', error);
    res.status(500).json({ error: 'Failed to fetch donation summary' });
  }
};
