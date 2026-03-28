import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Song, ReleaseSong, SongCollaborator, SongAuthor, SongComposer, Songwriter, Artist, Release, Brand, ReleaseArtist } from '../models';
import { uploadToS3, deleteFromS3, headS3Object, getS3ObjectStream } from '../utils/s3Service';
import { analyzeAudio } from '../utils/audioAnalyzer';
import { Readable } from 'stream';

/**
 * Validate that the total royalty percentages across all collaborators do not exceed 1 (100%).
 * Returns an array of royalty types that exceed the limit, or empty if all valid.
 */
function validateRoyaltyTotals(collaborators: any[]): string[] {
  const types = ['streaming', 'sync', 'download', 'physical'] as const;
  const exceeded: string[] = [];
  for (const type of types) {
    const key = `${type}_royalty_percentage`;
    const total = collaborators.reduce((sum, c) => sum + (Number(c[key]) || 0), 0);
    // Allow small floating-point margin
    if (total > 1.0001) {
      exceeded.push(type);
    }
  }
  return exceeded;
}

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

/** Standard song includes for collaborators, authors, composers */
const songAssociationIncludes = [
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
];

/**
 * Fetch songs for a release via ReleaseSong join table.
 * Returns songs with track_number flattened onto each song object.
 */
async function fetchSongsForRelease(releaseId: number | string) {
  const releaseSongs = await ReleaseSong.findAll({
    where: { release_id: releaseId },
    include: [{
      model: Song,
      as: 'song',
      include: songAssociationIncludes
    }],
    order: [['track_number', 'ASC']]
  });

  return releaseSongs.map((rs: any) => ({
    ...rs.song.toJSON(),
    track_number: rs.track_number
  }));
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

    const songs = await fetchSongsForRelease(releaseId as string);

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

    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id },
      include: [
        {
          model: Release,
          as: 'releases',
          through: { attributes: ['track_number'] }
        },
        ...songAssociationIncludes
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

    // Validate royalty totals if collaborators are provided
    if (req.user.is_admin && collaborators && Array.isArray(collaborators)) {
      const exceeded = validateRoyaltyTotals(collaborators);
      if (exceeded.length > 0) {
        return res.status(400).json({
          error: `Royalty percentages exceed 100% for: ${exceeded.join(', ')}`
        });
      }
    }

    // Get the highest track number for this release from the join table
    const maxTrackEntry = await ReleaseSong.findOne({
      where: { release_id },
      order: [['track_number', 'DESC']],
      attributes: ['track_number']
    });

    const nextTrackNumber = maxTrackEntry?.track_number ? maxTrackEntry.track_number + 1 : 1;

    // Create song (filter admin-only fields for non-admins)
    const songData: any = {
      brand_id: release.brand_id,
      title,
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

    // Create the join table entry
    await ReleaseSong.create({
      release_id,
      song_id: song.id!,
      track_number: nextTrackNumber
    });

    // Load all release_artist rows for this release into a map (artist_id → record)
    const raRows = await ReleaseArtist.findAll({ where: { release_id: Number(release_id) } });
    const raMap = new Map(raRows.map(ra => [ra.artist_id, ra]));

    // Build a lookup from submitted collaborators (artist_id → royalty fields)
    const submittedCollabMap = new Map<number, any>();
    if (collaborators && Array.isArray(collaborators)) {
      for (const c of collaborators) {
        submittedCollabMap.set(Number(c.artist_id), c);
      }
    }

    // Auto-add release artists as collaborators
    // Admin: use submitted values if provided, else fall back to release_artist values
    // Non-admin: always use release_artist values
    const releaseArtists = (release as any).artists || [];
    for (const artist of releaseArtists) {
      const ra = raMap.get(Number(artist.id));
      const submitted = submittedCollabMap.get(Number(artist.id));

      const royaltyFields = (req.user.is_admin && submitted) ? {
        streaming_royalty_percentage: submitted.streaming_royalty_percentage ?? ra?.streaming_royalty_percentage,
        streaming_royalty_type:       submitted.streaming_royalty_type ?? ra?.streaming_royalty_type,
        sync_royalty_percentage:      submitted.sync_royalty_percentage ?? ra?.sync_royalty_percentage,
        sync_royalty_type:            submitted.sync_royalty_type ?? ra?.sync_royalty_type,
        download_royalty_percentage:  submitted.download_royalty_percentage ?? ra?.download_royalty_percentage,
        download_royalty_type:        submitted.download_royalty_type ?? ra?.download_royalty_type,
        physical_royalty_percentage:  submitted.physical_royalty_percentage ?? ra?.physical_royalty_percentage,
        physical_royalty_type:        submitted.physical_royalty_type ?? ra?.physical_royalty_type,
      } : (ra ? {
        streaming_royalty_percentage: ra.streaming_royalty_percentage,
        streaming_royalty_type:       ra.streaming_royalty_type,
        sync_royalty_percentage:      ra.sync_royalty_percentage,
        sync_royalty_type:            ra.sync_royalty_type,
        download_royalty_percentage:  ra.download_royalty_percentage,
        download_royalty_type:        ra.download_royalty_type,
        physical_royalty_percentage:  ra.physical_royalty_percentage,
        physical_royalty_type:        ra.physical_royalty_type,
      } : {});

      await SongCollaborator.create({
        song_id: song.id!,
        artist_id: Number(artist.id),
        ...royaltyFields
      });
    }

    // Add additional collaborators if provided (excluding release artists).
    if (collaborators && Array.isArray(collaborators)) {
      const releaseArtistIds = releaseArtists.map((a: any) => Number(a.id));
      for (const collab of collaborators) {
        const collabArtistId = Number(collab.artist_id);
        if (!releaseArtistIds.includes(collabArtistId)) {
          const royaltyFields = req.user.is_admin ? {
            streaming_royalty_percentage: collab.streaming_royalty_percentage,
            sync_royalty_percentage:      collab.sync_royalty_percentage,
            download_royalty_percentage:  collab.download_royalty_percentage,
            physical_royalty_percentage:  collab.physical_royalty_percentage,
          } : {};

          await SongCollaborator.create({
            song_id: song.id!,
            artist_id: collabArtistId,
            ...royaltyFields
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
      include: songAssociationIncludes
    });

    // Attach track_number for frontend compatibility
    const result = {
      ...completeSong!.toJSON(),
      track_number: nextTrackNumber
    };

    res.status(201).json({ song: result });
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
      release_id,
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
    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Determine release context for permission checks
    let release: any = null;
    if (release_id) {
      release = await Release.findOne({
        where: { id: release_id, brand_id: req.user.brand_id }
      });
    } else {
      // Fall back to the first associated release
      const firstReleaseSong = await ReleaseSong.findOne({
        where: { song_id: id },
        include: [{ model: Release, as: 'release' }]
      });
      release = firstReleaseSong?.release;
    }

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
        updateData.duration = duration;
        updateData.isrc = isrc;
        updateData.spotify_link = spotify_link;
        updateData.apple_music_link = apple_music_link;
        updateData.youtube_link = youtube_link;
      }
    }

    // Update song fields
    await song.update(updateData);

    // Update track_number on the join table if provided and admin
    if (req.user.is_admin && track_number !== undefined && release_id) {
      await ReleaseSong.update(
        { track_number },
        { where: { song_id: id, release_id } }
      );
    }

    // Non-admins on non-draft releases cannot update collaborators, authors, or composers
    if (isRestrictedMode) {
      // Skip updating collaborators, authors, and composers in restricted mode
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
      // Validate royalty totals if collaborators are provided
      if (req.user.is_admin && Array.isArray(collaborators)) {
        const exceeded = validateRoyaltyTotals(collaborators);
        if (exceeded.length > 0) {
          return res.status(400).json({
            error: `Royalty percentages exceed 100% for: ${exceeded.join(', ')}`
          });
        }
      }

      // Get release artists (these should always be present as collaborators)
      let releaseArtistIds: number[] = [];

      // Build a lookup from submitted collaborators (artist_id → royalty fields)
      const submittedCollabMap = new Map<number, any>();
      if (Array.isArray(collaborators)) {
        for (const c of collaborators) {
          submittedCollabMap.set(Number(c.artist_id), c);
        }
      }

      if (release) {
        const releaseWithArtists = await Release.findByPk(release.id, {
          include: [{
            model: Artist,
            as: 'artists'
          }]
        });
        const releaseArtists = (releaseWithArtists as any)?.artists || [];
        releaseArtistIds = releaseArtists.map((a: any) => Number(a.id));

        // Delete existing collaborators
        await SongCollaborator.destroy({ where: { song_id: id } });

        // Load all release_artist rows for this release into a map (artist_id → record)
        const raRows = await ReleaseArtist.findAll({ where: { release_id: Number(release.id) } });
        const raMap = new Map(raRows.map(ra => [ra.artist_id, ra]));

        // Re-add release artists
        // Admin: use submitted values if provided, else fall back to release_artist values
        // Non-admin: always use release_artist values
        for (const artist of releaseArtists) {
          const ra = raMap.get(Number(artist.id));
          const submitted = submittedCollabMap.get(Number(artist.id));

          const royaltyFields = (req.user.is_admin && submitted) ? {
            streaming_royalty_percentage: submitted.streaming_royalty_percentage ?? ra?.streaming_royalty_percentage,
            streaming_royalty_type:       submitted.streaming_royalty_type ?? ra?.streaming_royalty_type,
            sync_royalty_percentage:      submitted.sync_royalty_percentage ?? ra?.sync_royalty_percentage,
            sync_royalty_type:            submitted.sync_royalty_type ?? ra?.sync_royalty_type,
            download_royalty_percentage:  submitted.download_royalty_percentage ?? ra?.download_royalty_percentage,
            download_royalty_type:        submitted.download_royalty_type ?? ra?.download_royalty_type,
            physical_royalty_percentage:  submitted.physical_royalty_percentage ?? ra?.physical_royalty_percentage,
            physical_royalty_type:        submitted.physical_royalty_type ?? ra?.physical_royalty_type,
          } : (ra ? {
            streaming_royalty_percentage: ra.streaming_royalty_percentage,
            streaming_royalty_type:       ra.streaming_royalty_type,
            sync_royalty_percentage:      ra.sync_royalty_percentage,
            sync_royalty_type:            ra.sync_royalty_type,
            download_royalty_percentage:  ra.download_royalty_percentage,
            download_royalty_type:        ra.download_royalty_type,
            physical_royalty_percentage:  ra.physical_royalty_percentage,
            physical_royalty_type:        ra.physical_royalty_type,
          } : {});

          await SongCollaborator.create({
            song_id: Number(id),
            artist_id: Number(artist.id),
            ...royaltyFields
          });
        }
      } else {
        // No release context; just replace all collaborators
        await SongCollaborator.destroy({ where: { song_id: id } });
      }

      // Add additional collaborators (excluding release artists).
      if (Array.isArray(collaborators)) {
        for (const collab of collaborators) {
          const collabArtistId = Number(collab.artist_id);
          if (!releaseArtistIds.includes(collabArtistId)) {
            const royaltyFields = req.user.is_admin ? {
              streaming_royalty_percentage: collab.streaming_royalty_percentage,
              sync_royalty_percentage:      collab.sync_royalty_percentage,
              download_royalty_percentage:  collab.download_royalty_percentage,
              physical_royalty_percentage:  collab.physical_royalty_percentage,
            } : {};

            await SongCollaborator.create({
              song_id: Number(id),
              artist_id: collabArtistId,
              ...royaltyFields
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
      include: songAssociationIncludes
    });

    res.json({ song: updatedSong });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove a song from a release (and delete if orphaned)
export const deleteSongFromRelease = async (req: AuthRequest, res: Response) => {
  try {
    const { id, releaseId } = req.params;

    // Find song and verify brand ownership
    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Verify release belongs to user's brand
    const release = await Release.findOne({
      where: { id: releaseId, brand_id: req.user.brand_id }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Check permissions: admins can delete any song, non-admins can only delete songs on Draft releases
    if (!req.user.is_admin && release.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot remove songs from non-draft releases. Contact your label administrator.' });
    }

    // Remove the link between song and release
    const deleted = await ReleaseSong.destroy({
      where: { song_id: id, release_id: releaseId }
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Song is not part of this release' });
    }

    // Check if the song is still linked to any other releases
    const remainingLinks = await ReleaseSong.count({
      where: { song_id: id }
    });

    let songDeleted = false;
    if (remainingLinks === 0) {
      // Song is orphaned — delete audio files from S3 and remove the song
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

      // Delete song (cascading will delete collaborators, authors, composers)
      await song.destroy();
      songDeleted = true;
    }

    res.json({
      message: songDeleted
        ? 'Song removed from release and permanently deleted'
        : 'Song removed from this release',
      song_deleted: songDeleted
    });
  } catch (error) {
    console.error('Delete song from release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a song entirely (from all releases)
export const deleteSong = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Find song and verify brand ownership
    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Only admins can fully delete a song
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only administrators can permanently delete songs.' });
    }

    // Delete audio files from S3
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

    // Remove all release links
    await ReleaseSong.destroy({ where: { song_id: id } });

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

    // Update track numbers on the join table
    for (let i = 0; i < songOrder.length; i++) {
      const songId = songOrder[i];
      await ReleaseSong.update(
        { track_number: i + 1 },
        {
          where: {
            song_id: songId,
            release_id: releaseId
          }
        }
      );
    }

    // Fetch updated songs
    const songs = await fetchSongsForRelease(releaseId as string);

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

    // Find song and verify brand ownership
    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Get a release for permission check and S3 path construction
    const releaseSong = await ReleaseSong.findOne({
      where: { song_id: id },
      include: [{
        model: Release,
        as: 'release',
        include: [
          { model: Artist, as: 'artists' },
          { model: Brand, as: 'brand' }
        ]
      }]
    });

    const release = releaseSong?.release;
    if (!release) {
      return res.status(404).json({ error: 'Song is not associated with any release' });
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

    // Detect BPM and duration from the uploaded audio before responding
    // so the frontend can display updated values immediately
    const songUpdates: any = {
      audio_file: fileName,
      audio_file_size: fileSize,
      ...(mp3FileName ? { audio_file_mp3: mp3FileName, audio_file_mp3_size: mp3FileSize } : {})
    };

    const needsTempo = !song.tempo;
    try {
      const { bpm, duration } = await analyzeAudio(req.file.buffer);
      if (needsTempo && bpm) songUpdates.tempo = bpm;
      if (duration) songUpdates.duration = duration;
    } catch (err) {
      console.error(`Audio analysis failed for song ${song.id}:`, err);
    }

    await song.update(songUpdates);

    res.json({
      message: 'Audio file uploaded successfully',
      audio_file: fileName,
      audio_file_size: fileSize,
      audio_file_mp3: mp3FileName,
      audio_file_mp3_size: mp3FileSize
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
    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
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

/**
 * Build a download filename for a song: "Artist - Album - 01 - Song Title.ext"
 * Falls back gracefully if release/artist info is not available.
 */
async function buildSongDownloadFileName(song: any, ext: string): Promise<{ raw: string; sanitized: string }> {
  // Find the first release this song belongs to, and its artist
  const releaseSong = await ReleaseSong.findOne({
    where: { song_id: song.id },
    include: [{
      model: Release,
      as: 'release',
      include: [{ model: Artist, as: 'artists' }]
    }],
    order: [['track_number', 'ASC']]
  });

  let raw: string;
  if (releaseSong) {
    const release = (releaseSong as any).release;
    const artistName = release?.artists?.length > 0 ? release.artists[0].name : 'Unknown Artist';
    const trackNumberPadded = String(releaseSong.track_number).padStart(2, '0');
    raw = `${artistName} - ${release?.title || 'Unknown Album'} - ${trackNumberPadded} - ${song.title}${ext}`;
  } else {
    raw = `${song.title}${ext}`;
  }

  const sanitized = raw.replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, ' ').trim() || `song-${song.id}${ext}`;
  return { raw, sanitized };
}

// Download the WAV master file for a single song
export const downloadSongMaster = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (!song.audio_file) {
      return res.status(404).json({ error: 'No WAV master available for this song' });
    }

    const key = song.audio_file;
    const ext = require('path').extname(key) || '.wav';
    const { raw: rawFileName, sanitized: sanitizedFileName } = await buildSongDownloadFileName(song, ext);
    const encodedFileName = encodeURIComponent(rawFileName);

    const headData = await headS3Object({ Bucket: process.env.S3_BUCKET_MASTERS!, Key: key });
    const fileSize = headData.ContentLength || 0;

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodedFileName}`);

    const streamResult = await getS3ObjectStream({ Bucket: process.env.S3_BUCKET_MASTERS!, Key: key });
    streamResult.Body.pipe(res);

    res.on('error', (error) => {
      console.error('Stream error:', error);
    });

  } catch (error) {
    console.error('Download song master error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download song master' });
    }
  }
};

// Download the MP3 file for a single song
export const downloadSongMp3 = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const song = await Song.findOne({
      where: { id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (!song.audio_file_mp3) {
      return res.status(404).json({ error: 'No MP3 available for this song' });
    }

    const key = song.audio_file_mp3;
    const { raw: rawFileName, sanitized: sanitizedFileName } = await buildSongDownloadFileName(song, '.mp3');
    const encodedFileName = encodeURIComponent(rawFileName);

    const headData = await headS3Object({ Bucket: process.env.S3_BUCKET_MASTERS!, Key: key });
    const fileSize = headData.ContentLength || 0;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodedFileName}`);

    const streamResult = await getS3ObjectStream({ Bucket: process.env.S3_BUCKET_MASTERS!, Key: key });
    streamResult.Body.pipe(res);

    res.on('error', (error) => {
      console.error('Stream error:', error);
    });

  } catch (error) {
    console.error('Download song MP3 error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download song MP3' });
    }
  }
};

// Add an existing song to a release
export const addExistingSongToRelease = async (req: AuthRequest, res: Response) => {
  try {
    const { releaseId } = req.params;
    const { song_id } = req.body;

    if (!song_id) {
      return res.status(400).json({ error: 'song_id is required' });
    }

    // Verify release belongs to user's brand
    const release = await Release.findOne({
      where: { id: releaseId, brand_id: req.user.brand_id }
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Check permissions
    if (!req.user.is_admin && release.status !== 'Draft') {
      return res.status(403).json({ error: 'Cannot add songs to non-draft releases. Contact your label administrator.' });
    }

    // Verify song belongs to same brand
    const song = await Song.findOne({
      where: { id: song_id, brand_id: req.user.brand_id }
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check if song is already in this release
    const existingLink = await ReleaseSong.findOne({
      where: { release_id: releaseId, song_id }
    });

    if (existingLink) {
      return res.status(409).json({ error: 'Song is already part of this release' });
    }

    // Get next track number
    const maxTrackEntry = await ReleaseSong.findOne({
      where: { release_id: releaseId },
      order: [['track_number', 'DESC']],
      attributes: ['track_number']
    });

    const nextTrackNumber = maxTrackEntry?.track_number ? maxTrackEntry.track_number + 1 : 1;

    // Create the link
    await ReleaseSong.create({
      release_id: parseInt(releaseId as string, 10),
      song_id,
      track_number: nextTrackNumber
    });

    // Fetch the complete song with associations
    const completeSong = await Song.findByPk(song_id, {
      include: songAssociationIncludes
    });

    const result = {
      ...completeSong!.toJSON(),
      track_number: nextTrackNumber
    };

    res.status(201).json({ song: result });
  } catch (error) {
    console.error('Add existing song to release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Search songs within a brand (for "Add Existing Song" picker)
export const searchSongsInBrand = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const search = (req.query.search as string) || '';
    const excludeReleaseId = req.query.excludeReleaseId ? parseInt(req.query.excludeReleaseId as string, 10) : null;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const whereClause: any = { brand_id: brandId };
    if (search.trim()) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }

    // If excluding a release, find song IDs already in that release
    let excludeSongIds: number[] = [];
    if (excludeReleaseId) {
      const existingLinks = await ReleaseSong.findAll({
        where: { release_id: excludeReleaseId },
        attributes: ['song_id']
      });
      excludeSongIds = existingLinks.map((rs: any) => rs.song_id);
    }

    if (excludeSongIds.length > 0) {
      whereClause.id = { [Op.notIn]: excludeSongIds };
    }

    const songs = await Song.findAll({
      where: whereClause,
      limit,
      include: [
        {
          model: Release,
          as: 'releases',
          through: { attributes: [] },
          attributes: ['id', 'title', 'catalog_no']
        },
        {
          model: SongCollaborator,
          as: 'collaborators',
          include: [{ model: Artist, as: 'artist', attributes: ['id', 'name'] }]
        }
      ],
      order: [['title', 'ASC']]
    });

    res.json({ songs });
  } catch (error) {
    console.error('Search songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
