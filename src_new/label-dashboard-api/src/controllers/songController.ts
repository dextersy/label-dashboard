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

    // Create song (filter admin-only fields for non-admins)
    const songData: any = {
      release_id,
      title,
      track_number: nextTrackNumber,
      lyrics
    };

    // Only admins can set these fields
    if (req.user.is_admin) {
      songData.duration = duration;
      songData.isrc = isrc;
      songData.spotify_link = spotify_link;
      songData.apple_music_link = apple_music_link;
      songData.youtube_link = youtube_link;
    }

    const song = await Song.create(songData);

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
        const authorData: any = {
          song_id: song.id,
          name: author.name
        };

        // Only admins can set these fields
        if (req.user.is_admin) {
          authorData.pro_affiliation = author.pro_affiliation;
          authorData.ipi_number = author.ipi_number;
          authorData.share_percentage = author.share_percentage;
        }

        await SongAuthor.create(authorData);
      }
    }

    // Add composers if provided
    if (composers && Array.isArray(composers)) {
      for (const composer of composers) {
        const composerData: any = {
          song_id: song.id,
          name: composer.name
        };

        // Only admins can set these fields
        if (req.user.is_admin) {
          composerData.pro_affiliation = composer.pro_affiliation;
          composerData.ipi_number = composer.ipi_number;
          composerData.share_percentage = composer.share_percentage;
        }

        await SongComposer.create(composerData);
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

    // Prepare update data (filter admin-only fields for non-admins)
    const updateData: any = {
      title,
      lyrics
    };

    // Only admins can update these fields
    if (req.user.is_admin) {
      updateData.track_number = track_number;
      updateData.duration = duration;
      updateData.isrc = isrc;
      updateData.spotify_link = spotify_link;
      updateData.apple_music_link = apple_music_link;
      updateData.youtube_link = youtube_link;
    }

    // Update song fields
    await song.update(updateData);

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
          const authorData: any = {
            song_id: id,
            name: author.name
          };

          // Only admins can set these fields
          if (req.user.is_admin) {
            authorData.pro_affiliation = author.pro_affiliation;
            authorData.ipi_number = author.ipi_number;
            authorData.share_percentage = author.share_percentage;
          }

          await SongAuthor.create(authorData);
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
          const composerData: any = {
            song_id: id,
            name: composer.name
          };

          // Only admins can set these fields
          if (req.user.is_admin) {
            composerData.pro_affiliation = composer.pro_affiliation;
            composerData.ipi_number = composer.ipi_number;
            composerData.share_percentage = composer.share_percentage;
          }

          await SongComposer.create(composerData);
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
          Bucket: process.env.S3_BUCKET_MASTERS!,
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
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Find song and verify brand ownership, include release and artists
    const song = await Song.findByPk(id, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id },
        include: [{
          model: Artist,
          as: 'artists'
        }]
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const release = (song as any).release;
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Get artist name (use first artist if multiple)
    const artists = release.artists || [];
    const artistName = artists.length > 0 ? artists[0].name : 'Unknown Artist';
    const releaseTitle = release.title || 'Untitled';
    const catalogNo = release.catalog_no;

    // Create folder name: "catalog_no artist name - release title"
    // Sanitize for filesystem/S3 compatibility
    const folderName = `${catalogNo} ${artistName} - ${releaseTitle}`
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Delete old audio file if exists
    if (song.audio_file) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_MASTERS!,
          Key: song.audio_file
        }).promise();
      } catch (s3Error) {
        console.error('S3 delete error:', s3Error);
      }
    }

    // Upload new file to S3 masters bucket in release-specific folder
    // S3 doesn't require explicit folder creation - it's created automatically
    const fileName = `${folderName}/${Date.now()}-${req.file.originalname}`;
    await s3.upload({
      Bucket: process.env.S3_BUCKET_MASTERS!,
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

// Stream audio file
export const streamAudio = async (req: AuthRequest, res: Response) => {
  try {
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

    if (!song.audio_file) {
      return res.status(404).json({ error: 'No audio file available for this song' });
    }

    // Get audio file from S3
    const params = {
      Bucket: process.env.S3_BUCKET_MASTERS!,
      Key: song.audio_file
    };

    // Get file metadata
    const headData = await s3.headObject(params).promise();
    const fileSize = headData.ContentLength || 0;

    // Set response headers
    res.setHeader('Content-Type', headData.ContentType || 'audio/wav');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = s3.getObject({
        ...params,
        Range: `bytes=${start}-${end}`
      }).createReadStream();

      stream.pipe(res);
    } else {
      // Stream entire file
      const stream = s3.getObject(params).createReadStream();
      stream.pipe(res);
    }

    // Handle stream errors
    res.on('error', (error) => {
      console.error('Stream error:', error);
    });

  } catch (error) {
    console.error('Stream audio error:', error);
    res.status(500).json({ error: 'Failed to stream audio file' });
  }
};
