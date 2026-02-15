import { Request, Response } from 'express';
import { Song, SongCollaborator, SongAuthor, SongComposer, Songwriter, Artist, Release, Brand } from '../models';
import { uploadToS3, deleteFromS3, headS3Object, getS3ObjectStream } from '../utils/s3Service';
import { analyzeAudio } from '../utils/audioAnalyzer';
import { Readable } from 'stream';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Convert a WAV buffer to 192kbps MP3 using ffmpeg.
 * Returns a Promise resolving to a Buffer containing the MP3 data.
 */
function convertWavToMp3(wavBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(wavBuffer);
    const chunks: Buffer[] = [];

    const command = ffmpeg(inputStream)
      .inputFormat('wav')
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .format('mp3')
      .on('error', (err: Error) => reject(err));

    const outputStream = command.pipe();
    outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', (err: Error) => reject(err));
  });
}

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

    const song = await Song.findByPk(id as string, {
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

    // Verify release belongs to user's brand and get artists
    const release = await Release.findOne({
      where: {
        id: release_id,
        brand_id: req.user.brand_id
      },
      include: [{
        model: Artist,
        as: 'artists'
      }]
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Check permissions: admins can add songs anytime, non-admins can only add songs to Draft releases
    if (!req.user.is_admin && release.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot add songs to non-draft releases. Contact your label administrator.' });
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
      brand_id: release.brand_id,
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

    // Auto-add release artists as collaborators (non-editable)
    const releaseArtists = (release as any).artists || [];
    for (const artist of releaseArtists) {
      await SongCollaborator.create({
        song_id: song.id!,
        artist_id: Number(artist.id)
      });
    }

    // Add additional collaborators if provided (excluding duplicates)
    if (collaborators && Array.isArray(collaborators)) {
      const releaseArtistIds = releaseArtists.map((a: any) => Number(a.id));
      for (const collab of collaborators) {
        const collabArtistId = Number(collab.artist_id);
        // Skip if this artist is already added as a release artist
        if (!releaseArtistIds.includes(collabArtistId)) {
          await SongCollaborator.create({
            song_id: song.id!,
            artist_id: collabArtistId
          });
        }
      }
    }

    // Add authors if provided
    if (authors && Array.isArray(authors)) {
      for (const author of authors) {
        const authorData: any = {
          song_id: song.id!,
          songwriter_id: author.songwriter_id
        };

        // Only admins can set share percentage
        if (req.user.is_admin) {
          authorData.share_percentage = author.share_percentage;
        }

        await SongAuthor.create(authorData);
      }
    }

    // Add composers if provided
    if (composers && Array.isArray(composers)) {
      for (const composer of composers) {
        const composerData: any = {
          song_id: song.id!,
          songwriter_id: composer.songwriter_id
        };

        // Only admins can set share percentage
        if (req.user.is_admin) {
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
    const song = await Song.findByPk(id as string, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const release = (song as any).release;
    const isRestrictedMode = !req.user.is_admin && release?.status !== 'Draft';

    // Prepare update data based on permissions
    const updateData: any = {};

    // Non-admins on non-draft releases can only update lyrics
    if (isRestrictedMode) {
      updateData.lyrics = lyrics;
    } else {
      // Non-admins on draft releases can update title and lyrics
      updateData.title = title;
      updateData.lyrics = lyrics;

      // Only admins can update these fields
      if (req.user.is_admin) {
        updateData.track_number = track_number;
        updateData.duration = duration;
        updateData.isrc = isrc;
        updateData.spotify_link = spotify_link;
        updateData.apple_music_link = apple_music_link;
        updateData.youtube_link = youtube_link;
      }
    }

    // Update song fields
    await song.update(updateData);

    // Non-admins on non-draft releases cannot update collaborators, authors, or composers
    if (isRestrictedMode) {
      // Skip updating collaborators, authors, and composers in restricted mode
      // Fetch updated song with associations and return
      const updatedSong = await Song.findByPk(id as string, {
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

      return res.json({ song: updatedSong });
    }

    // Update collaborators if provided
    if (collaborators !== undefined) {
      // Get release artists (these should always be present as collaborators)
      const releaseWithArtists = await Release.findByPk(release.id, {
        include: [{
          model: Artist,
          as: 'artists'
        }]
      });
      const releaseArtists = (releaseWithArtists as any)?.artists || [];
      const releaseArtistIds = releaseArtists.map((a: any) => Number(a.id));

      // Delete existing collaborators
      await SongCollaborator.destroy({ where: { song_id: id } });

      // Re-add release artists (always present)
      for (const artist of releaseArtists) {
        await SongCollaborator.create({
          song_id: Number(id),
          artist_id: Number(artist.id)
        });
      }

      // Add additional collaborators (excluding duplicates)
      if (Array.isArray(collaborators)) {
        for (const collab of collaborators) {
          const collabArtistId = Number(collab.artist_id);
          // Skip if this artist is already added as a release artist
          if (!releaseArtistIds.includes(collabArtistId)) {
            await SongCollaborator.create({
              song_id: Number(id),
              artist_id: collabArtistId
            });
          }
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
            song_id: Number(id),
            songwriter_id: author.songwriter_id
          };

          // Only admins can set share percentage
          if (req.user.is_admin) {
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
            song_id: Number(id),
            songwriter_id: composer.songwriter_id
          };

          // Only admins can set share percentage
          if (req.user.is_admin) {
            composerData.share_percentage = composer.share_percentage;
          }

          await SongComposer.create(composerData);
        }
      }
    }

    // Fetch updated song with associations
    const updatedSong = await Song.findByPk(id as string, {
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
    const { id } = req.params;

    // Find song and verify brand ownership
    const song = await Song.findByPk(id as string, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id }
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check permissions: admins can delete any song, non-admins can only delete songs on Draft releases
    const release = (song as any).release;
    if (!req.user.is_admin && release?.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot delete songs on non-draft releases. Contact your label administrator.' });
    }

    // Delete audio file from S3 if exists
    if (song.audio_file) {
      try {
        await deleteFromS3({
          Bucket: process.env.S3_BUCKET_MASTERS!,
          Key: song.audio_file
        });
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

    // Check permissions: admins can reorder any release, non-admins can only reorder Draft releases
    if (!req.user.is_admin && release.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot reorder songs on non-draft releases. Contact your label administrator.' });
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

    // Find song and verify brand ownership, include release, artists, and brand
    const song = await Song.findByPk(id as string, {
      include: [{
        model: Release,
        as: 'release',
        where: { brand_id: req.user.brand_id },
        include: [
          {
            model: Artist,
            as: 'artists'
          },
          {
            model: Brand,
            as: 'brand'
          }
        ]
      }]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const release = (song as any).release;
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Check permissions: admins can upload audio anytime, non-admins can only upload on Draft releases
    if (!req.user.is_admin && release.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot upload audio on non-draft releases. Contact your label administrator.' });
    }

    // Get brand name
    const brand = (release as any).brand;
    const brandName = brand?.brand_name || 'Unknown Brand';

    // Get artist name (use first artist if multiple)
    const artists = release.artists || [];
    const artistName = artists.length > 0 ? artists[0].name : 'Unknown Artist';
    const releaseTitle = release.title || 'Untitled';
    const catalogNo = release.catalog_no;

    // Sanitize brand name for filesystem/S3 compatibility
    const sanitizedBrandName = brandName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Create folder name: "catalog_no artist name - release title"
    // Sanitize for filesystem/S3 compatibility
    const releaseFolderName = `${catalogNo} ${artistName} - ${releaseTitle}`
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Delete old audio files if exists (both WAV and MP3)
    if (song.audio_file) {
      try {
        await deleteFromS3({
          Bucket: process.env.S3_BUCKET_MASTERS!,
          Key: song.audio_file
        });
      } catch (s3Error) {
        console.error('S3 delete error (WAV):', s3Error);
      }
    }
    if (song.audio_file_mp3) {
      try {
        await deleteFromS3({
          Bucket: process.env.S3_BUCKET_MASTERS!,
          Key: song.audio_file_mp3
        });
      } catch (s3Error) {
        console.error('S3 delete error (MP3):', s3Error);
      }
    }

    // Sanitize original filename to prevent path traversal and security issues
    const sanitizedOriginalName = req.file.originalname
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '') // Remove special characters, keep only alphanumeric, spaces, hyphens, underscores, dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/\.+/g, '.') // Collapse multiple dots
      .trim();

    // Upload new file to S3 masters bucket with brand as top-level folder
    // S3 doesn't require explicit folder creation - it's created automatically
    // Structure: <Brand Name>/<catalog number> <Artist Name> - <Release title>/WAV/<filename>
    const timestampedName = `${Date.now()}-${sanitizedOriginalName}`;
    const fileName = `${sanitizedBrandName}/${releaseFolderName}/WAV/${timestampedName}`;
    await uploadToS3({
      Bucket: process.env.S3_BUCKET_MASTERS!,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'private'
    });

    // Get file size from the uploaded file buffer
    const fileSize = req.file.buffer.length;

    // Convert WAV to MP3 (192kbps) and upload to S3 in MP3 subfolder
    let mp3FileName: string | undefined;
    let mp3FileSize: number | undefined;
    try {
      const mp3Buffer = await convertWavToMp3(req.file.buffer);
      const mp3Name = timestampedName.replace(/\.[^.]+$/, '.mp3');
      mp3FileName = `${sanitizedBrandName}/${releaseFolderName}/MP3/${mp3Name}`;
      mp3FileSize = mp3Buffer.length;
      await uploadToS3({
        Bucket: process.env.S3_BUCKET_MASTERS!,
        Key: mp3FileName,
        Body: mp3Buffer,
        ContentType: 'audio/mpeg',
        ACL: 'private'
      });
      console.log(`MP3 version created: ${mp3FileName} (${mp3FileSize} bytes)`);
    } catch (mp3Error) {
      console.error('MP3 conversion error (WAV upload still succeeded):', mp3Error);
      mp3FileName = undefined;
      mp3FileSize = undefined;
    }

    // Update song with new audio file path, size, and MP3 path
    await song.update({
      audio_file: fileName,
      audio_file_size: fileSize,
      ...(mp3FileName ? { audio_file_mp3: mp3FileName, audio_file_mp3_size: mp3FileSize } : {})
    });

    res.json({
      message: 'Audio file uploaded successfully',
      audio_file: fileName,
      audio_file_size: fileSize,
      audio_file_mp3: mp3FileName,
      audio_file_mp3_size: mp3FileSize
    });

    // Fire-and-forget: detect BPM and duration from the uploaded audio
    // Only update fields that are not already set
    const needsTempo = !song.tempo;
    const needsDuration = !song.duration;
    if (needsTempo || needsDuration) {
      analyzeAudio(req.file.buffer).then(async ({ bpm, duration }) => {
        const updates: any = {};
        if (needsTempo && bpm) updates.tempo = bpm;
        if (needsDuration && duration) updates.duration = duration;

        if (Object.keys(updates).length > 0) {
          await song.update(updates);
          console.log(`Audio analysis for song ${song.id}:`, updates);
        }
      }).catch(err => {
        console.error(`Audio analysis failed for song ${song.id}:`, err);
      });
    }
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
    const song = await Song.findByPk(id as string, {
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

    // Prefer MP3 version if available, fallback to WAV
    const audioKey = song.audio_file_mp3 || song.audio_file;
    const contentType = song.audio_file_mp3 ? 'audio/mpeg' : 'audio/wav';

    // Get audio file from S3
    const params = {
      Bucket: process.env.S3_BUCKET_MASTERS!,
      Key: audioKey
    };

    // Get file metadata
    const headData = await headS3Object(params);
    const fileSize = headData.ContentLength || 0;

    // Set response headers
    res.setHeader('Content-Type', contentType);
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

      const streamResult = await getS3ObjectStream({
        ...params,
        Range: `bytes=${start}-${end}`
      });

      streamResult.Body.pipe(res);
    } else {
      // Stream entire file
      const streamResult = await getS3ObjectStream(params);
      streamResult.Body.pipe(res);
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
