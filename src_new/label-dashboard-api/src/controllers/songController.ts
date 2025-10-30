import { Request, Response } from 'express';
import { Song, SongCollaborator, SongAuthor, SongComposer, Artist, Release } from '../models';
import AWS from 'aws-sdk';

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

// Get all songs for a release
export const getSongsByRelease = async (req: AuthRequest, res: Response) => {
  try {
    const { releaseId } = req.params;

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

    const songs = await Song.findAll({
      where: { release_id: releaseId },
      include: [
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist' }]
        },
        { model: SongAuthor, as: 'authors' },
        { model: SongComposer, as: 'composers' }
      ],
      order: [['track_number', 'ASC']]
    });

    res.json({ songs });
  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a single song
export const getSong = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const song = await Song.findByPk(id, {
      include: [
        {
          model: Release,
          as: 'release',
          where: { brand_id: req.user.brand_id }
        },
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist' }]
        },
        { model: SongAuthor, as: 'authors' },
        { model: SongComposer, as: 'composers' }
      ]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json({ song });
  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new song
export const createSong = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      release_id,
      title,
      duration,
      lyrics,
      isrc,
      spotify_link,
      apple_music_link,
      youtube_link,
      collaborators,
      authors,
      composers
    } = req.body;

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

    // Get the highest track number for this release and increment
    const maxTrackSong = await Song.findOne({
      where: { release_id },
      order: [['track_number', 'DESC']],
      attributes: ['track_number']
    });

    const nextTrackNumber = maxTrackSong?.track_number ? maxTrackSong.track_number + 1 : 1;

    // Create song
    const song = await Song.create({
      release_id,
      title,
      track_number: nextTrackNumber,
      duration,
      lyrics,
      isrc,
      spotify_link,
      apple_music_link,
      youtube_link
    });

    // Add collaborators if provided
    if (collaborators && Array.isArray(collaborators)) {
      for (const collab of collaborators) {
        await SongCollaborator.create({
          song_id: song.id,
          artist_id: collab.artist_id,
          role: collab.role
        });
      }
    }

    // Add authors if provided
    if (authors && Array.isArray(authors)) {
      for (const author of authors) {
        await SongAuthor.create({
          song_id: song.id,
          name: author.name,
          pro_affiliation: author.pro_affiliation,
          ipi_number: author.ipi_number,
          share_percentage: author.share_percentage
        });
      }
    }

    // Add composers if provided
    if (composers && Array.isArray(composers)) {
      for (const composer of composers) {
        await SongComposer.create({
          song_id: song.id,
          name: composer.name,
          pro_affiliation: composer.pro_affiliation,
          ipi_number: composer.ipi_number,
          share_percentage: composer.share_percentage
        });
      }
    }

    // Fetch complete song with associations
    const completeSong = await Song.findByPk(song.id, {
      include: [
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist' }]
        },
        { model: SongAuthor, as: 'authors' },
        { model: SongComposer, as: 'composers' }
      ]
    });

    res.status(201).json({ song: completeSong });
  } catch (error) {
    console.error('Create song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a song
export const updateSong = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const {
      title,
      track_number,
      duration,
      lyrics,
      isrc,
      spotify_link,
      apple_music_link,
      youtube_link,
      collaborators,
      authors,
      composers
    } = req.body;

    // Find song and verify brand ownership
    const song = await Song.findByPk(id, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Update song fields
    await song.update({
      title,
      track_number,
      duration,
      lyrics,
      isrc,
      spotify_link,
      apple_music_link,
      youtube_link
    });

    // Update collaborators if provided
    if (collaborators !== undefined) {
      // Delete existing collaborators
      await SongCollaborator.destroy({ where: { song_id: id } });

      // Add new collaborators
      if (Array.isArray(collaborators)) {
        for (const collab of collaborators) {
          await SongCollaborator.create({
            song_id: id,
            artist_id: collab.artist_id,
            role: collab.role
          });
        }
      }
    }

    // Update authors if provided
    if (authors !== undefined) {
      // Delete existing authors
      await SongAuthor.destroy({ where: { song_id: id } });

      // Add new authors
      if (Array.isArray(authors)) {
        for (const author of authors) {
          await SongAuthor.create({
            song_id: id,
            name: author.name,
            pro_affiliation: author.pro_affiliation,
            ipi_number: author.ipi_number,
            share_percentage: author.share_percentage
          });
        }
      }
    }

    // Update composers if provided
    if (composers !== undefined) {
      // Delete existing composers
      await SongComposer.destroy({ where: { song_id: id } });

      // Add new composers
      if (Array.isArray(composers)) {
        for (const composer of composers) {
          await SongComposer.create({
            song_id: id,
            name: composer.name,
            pro_affiliation: composer.pro_affiliation,
            ipi_number: composer.ipi_number,
            share_percentage: composer.share_percentage
          });
        }
      }
    }

    // Fetch updated song with associations
    const updatedSong = await Song.findByPk(id, {
      include: [
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist' }]
        },
        { model: SongAuthor, as: 'authors' },
        { model: SongComposer, as: 'composers' }
      ]
    });

    res.json({ song: updatedSong });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a song
export const deleteSong = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Find song and verify brand ownership
    const song = await Song.findByPk(id, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Delete audio file from S3 if exists
    if (song.audio_file) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET || '',
          Key: song.audio_file
        }).promise();
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
      }
    }

    // Delete song (cascading will delete related records)
    await song.destroy();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reorder songs (update track numbers)
export const reorderSongs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { releaseId } = req.params;
    const { songOrder } = req.body; // Array of song IDs in desired order

    if (!Array.isArray(songOrder)) {
      return res.status(400).json({ error: 'songOrder must be an array' });
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

    // Update track numbers for each song
    for (let i = 0; i < songOrder.length; i++) {
      const songId = songOrder[i];
      await Song.update(
        { track_number: i + 1 },
        {
          where: {
            id: songId,
            release_id: releaseId
          }
        }
      );
    }

    // Fetch updated songs
    const songs = await Song.findAll({
      where: { release_id: releaseId },
      include: [
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist' }]
        },
        { model: SongAuthor, as: 'authors' },
        { model: SongComposer, as: 'composers' }
      ],
      order: [['track_number', 'ASC']]
    });

    res.json({ songs });
  } catch (error) {
    console.error('Reorder songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload audio file for a song
export const uploadAudio = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Find song and verify brand ownership
    const song = await Song.findByPk(id, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Delete old audio file if exists
    if (song.audio_file) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET || '',
          Key: song.audio_file
        }).promise();
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
      }
    }

    // Upload new file to S3
    const fileName = `songs/${Date.now()}-${req.file.originalname}`;
    await s3.upload({
      Bucket: process.env.S3_BUCKET || '',
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'private'
    }).promise();

    // Update song with new audio file path
    await song.update({ audio_file: fileName });

    res.json({
      message: 'Audio file uploaded successfully',
      audio_file: fileName
    });
  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
