import { Request, Response } from 'express';
import { Release, Artist, ReleaseArtist, Brand, Earning, RecuperableExpense } from '../models';

interface AuthRequest extends Request {
  user?: any;
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

    const release = await Release.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
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

    const {
      title,
      catalog_no,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status,
      artists // Array of { artist_id, royalty_percentages }
    } = req.body;

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
      brand_id: req.user.brand_id
    });

    // Add artist associations if provided
    if (artists && Array.isArray(artists)) {
      for (const artistData of artists) {
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
    const {
      title,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status,
      artists // Array of { artist_id, royalty_percentages } for updating splits
    } = req.body;

    const release = await Release.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    await release.update({
      title: title || release.title,
      UPC,
      spotify_link,
      apple_music_link,
      youtube_link,
      release_date,
      status: status || release.status
    });

    // Update artist royalty splits if provided
    if (artists && Array.isArray(artists)) {
      // Validate that royalty percentages add up correctly
      const totalStreamingRoyalty = artists.reduce((sum, artist) => 
        sum + (artist.streaming_royalty_percentage || 0), 0);
      
      if (totalStreamingRoyalty > 1.0) {
        return res.status(400).json({ 
          error: 'Total streaming royalty percentages cannot exceed 100%' 
        });
      }

      // Remove existing artist associations
      await ReleaseArtist.destroy({
        where: { release_id: id }
      });

      // Add updated artist associations
      for (const artistData of artists) {
        await ReleaseArtist.create({
          release_id: id,
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

    const release = await Release.findOne({
      where: { 
        id,
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

    const release = await Release.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const earnings = await Earning.findAll({
      where: { release_id: id },
      order: [['date_recorded', 'DESC']]
    });

    const totalEarnings = earnings.reduce((sum, earning) => sum + (earning.amount || 0), 0);

    res.json({
      release_id: id,
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

    const release = await Release.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const expenses = await RecuperableExpense.findAll({
      where: { release_id: id },
      order: [['date_recorded', 'DESC']]
    });

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.expense_amount, 0);

    res.json({
      release_id: id,
      release_title: release.title,
      catalog_no: release.catalog_no,
      total_expenses: totalExpenses,
      expenses
    });
  } catch (error) {
    console.error('Get release expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};