import { Request, Response } from 'express';
import { Release, Artist, ReleaseArtist, Brand, Earning, RecuperableExpense, sequelize } from '../models';
import AWS from 'aws-sdk';
import path from 'path';

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const s3 = new AWS.S3();

interface AuthRequest extends Request {
  user?: any;
  file?: Express.Multer.File;
}

export const getReleases = async (req: AuthRequest, res: Response) => {
  try {
    const releases = await Release.findAll({
      where: { brand_id: req.user.brand_id },
      include: [
        { model: Brand, as: 'brand' },
        { 
          model: Artist, 
          as: 'artists',
          through: { attributes: ['streaming_royalty_percentage', 'sync_royalty_percentage'] }
        },
        { model: Earning, as: 'earnings' },
        { model: RecuperableExpense, as: 'expenses' }
      ],
      order: [['release_date', 'DESC']]
    });

    res.json({ releases });
  } catch (error) {
    console.error('Get releases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRelease = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      },
      attributes: [
        'id', 'title', 'catalog_no', 'UPC', 'spotify_link', 'apple_music_link', 
        'youtube_link', 'release_date', 'status', 'cover_art', 'description', 
        'liner_notes', 'brand_id'
      ],
      include: [
        { model: Brand, as: 'brand' },
        { 
          model: Artist, 
          as: 'artists',
          through: { 
            attributes: [
              'streaming_royalty_percentage', 
              'streaming_royalty_type',
              'sync_royalty_percentage', 
              'sync_royalty_type',
              'download_royalty_percentage', 
              'download_royalty_type',
              'physical_royalty_percentage', 
              'physical_royalty_type'
            ] 
          }
        },
        { model: Earning, as: 'earnings' },
        { model: RecuperableExpense, as: 'expenses' }
      ]
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    res.json({ release });
  } catch (error) {
    console.error('Get release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRelease = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const {
      title,
      catalog_no,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status,
      description,
      liner_notes,
      artists // Array of { artist_id, royalty_percentages }
    } = req.body;

    // Handle cover art file upload to S3
    let coverArtUrl = null;
    if (req.file) {
      try {
        // Generate unique filename for S3
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(req.file.originalname);
        const fileName = `cover-art/${catalog_no}-${uniqueSuffix}${extension}`;
        
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };
        
        const result = await s3.upload(uploadParams).promise();
        coverArtUrl = result.Location;
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload cover art' });
      }
    }

    if (!catalog_no) {
      return res.status(400).json({ error: 'Catalog number is required' });
    }

    // Check if catalog number already exists
    const existingRelease = await Release.findOne({
      where: { catalog_no }
    });

    if (existingRelease) {
      return res.status(409).json({ error: 'Catalog number already exists' });
    }

    const release = await Release.create({
      title,
      catalog_no,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status: status || 'Pending',
      cover_art: coverArtUrl,
      description,
      liner_notes,
      brand_id: req.user.brand_id
    });

    // Add artist associations if provided
    let parsedArtists = artists;
    if (typeof artists === 'string') {
      try {
        parsedArtists = JSON.parse(artists);
      } catch (error) {
        parsedArtists = null;
      }
    }

    if (parsedArtists && Array.isArray(parsedArtists)) {
      for (const artistData of parsedArtists) {
        await ReleaseArtist.create({
          release_id: release.id,
          artist_id: artistData.artist_id,
          streaming_royalty_percentage: artistData.streaming_royalty_percentage || 0.5,
          streaming_royalty_type: artistData.streaming_royalty_type || 'Revenue',
          sync_royalty_percentage: artistData.sync_royalty_percentage || 0.5,
          sync_royalty_type: artistData.sync_royalty_type || 'Revenue',
          download_royalty_percentage: artistData.download_royalty_percentage || 0.5,
          download_royalty_type: artistData.download_royalty_type || 'Revenue',
          physical_royalty_percentage: artistData.physical_royalty_percentage || 0.2,
          physical_royalty_type: artistData.physical_royalty_type || 'Revenue'
        });
      }
    }

    // Fetch the complete release with associations
    const completeRelease = await Release.findByPk(release.id, {
      include: [
        { 
          model: Artist, 
          as: 'artists',
          through: { attributes: ['streaming_royalty_percentage', 'sync_royalty_percentage'] }
        }
      ]
    });

    res.status(201).json({
      message: 'Release created successfully',
      release: completeRelease
    });
  } catch (error) {
    console.error('Create release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateRelease = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const {
      title,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status,
      description,
      liner_notes,
      artists // Array of { artist_id, royalty_percentages } for updating splits
    } = req.body;

    // Handle cover art file upload to S3
    let coverArtUrl = null;
    if (req.file) {
      try {
        // Generate unique filename for S3
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(req.file.originalname);
        const fileName = `cover-art/${releaseId}-${uniqueSuffix}${extension}`;
        
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };
        
        const result = await s3.upload(uploadParams).promise();
        coverArtUrl = result.Location;
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload cover art' });
      }
    }

    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Delete old cover art from S3 if new one is uploaded
    if (coverArtUrl && release.cover_art && release.cover_art.startsWith('https://')) {
      try {
        const oldUrl = new URL(release.cover_art);
        const oldKey = oldUrl.pathname.substring(1);
        
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET!,
          Key: oldKey
        }).promise();
      } catch (deleteError) {
        console.error('Error deleting old cover art:', deleteError);
      }
    }

    await release.update({
      title: title || release.title,
      UPC: UPC !== undefined ? UPC : release.UPC,
      spotify_link: spotify_link !== undefined ? spotify_link : release.spotify_link,
      apple_music_link: apple_music_link !== undefined ? apple_music_link : release.apple_music_link,
      youtube_link: youtube_link !== undefined ? youtube_link : release.youtube_link,
      release_date: release_date !== undefined ? release_date : release.release_date,
      status: status || release.status,
      cover_art: coverArtUrl || release.cover_art,
      description: description !== undefined ? description : release.description,
      liner_notes: liner_notes !== undefined ? liner_notes : release.liner_notes
    });

    // Update artist royalty splits if provided
    let parsedArtists = artists;
    if (typeof artists === 'string') {
      try {
        parsedArtists = JSON.parse(artists);
      } catch (error) {
        parsedArtists = null;
      }
    }

    if (parsedArtists && Array.isArray(parsedArtists)) {
      // Validate that royalty percentages add up correctly
      const totalStreamingRoyalty = parsedArtists.reduce((sum, artist) => 
        sum + (artist.streaming_royalty_percentage || 0), 0);
      
      if (totalStreamingRoyalty > 1.0) {
        return res.status(400).json({ 
          error: 'Total streaming royalty percentages cannot exceed 100%' 
        });
      }

      // Remove existing artist associations
      await ReleaseArtist.destroy({
        where: { release_id: releaseId }
      });

      // Add updated artist associations
      for (const artistData of parsedArtists) {
        await ReleaseArtist.create({
          release_id: releaseId,
          artist_id: artistData.artist_id,
          streaming_royalty_percentage: artistData.streaming_royalty_percentage || 0.5,
          streaming_royalty_type: artistData.streaming_royalty_type || 'Revenue',
          sync_royalty_percentage: artistData.sync_royalty_percentage || 0.5,
          sync_royalty_type: artistData.sync_royalty_type || 'Revenue',
          download_royalty_percentage: artistData.download_royalty_percentage || 0.5,
          download_royalty_type: artistData.download_royalty_type || 'Revenue',
          physical_royalty_percentage: artistData.physical_royalty_percentage || 0.2,
          physical_royalty_type: artistData.physical_royalty_type || 'Revenue'
        });
      }
    }

    // Fetch updated release with all associations
    const updatedRelease = await Release.findByPk(id, {
      include: [
        { 
          model: Artist, 
          as: 'artists',
          through: { 
            attributes: [
              'streaming_royalty_percentage', 
              'streaming_royalty_type',
              'sync_royalty_percentage', 
              'sync_royalty_type',
              'download_royalty_percentage', 
              'download_royalty_type',
              'physical_royalty_percentage', 
              'physical_royalty_type'
            ] 
          }
        }
      ]
    });

    res.json({
      message: 'Release updated successfully',
      release: updatedRelease
    });
  } catch (error) {
    console.error('Update release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteRelease = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    await release.destroy();

    res.json({ message: 'Release deleted successfully' });
  } catch (error) {
    console.error('Delete release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReleaseEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const earnings = await Earning.findAll({
      where: { release_id: releaseId },
      order: [['date_recorded', 'DESC']]
    });

    const totalEarnings = earnings.reduce((sum, earning) => sum + (earning.amount || 0), 0);

    res.json({
      release_id: releaseId,
      release_title: release.title,
      catalog_no: release.catalog_no,
      total_earnings: totalEarnings,
      earnings
    });
  } catch (error) {
    console.error('Get release earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReleaseExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Get total count for pagination
    const totalCount = await RecuperableExpense.count({
      where: { release_id: releaseId }
    });

    // Get paginated expenses
    const expenses = await RecuperableExpense.findAll({
      where: { release_id: releaseId },
      order: [['date_recorded', 'DESC']],
      limit,
      offset
    });

    const totalExpenses = await RecuperableExpense.sum('expense_amount', {
      where: { release_id: releaseId }
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      release_id: releaseId,
      release_title: release.title,
      catalog_no: release.catalog_no,
      total_expenses: totalExpenses || 0,
      expenses,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get release expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add release expense
export const addReleaseExpense = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const releaseId = parseInt(id, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const { 
      expense_description,
      expense_amount,
      date_recorded
    } = req.body;

    if (!expense_description || !expense_amount) {
      return res.status(400).json({ 
        error: 'Description and amount are required' 
      });
    }

    // Verify release belongs to user's brand
    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const expense = await RecuperableExpense.create({
      release_id: releaseId,
      expense_description,
      expense_amount: parseFloat(expense_amount),
      date_recorded: date_recorded ? new Date(date_recorded) : new Date(),
      brand_id: req.user.brand_id
    });

    res.status(201).json({
      message: 'Recuperable expense added successfully',
      expense
    });
  } catch (error) {
    console.error('Add release expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateCatalogNumber = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    
    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    // Get brand settings to retrieve catalog prefix
    const brand = await Brand.findByPk(brandId);
    const prefix = brand?.catalog_prefix || 'REL';

    // Find all releases with catalog numbers starting with the prefix for this brand
    const releases = await Release.findAll({
      where: {
        brand_id: brandId,
        catalog_no: {
          [require('sequelize').Op.like]: `${prefix}%`
        }
      },
      attributes: ['catalog_no'],
      order: [['catalog_no', 'DESC']]
    });

    let highestNumber = 0;
    
    // Extract numeric parts and find the highest
    for (const release of releases) {
      const catalogNo = release.catalog_no;
      if (catalogNo && catalogNo.startsWith(prefix)) {
        const numericPart = catalogNo.substring(prefix.length);
        const number = parseInt(numericPart, 10);
        if (!isNaN(number) && number > highestNumber) {
          highestNumber = number;
        }
      }
    }

    const nextCatalogNumber = `${prefix}${String(highestNumber + 1).padStart(3, '0')}`;
    
    res.json({ 
      catalog_number: nextCatalogNumber
    });
  } catch (error) {
    console.error('Generate catalog number error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};