import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { SyncLicensingPitch, SyncLicensingPitchSong, Song, Release, Artist, User, Brand } from '../models';

/**
 * Helper function to fetch songs with releases and artists for a pitch
 */
async function getSongsForPitch(pitchId: number): Promise<any[]> {
  const songs = await Song.findAll({
    include: [
      {
        model: SyncLicensingPitch,
        as: 'pitches',
        where: { id: pitchId },
        attributes: [],
        through: { attributes: [] }
      },
      {
        model: Release,
        as: 'release',
        attributes: ['id', 'title', 'cover_art']
      }
    ]
  });

  // Fetch artists for each song's release separately to avoid nested BelongsToMany issue
  const songsWithArtists = await Promise.all(
    songs.map(async (song) => {
      const songData = song.toJSON() as any;
      if (songData.release) {
        const release = await Release.findByPk(songData.release.id, {
          include: [
            {
              model: Artist,
              as: 'artists',
              attributes: ['id', 'name'],
              through: { attributes: [] }
            }
          ]
        });
        if (release) {
          songData.release.artists = (release as any).artists || [];
        }
      }
      return songData;
    })
  );

  return songsWithArtists;
}

/**
 * Helper function to enrich a pitch with songs
 */
async function enrichPitchWithSongs(pitch: any): Promise<any> {
  const pitchData = pitch.toJSON ? pitch.toJSON() : pitch;
  pitchData.songs = await getSongsForPitch(pitchData.id);
  return pitchData;
}

/**
 * Get all sync licensing pitches for the current brand
 */
export const getPitches = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    // Get pitches with creator only
    const { count, rows: pitches } = await SyncLicensingPitch.findAndCountAll({
      where: { brand_id: brandId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'username']
        }
      ]
    });

    // Fetch songs for each pitch separately
    const pitchesWithSongs = await Promise.all(
      pitches.map(pitch => enrichPitchWithSongs(pitch))
    );

    res.json({
      pitches: pitchesWithSongs,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sync licensing pitches:', error);
    res.status(500).json({ error: 'Failed to fetch sync licensing pitches' });
  }
};

/**
 * Get a single sync licensing pitch by ID
 */
export const getPitch = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'username']
        }
      ]
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    const pitchWithSongs = await enrichPitchWithSongs(pitch);
    res.json({ pitch: pitchWithSongs });
  } catch (error) {
    console.error('Error fetching sync licensing pitch:', error);
    res.status(500).json({ error: 'Failed to fetch sync licensing pitch' });
  }
};

/**
 * Create a new sync licensing pitch
 */
export const createPitch = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const userId = (req as any).user?.id;
    const { title, description, song_ids } = req.body;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Create the pitch
    const pitch = await SyncLicensingPitch.create({
      brand_id: brandId,
      title: title.trim(),
      description: description?.trim() || null,
      created_by: userId
    });

    // Add songs if provided
    if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
      // Verify all songs belong to this brand
      const songs = await Song.findAll({
        where: {
          id: song_ids,
          brand_id: brandId
        }
      });

      if (songs.length !== song_ids.length) {
        // Some songs don't belong to this brand or don't exist
        await pitch.destroy();
        return res.status(400).json({ error: 'One or more songs are invalid' });
      }

      // Create pitch-song associations
      const pitchSongs = song_ids.map((songId: number) => ({
        pitch_id: pitch.id,
        song_id: songId
      }));
      await SyncLicensingPitchSong.bulkCreate(pitchSongs);
    }

    // Fetch the complete pitch with associations
    const completePitch = await SyncLicensingPitch.findByPk(pitch.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'username']
        }
      ]
    });

    const pitchWithSongs = await enrichPitchWithSongs(completePitch);
    res.status(201).json({ pitch: pitchWithSongs });
  } catch (error) {
    console.error('Error creating sync licensing pitch:', error);
    res.status(500).json({ error: 'Failed to create sync licensing pitch' });
  }
};

/**
 * Update a sync licensing pitch
 */
export const updatePitch = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);
    const { title, description, song_ids } = req.body;

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId }
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Update basic fields
    if (title !== undefined) {
      if (title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      pitch.title = title.trim();
    }
    if (description !== undefined) {
      pitch.description = description?.trim() || null;
    }

    await pitch.save();

    // Update songs if provided
    if (song_ids !== undefined && Array.isArray(song_ids)) {
      // Verify all songs belong to this brand
      if (song_ids.length > 0) {
        const songs = await Song.findAll({
          where: {
            id: song_ids,
            brand_id: brandId
          }
        });

        if (songs.length !== song_ids.length) {
          return res.status(400).json({ error: 'One or more songs are invalid' });
        }
      }

      // Remove existing associations
      await SyncLicensingPitchSong.destroy({
        where: { pitch_id: pitchId }
      });

      // Create new associations
      if (song_ids.length > 0) {
        const pitchSongs = song_ids.map((songId: number) => ({
          pitch_id: pitchId,
          song_id: songId
        }));
        await SyncLicensingPitchSong.bulkCreate(pitchSongs);
      }
    }

    // Fetch the complete pitch with associations
    const completePitch = await SyncLicensingPitch.findByPk(pitchId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'username']
        }
      ]
    });

    const pitchWithSongs = await enrichPitchWithSongs(completePitch);
    res.json({ pitch: pitchWithSongs });
  } catch (error) {
    console.error('Error updating sync licensing pitch:', error);
    res.status(500).json({ error: 'Failed to update sync licensing pitch' });
  }
};

/**
 * Delete a sync licensing pitch
 */
export const deletePitch = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId }
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Delete associated songs first (cascade)
    await SyncLicensingPitchSong.destroy({
      where: { pitch_id: pitchId }
    });

    // Delete the pitch
    await pitch.destroy();

    res.json({ message: 'Pitch deleted successfully' });
  } catch (error) {
    console.error('Error deleting sync licensing pitch:', error);
    res.status(500).json({ error: 'Failed to delete sync licensing pitch' });
  }
};

/**
 * Search songs for adding to a pitch
 */
export const searchSongs = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const search = req.query.search as string || '';
    const limit = parseInt(req.query.limit as string) || 20;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const whereClause: any = { brand_id: brandId };

    if (search.trim()) {
      whereClause.title = { [Op.like]: `%${search.trim()}%` };
    }

    const songs = await Song.findAll({
      where: whereClause,
      limit,
      order: [['title', 'ASC']],
      include: [
        {
          model: Release,
          as: 'release',
          attributes: ['id', 'title', 'cover_art']
        }
      ]
    });

    // Fetch artists for each song's release separately
    const songsWithArtists = await Promise.all(
      songs.map(async (song) => {
        const songData = song.toJSON() as any;
        if (songData.release) {
          const release = await Release.findByPk(songData.release.id, {
            include: [
              {
                model: Artist,
                as: 'artists',
                attributes: ['id', 'name'],
                through: { attributes: [] }
              }
            ]
          });
          if (release) {
            songData.release.artists = (release as any).artists || [];
          }
        }
        return songData;
      })
    );

    res.json({ songs: songsWithArtists });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
};
