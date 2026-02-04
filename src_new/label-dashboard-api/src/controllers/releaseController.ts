import { Request, Response } from 'express';
import { Release, Artist, ReleaseArtist, Brand, Earning, RecuperableExpense, Song, SongCollaborator, SongAuthor, SongComposer, Songwriter, ArtistAccess, User, Royalty } from '../models';
import path from 'path';
import archiver from 'archiver';
import { sendReleaseSubmissionNotification, sendReleasePendingNotification } from '../utils/emailService';
import { uploadToS3, deleteFromS3, headS3Object, getS3ObjectStream } from '../utils/s3Service';

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
    const releaseId = parseInt(id as string, 10);
    
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
        { 
          model: Song, 
          as: 'songs',
          include: [
            {
              model: SongCollaborator,
              as: 'collaborators',
              include: [{ model: Artist, as: 'artist' }]
            },
            {
              model: SongAuthor,
              as: 'authors',
              include: [{ model: Songwriter, as: 'songwriter' }]
            },
            {
              model: SongComposer,
              as: 'composers',
              include: [{ model: Songwriter, as: 'songwriter' }]
            }
          ],
          order: [['track_number', 'ASC']]
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
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    let {
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

    // Auto-generate catalog number for non-admins if not provided
    if (!catalog_no) {
      if (!req.user.is_admin) {
        // Generate catalog number for non-admin submissions
        const lastRelease = await Release.findOne({
          where: { brand_id: req.user.brand_id },
          order: [['id', 'DESC']]
        });

        let nextNumber = 1;
        if (lastRelease && lastRelease.catalog_no) {
          const match = lastRelease.catalog_no.match(/(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }

        catalog_no = `TBD${String(nextNumber).padStart(3, '0')}`;
      } else {
        return res.status(400).json({ error: 'Catalog number is required for admin' });
      }
    }

    // Check if catalog number already exists
    const existingRelease = await Release.findOne({
      where: { catalog_no }
    });

    if (existingRelease) {
      return res.status(409).json({ error: 'Catalog number already exists' });
    }

    // Handle cover art file upload to S3
    let coverArtUrl = null;
    if (req.file) {
      try {
        // Generate unique filename for S3
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(req.file.originalname);
        const fileName = `cover-art/${catalog_no}-${uniqueSuffix}${extension}`;

        // Upload to S3
        const result = await uploadToS3({
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        });
        coverArtUrl = result.Location;
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload cover art' });
      }
    }

    // Set default status based on user role
    if (!status) {
      status = req.user.is_admin ? 'Pending' : 'Draft';
    }

    const release = await Release.create({
      title,
      catalog_no,
      UPC: req.user.is_admin ? UPC : null,
      spotify_link: req.user.is_admin ? spotify_link : null,
      apple_music_link: req.user.is_admin ? apple_music_link : null,
      youtube_link: req.user.is_admin ? youtube_link : null,
      release_date,
      status,
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
        // For admins, use provided royalty percentages; for non-admins, ignore them and use 0
        const royaltyData = req.user.is_admin ? {
          streaming_royalty_percentage: artistData.streaming_royalty_percentage || 0.5,
          streaming_royalty_type: artistData.streaming_royalty_type || 'Revenue',
          sync_royalty_percentage: artistData.sync_royalty_percentage || 0.5,
          sync_royalty_type: artistData.sync_royalty_type || 'Revenue',
          download_royalty_percentage: artistData.download_royalty_percentage || 0.5,
          download_royalty_type: artistData.download_royalty_type || 'Revenue',
          physical_royalty_percentage: artistData.physical_royalty_percentage || 0.2,
          physical_royalty_type: artistData.physical_royalty_type || 'Revenue'
        } : {
          streaming_royalty_percentage: 0,
          streaming_royalty_type: 'Revenue',
          sync_royalty_percentage: 0,
          sync_royalty_type: 'Revenue',
          download_royalty_percentage: 0,
          download_royalty_type: 'Revenue',
          physical_royalty_percentage: 0,
          physical_royalty_type: 'Revenue'
        };

        await ReleaseArtist.create({
          release_id: release.id,
          artist_id: artistData.artist_id,
          ...royaltyData
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
    const releaseId = parseInt(id as string, 10);
    
    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
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
        const result = await uploadToS3({
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        });
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

    // Save original status before update for email notification check
    const originalStatus = release.status;

    // Delete old cover art from S3 if new one is uploaded
    if (coverArtUrl && release.cover_art && release.cover_art.startsWith('https://')) {
      try {
        const oldUrl = new URL(release.cover_art);
        const oldKey = oldUrl.pathname.substring(1);
        
        await deleteFromS3({
          Bucket: process.env.S3_BUCKET!,
          Key: oldKey
        });
      } catch (deleteError) {
        console.error('Error deleting old cover art:', deleteError);
      }
    }

    // Prepare update data based on user role
    const updateData: any = {
      title: title || release.title,
      release_date: release_date !== undefined ? release_date : release.release_date,
      cover_art: coverArtUrl || release.cover_art,
      description: description !== undefined ? description : release.description,
      liner_notes: liner_notes !== undefined ? liner_notes : release.liner_notes
    };

    // Only allow admins to update these fields
    if (req.user.is_admin) {
      updateData.catalog_no = catalog_no !== undefined ? catalog_no : release.catalog_no;
      updateData.UPC = UPC !== undefined ? UPC : release.UPC;
      updateData.spotify_link = spotify_link !== undefined ? spotify_link : release.spotify_link;
      updateData.apple_music_link = apple_music_link !== undefined ? apple_music_link : release.apple_music_link;
      updateData.youtube_link = youtube_link !== undefined ? youtube_link : release.youtube_link;
      updateData.status = status || release.status;
    } else {
      // Allow non-admins to submit drafts for review
      if (status === 'For Submission' && release.status === 'Draft') {
        updateData.status = 'For Submission';
      }
    }

    await release.update(updateData);

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
    const updatedRelease = await Release.findByPk(id as string, {
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

    // Send email notification if release was submitted for review
    if (originalStatus === 'Draft' && updateData.status === 'For Submission') {
      try {
        // Get track count for the notification
        const trackCount = await Song.count({
          where: { release_id: release.id }
        });

        // Get artist names from the updated release
        const artistNames = updatedRelease?.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

        // Send notification to admins
        await sendReleaseSubmissionNotification(
          {
            title: updatedRelease!.title,
            catalog_no: updatedRelease!.catalog_no,
            release_date: updatedRelease!.release_date.toString(),
            track_count: trackCount
          },
          artistNames,
          req.user.brand_id
        );
      } catch (emailError) {
        console.error('Error sending release submission notification:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send email notification to artist team members if release status changed to Pending
    if (originalStatus !== 'Pending' && updateData.status === 'Pending') {
      try {
        // Get track count for the notification
        const trackCount = await Song.count({
          where: { release_id: release.id }
        });

        // Get artist names from the updated release
        const artistNames = updatedRelease?.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

        // Get all artist IDs associated with this release
        const artistIds = updatedRelease?.artists?.map((a: any) => a.id) || [];

        // Get all team members for all artists on this release
        const artistAccessRecords = await ArtistAccess.findAll({
          where: {
            artist_id: artistIds,
            status: 'Accepted'
          },
          include: [{ model: User, as: 'user' }]
        });

        // Get unique team member emails
        const teamEmails = [...new Set(
          artistAccessRecords
            .filter(access => (access as any).user?.email_address)
            .map(access => (access as any).user!.email_address)
        )];

        // Send notification to team members
        await sendReleasePendingNotification(
          {
            id: updatedRelease!.id,
            title: updatedRelease!.title,
            catalog_no: updatedRelease!.catalog_no,
            release_date: updatedRelease!.release_date.toString(),
            track_count: trackCount
          },
          artistNames,
          teamEmails,
          req.user.brand_id
        );
      } catch (emailError) {
        console.error('Error sending release pending notification:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      message: 'Release updated successfully',
      release: updatedRelease
    });
  } catch (error) {
    console.error('Update release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Toggle release exclude from EPK
export const toggleReleaseExcludeFromEPK = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);

    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    // Find release and verify brand access
    const release = await Release.findOne({
      where: { 
        id: releaseId,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Toggle the exclude_from_epk flag
    await release.update({ 
      exclude_from_epk: !release.exclude_from_epk 
    });

    res.json({
      success: true,
      exclude_from_epk: release.exclude_from_epk,
      message: release.exclude_from_epk ? 'Release excluded from EPK' : 'Release included in EPK'
    });
  } catch (error) {
    console.error('Toggle release exclude from EPK error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteRelease = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);

    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    const release = await Release.findOne({
      where: {
        id: releaseId,
        brand_id: req.user.brand_id
      },
      include: [
        { model: Song, as: 'songs' }
      ]
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Only allow deletion of Draft releases
    if (release.status !== 'Draft') {
      return res.status(400).json({ error: 'Only Draft releases can be deleted' });
    }

    // Delete related records in correct order to avoid foreign key constraint errors
    // 1. Delete song-related records (SongCollaborator, SongAuthor, SongComposer)
    const songIds = release.songs?.map((song: any) => song.id) || [];
    if (songIds.length > 0) {
      await SongCollaborator.destroy({ where: { song_id: songIds } });
      await SongAuthor.destroy({ where: { song_id: songIds } });
      await SongComposer.destroy({ where: { song_id: songIds } });
    }

    // 2. Delete songs
    await Song.destroy({ where: { release_id: releaseId } });

    // 3. Delete royalties linked to earnings of this release
    const earnings = await Earning.findAll({ where: { release_id: releaseId } });
    const earningIds = earnings.map((e: any) => e.id);
    if (earningIds.length > 0) {
      await Royalty.destroy({ where: { earning_id: earningIds } });
    }

    // 4. Delete royalties directly linked to this release
    await Royalty.destroy({ where: { release_id: releaseId } });

    // 5. Delete earnings
    await Earning.destroy({ where: { release_id: releaseId } });

    // 6. Delete recuperable expenses
    await RecuperableExpense.destroy({ where: { release_id: releaseId } });

    // 7. Delete release-artist associations
    await ReleaseArtist.destroy({ where: { release_id: releaseId } });

    // 8. Finally, delete the release itself
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
    const releaseId = parseInt(id as string, 10);
    
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
    const releaseId = parseInt(id as string, 10);
    
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
    const releaseId = parseInt(id as string, 10);
    
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

// Download masters (cover art + audio files) as a zip
export const downloadMasters = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.brand_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required environment variables
    if (!process.env.S3_BUCKET || !process.env.S3_BUCKET_MASTERS) {
      console.error('Missing required S3 environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { id } = req.params;
    const releaseId = parseInt(id as string, 10);

    if (isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    // Get release with songs and artists
    const release = await Release.findOne({
      where: {
        id: releaseId,
        brand_id: req.user.brand_id
      },
      include: [
        {
          model: Song,
          as: 'songs',
          where: { audio_file: { [require('sequelize').Op.ne]: null } },
          required: false
        },
        {
          model: Artist,
          as: 'artists'
        }
      ],
      order: [[{ model: Song, as: 'songs' }, 'track_number', 'ASC']]
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const songs = (release as any).songs || [];
    const artists = (release as any).artists || [];

    // Check if there are any audio files to download
    if (songs.length === 0 && !release.cover_art) {
      return res.status(404).json({ error: 'No masters available for this release' });
    }

    // Create zip filename: "catalog_no - artist name - release title"
    const artistName = artists.length > 0 ? artists[0].name : 'Unknown Artist';
    const rawFileName = `${release.catalog_no} - ${artistName} - ${release.title}`;

    // Sanitize filename for ASCII compatibility (remove special chars, keep safe ones)
    let sanitizedFileName = rawFileName
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Fallback if sanitization produces an empty filename
    if (!sanitizedFileName || sanitizedFileName.length === 0) {
      sanitizedFileName = `release-${releaseId}`;
    }

    sanitizedFileName += '.zip';

    // Escape double quotes in filename to prevent header injection
    const escapedFileName = sanitizedFileName.replace(/"/g, '\\"');

    // Use RFC 5987 encoding for better international character support
    const encodedFileName = encodeURIComponent(rawFileName + '.zip');

    // Set response headers for zip download with both ASCII and UTF-8 encoded filenames
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${escapedFileName}"; filename*=UTF-8''${encodedFileName}`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 6 } // Default compression - audio files don't compress well
    });

    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip file' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add cover art if available
    if (release.cover_art && release.cover_art.startsWith('https://')) {
      try {
        const coverArtUrl = new URL(release.cover_art);
        const coverArtKey = coverArtUrl.pathname.substring(1);

        // Get file extension from URL
        const coverArtExtension = path.extname(coverArtKey) || '.jpg';
        const coverArtFileName = `cover${coverArtExtension}`;

        // Validate file exists in S3 before streaming
        await headS3Object({
          Bucket: process.env.S3_BUCKET!,
          Key: coverArtKey
        });

        // File exists, now create stream and add to zip
        const coverArtResult = await getS3ObjectStream({
          Bucket: process.env.S3_BUCKET!,
          Key: coverArtKey
        });

        archive.append(coverArtResult.Body, { name: coverArtFileName });
      } catch (error) {
        console.error('Error adding cover art to zip:', error);
        // Continue without cover art - file doesn't exist or access denied
      }
    }

    // Add audio files
    for (const song of songs) {
      if (song.audio_file) {
        try {
          // Get file extension
          const audioExtension = path.extname(song.audio_file) || '.wav';

          // Create filename: "Artist - Album - 01 - Song Title.wav"
          const trackNumberPadded = String(song.track_number).padStart(2, '0');
          const audioFileName = `${artistName} - ${release.title} - ${trackNumberPadded} - ${song.title}${audioExtension}`
            .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Validate file exists in S3 before streaming
          await headS3Object({
            Bucket: process.env.S3_BUCKET_MASTERS!,
            Key: song.audio_file
          });

          // File exists, now create stream and add to zip
          const audioResult = await getS3ObjectStream({
            Bucket: process.env.S3_BUCKET_MASTERS!,
            Key: song.audio_file
          });

          archive.append(audioResult.Body, { name: audioFileName });
        } catch (error) {
          console.error(`Error adding song ${song.id} to zip:`, error);
          // Continue with other songs - file doesn't exist or access denied
        }
      }
    }

    // Finalize the archive
    await archive.finalize();

  } catch (error) {
    console.error('Download masters error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};