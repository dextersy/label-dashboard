import { Request, Response } from 'express';
import { Op } from 'sequelize';
import archiver from 'archiver';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { SyncLicensingPitch, SyncLicensingPitchSong, Song, Release, Artist, User, Brand, SongAuthor, SongComposer, Songwriter } from '../models';
import { getS3ObjectStream } from '../utils/s3Service';

/**
 * Helper function to enrich songs with artist data from their releases.
 * Uses batch fetching to avoid N+1 query problem - fetches all releases in a single query.
 */
async function enrichSongsWithArtists(songs: Song[]): Promise<any[]> {
  const songsData = songs.map(song => song.toJSON() as any);

  // Collect unique release IDs
  const releaseIds = [...new Set(
    songsData
      .filter(s => s.release?.id)
      .map(s => s.release.id)
  )];

  if (releaseIds.length === 0) {
    return songsData;
  }

  // Batch fetch all releases with their artists in a single query
  const releases = await Release.findAll({
    where: { id: releaseIds },
    include: [
      {
        model: Artist,
        as: 'artists',
        attributes: ['id', 'name'],
        through: { attributes: [] }
      }
    ]
  });

  // Create a map for quick lookup
  const releaseArtistsMap = new Map<number, any[]>();
  for (const release of releases) {
    const releaseData = release.toJSON() as any;
    releaseArtistsMap.set(releaseData.id, releaseData.artists || []);
  }

  // Enrich songs with cached artist data
  for (const songData of songsData) {
    if (songData.release?.id) {
      songData.release.artists = releaseArtistsMap.get(songData.release.id) || [];
    }
  }

  return songsData;
}

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
      },
      {
        model: SongAuthor,
        as: 'authors',
        attributes: ['id']
      },
      {
        model: SongComposer,
        as: 'composers',
        attributes: ['id']
      }
    ]
  });

  return enrichSongsWithArtists(songs);
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
 * Search songs for adding to a pitch (only songs with master audio)
 */
export const searchSongs = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const search = req.query.search as string || '';
    const limit = parseInt(req.query.limit as string) || 20;

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    const whereClause: any = {
      brand_id: brandId,
      // Only include songs that have master audio files
      audio_file: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    };

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
        },
        {
          model: SongAuthor,
          as: 'authors',
          attributes: ['id']
        },
        {
          model: SongComposer,
          as: 'composers',
          attributes: ['id']
        }
      ]
    });

    const songsWithArtists = await enrichSongsWithArtists(songs);

    res.json({ songs: songsWithArtists });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
};

/**
 * Download masters for a pitch as a zip file
 */
export const downloadMasters = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    // Get the pitch
    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId }
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Get songs with audio files for this pitch
    const songs = await Song.findAll({
      where: {
        audio_file: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
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
          attributes: ['id', 'title']
        }
      ]
    });

    if (songs.length === 0) {
      return res.status(404).json({ error: 'No songs with master audio found in this pitch' });
    }

    // Sanitize pitch title for filename
    const sanitizedTitle = pitch.title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    // Set response headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}_masters.zip"`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip archive' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add each song's audio file to the archive
    for (const song of songs) {
      const songData = song.toJSON() as any;
      if (songData.audio_file) {
        try {
          // Get the file stream from S3
          const streamResult = await getS3ObjectStream({
            Bucket: process.env.S3_BUCKET_MASTERS!,
            Key: songData.audio_file
          });

          // Extract original filename from the S3 key or use song title
          const s3Key = songData.audio_file;
          const originalFilename = s3Key.substring(s3Key.lastIndexOf('/') + 1);

          // Create a clean filename: "Song Title - Release Title.ext"
          const extension = originalFilename.substring(originalFilename.lastIndexOf('.')) || '.wav';
          const releaseTitle = songData.release?.title || 'Unknown Release';
          const cleanFilename = `${songData.title} - ${releaseTitle}${extension}`
            .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Add file to archive
          archive.append(streamResult.Body as Readable, { name: cleanFilename });
        } catch (s3Error) {
          console.error(`Failed to fetch audio for song ${songData.id}:`, s3Error);
          // Continue with other files
        }
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Error downloading masters:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download masters' });
    }
  }
};

/**
 * Download lyrics for a pitch as a text file
 */
export const downloadLyrics = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    // Get the pitch
    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId }
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Get songs with lyrics for this pitch
    const songs = await Song.findAll({
      where: {
        lyrics: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
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
          attributes: ['id', 'title']
        },
        {
          model: SongAuthor,
          as: 'authors',
          include: [
            {
              model: Songwriter,
              as: 'songwriter',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['title', 'ASC']]
    });

    if (songs.length === 0) {
      return res.status(404).json({ error: 'No songs with lyrics found in this pitch' });
    }

    // Build the lyrics text content
    let lyricsContent = `LYRICS - ${pitch.title}\n`;
    lyricsContent += `${'='.repeat(50)}\n\n`;

    for (const song of songs) {
      const songData = song.toJSON() as any;
      const releaseTitle = songData.release?.title || 'Unknown Release';

      // Get author names
      const authorNames = songData.authors
        ?.map((author: any) => author.songwriter?.name)
        .filter((name: string | undefined) => name)
        .join(', ') || '';

      lyricsContent += `${songData.title}\n`;
      lyricsContent += `From: ${releaseTitle}\n`;
      if (authorNames) {
        lyricsContent += `Written by: ${authorNames}\n`;
      }
      lyricsContent += `${'-'.repeat(40)}\n\n`;
      lyricsContent += `${songData.lyrics}\n\n`;
      lyricsContent += `${'='.repeat(50)}\n\n`;
    }

    // Sanitize pitch title for filename
    const sanitizedTitle = pitch.title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    // Set response headers for text file download
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}_lyrics.txt"`);

    res.send(lyricsContent);
  } catch (error) {
    console.error('Error downloading lyrics:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download lyrics' });
    }
  }
};

/**
 * Download B-Sheet (metadata spreadsheet) for a pitch
 */
export const downloadBSheet = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user?.brand_id;
    const { id } = req.params;
    const pitchId = parseInt(id as string, 10);

    if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
      return res.status(400).json({ error: 'Valid pitch ID is required' });
    }

    // Get the pitch
    const pitch = await SyncLicensingPitch.findOne({
      where: { id: pitchId, brand_id: brandId }
    });

    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Get songs for this pitch with all metadata
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
          attributes: ['id', 'title', 'release_date']
        },
        {
          model: SongAuthor,
          as: 'authors',
          attributes: ['id', 'share_percentage'],
          include: [
            {
              model: Songwriter,
              as: 'songwriter',
              attributes: ['id', 'name', 'pro_affiliation', 'ipi_number']
            }
          ]
        },
        {
          model: SongComposer,
          as: 'composers',
          attributes: ['id', 'share_percentage'],
          include: [
            {
              model: Songwriter,
              as: 'songwriter',
              attributes: ['id', 'name', 'pro_affiliation', 'ipi_number']
            }
          ]
        }
      ],
      order: [['title', 'ASC']]
    });

    if (songs.length === 0) {
      return res.status(404).json({ error: 'No songs found in this pitch' });
    }

    const songsWithArtists = await enrichSongsWithArtists(songs);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Metadata');

    // Static publisher info
    const PUBLISHER_NAME = 'Melt Records Music Publishing Inc.';
    const PUBLISHER_PRO = 'FILSCAP';
    const PUBLISHER_IPI = '1179052840';
    const PUBLISHER_PHONE = '+639176257955';
    const PUBLISHER_EMAIL = 'hi@melt-records.com';
    const PUBLISHER_CUT = 100;

    // Define styles
    const redBoldTitle: Partial<ExcelJS.Font> = { bold: true, size: 22, color: { argb: 'FFFF0000' } };
    const boldFont: Partial<ExcelJS.Font> = { bold: true };
    const requiredStyle: Partial<ExcelJS.Font> = { bold: true, size: 13, color: { argb: 'FFFF0000' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 13, color: { argb: 'FF000000' } };
    const dataFont: Partial<ExcelJS.Font> = { size: 12 };
    const instructionFont: Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: 'FF000000' } };

    const yellowFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    const orangeFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9900' } };
    const pinkFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAD1DC' } };
    const lightGreenFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
    const writerBlueFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } };
    const publisherGreenFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
    const masterYellowFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    const featuredPurpleFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5DFEC' } };

    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', wrapText: true };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    const bottomBorder: Partial<ExcelJS.Borders> = {
      bottom: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // Row 1: Title
    const row1 = worksheet.addRow(['Please download this split sheet to fill out the infomation of the song(s) that you are submitting.']);
    row1.getCell(1).font = redBoldTitle;

    // Row 2: Certification
    const row2 = worksheet.addRow(['', 'I, THE APPLICANT(S) CERTIFY THAT I HAVE SUBMITTED MY MUSIC LISTED HERE AND ALL INFORMATION IS TRUE AND CORRECT.']);
    row2.getCell(2).font = boldFont;

    // Row 3: Empty
    worksheet.addRow([]);

    // Row 4: Required markers for columns 11-27
    const row4 = worksheet.addRow([]);
    for (let col = 11; col <= 27; col++) {
      const cell = row4.getCell(col);
      cell.value = '*Required';
      cell.font = requiredStyle;
      cell.fill = yellowFill;
      cell.alignment = centerAlign;
    }

    // Row 5: Required markers (col 6-7) and Instructions (col 11+)
    const row5 = worksheet.addRow([]);
    row5.getCell(6).value = '*Required';
    row5.getCell(6).font = requiredStyle;
    row5.getCell(6).fill = yellowFill;
    row5.getCell(6).alignment = centerAlign;
    row5.getCell(7).value = '*Required';
    row5.getCell(7).font = requiredStyle;
    row5.getCell(7).fill = yellowFill;
    row5.getCell(7).alignment = centerAlign;
    // Instructions spanning multiple columns
    const instructionText = 'Make sure to separately fill out the correct information for each writer, publisher, and master holder if there is more than one.';
    row5.getCell(11).value = instructionText;
    row5.getCell(11).font = instructionFont;
    row5.getCell(11).fill = orangeFill;
    worksheet.mergeCells(5, 11, 5, 27);

    // Row 6: Group headers
    const row6 = worksheet.addRow([]);
    // Required markers for col 1-2
    row6.getCell(1).value = '*Required';
    row6.getCell(1).font = requiredStyle;
    row6.getCell(1).fill = yellowFill;
    row6.getCell(1).alignment = centerAlign;
    row6.getCell(2).value = '*Required';
    row6.getCell(2).font = requiredStyle;
    row6.getCell(2).fill = yellowFill;
    row6.getCell(2).alignment = centerAlign;
    // Writer's Info (col 11-17)
    row6.getCell(11).value = "Writer's Info";
    row6.getCell(11).font = headerFont;
    row6.getCell(11).fill = writerBlueFill;
    row6.getCell(11).alignment = centerAlign;
    worksheet.mergeCells(6, 11, 6, 17);
    // Publisher's Info (col 18-23)
    row6.getCell(18).value = "Publisher's Info";
    row6.getCell(18).font = headerFont;
    row6.getCell(18).fill = publisherGreenFill;
    row6.getCell(18).alignment = centerAlign;
    worksheet.mergeCells(6, 18, 6, 23);
    // Master holder's Info (col 24-27)
    row6.getCell(24).value = "Master holder's Info";
    row6.getCell(24).font = headerFont;
    row6.getCell(24).fill = masterYellowFill;
    row6.getCell(24).alignment = centerAlign;
    worksheet.mergeCells(6, 24, 6, 27);
    // Featured Artist's Info (col 28-30)
    row6.getCell(28).value = "Featured Artist's Info";
    row6.getCell(28).font = { bold: true, size: 12, color: { argb: 'FF000000' } };
    row6.getCell(28).fill = featuredPurpleFill;
    row6.getCell(28).alignment = centerAlign;
    worksheet.mergeCells(6, 28, 6, 30);

    // Row 7: Column headers
    const headerRow = worksheet.addRow([
      'Song Title',
      'Artist Name',
      'Song Description',
      'ISRC',
      'PRO Work ID/IPI',
      'Non-exclusive',
      'DBP YouTube/Social Media Promotion',
      'Release Date',
      'Release Label',
      'Album/EP Title',
      "Writer(s) First Name",
      "Writer(s) Last Name",
      "Writer's PRO Society Name",
      "Writer's IPI #",
      "Writer's Phone Number",
      "Writer's Email",
      "Writer's Cut %",
      "Publisher(s) Name",
      "Publisher's PRO Society Name",
      "Publisher's IPI #",
      "Publisher's Phone Number",
      "Publisher's Email",
      "Publisher's Cut %",
      "Master holder(s) Name",
      "Master holder's Phone Number",
      "Master holder's Email",
      "Master holder's Cut %",
      "Featured Artist(s)'s Name and Role",
      "Featured Artist(s)'s Real Name",
      "Featured Artist(s)'s Email",
      'Notes'
    ]);
    // Style all header cells
    for (let col = 1; col <= 31; col++) {
      const cell = headerRow.getCell(col);
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
      // Special backgrounds for certain columns
      if (col === 6) cell.fill = pinkFill;
      if (col === 7) cell.fill = lightGreenFill;
    }

    // Track data row start for styling later
    const dataStartRow = 8;

    // Add song data
    for (const song of songsWithArtists) {
      const artistNames = song.release?.artists?.map((a: any) => a.name).join(', ') || '';
      const releaseDate = song.release?.release_date
        ? new Date(song.release.release_date).toISOString().split('T')[0]
        : '';
      const releaseTitle = song.release?.title || '';

      // Combine authors and composers as writers
      // 50% split evenly among authors, 50% split evenly among composers
      // If someone is both author and composer, consolidate their percentage
      const writerMap = new Map<number, any>();

      const authorCount = song.authors?.filter((a: any) => a.songwriter).length || 0;
      const composerCount = song.composers?.filter((c: any) => c.songwriter).length || 0;
      const authorShare = authorCount > 0 ? 50 / authorCount : 0;
      const composerShare = composerCount > 0 ? 50 / composerCount : 0;

      if (song.authors?.length) {
        for (const author of song.authors) {
          if (author.songwriter) {
            const id = author.songwriter.id;
            if (writerMap.has(id)) {
              // Add author share to existing entry
              writerMap.get(id).share_percentage += authorShare;
            } else {
              writerMap.set(id, {
                ...author.songwriter,
                share_percentage: authorShare
              });
            }
          }
        }
      }
      if (song.composers?.length) {
        for (const composer of song.composers) {
          if (composer.songwriter) {
            const id = composer.songwriter.id;
            if (writerMap.has(id)) {
              // Add composer share to existing entry (person is both author and composer)
              writerMap.get(id).share_percentage += composerShare;
            } else {
              writerMap.set(id, {
                ...composer.songwriter,
                share_percentage: composerShare
              });
            }
          }
        }
      }

      const writers = Array.from(writerMap.values());

      // If no writers, add song with empty writer info
      if (writers.length === 0) {
        const dataRow = worksheet.addRow([
          song.title,
          artistNames,
          '', // Song Description
          song.isrc || '',
          '', // PRO Work ID/IPI
          '✓', // Non-exclusive
          '', // DBP YouTube/Social Media Promotion
          releaseDate,
          'Melt Records', // Release Label
          releaseTitle,
          '', // Writer First Name
          '', // Writer Last Name
          'N/A', // Writer PRO
          'N/A', // Writer IPI
          '', // Writer Phone
          '', // Writer Email
          '', // Writer Cut %
          PUBLISHER_NAME,
          PUBLISHER_PRO,
          PUBLISHER_IPI,
          PUBLISHER_PHONE,
          PUBLISHER_EMAIL,
          PUBLISHER_CUT,
          PUBLISHER_NAME, // Master holder
          PUBLISHER_PHONE,
          PUBLISHER_EMAIL,
          PUBLISHER_CUT,
          '', // Featured Artist Name and Role
          '', // Featured Artist Real Name
          '' // Featured Artist Email
        ]);
        // Apply data row styling to all columns (with bottom border since it's the only row for this song)
        for (let col = 1; col <= 31; col++) {
          const cell = dataRow.getCell(col);
          cell.font = dataFont;
          cell.border = bottomBorder;
          if (col === 6) cell.fill = pinkFill;
        }
      } else {
        // Add row for first writer with all song info
        const firstWriter = writers[0];
        const nameParts = splitName(firstWriter.name || '');

        const dataRow = worksheet.addRow([
          song.title,
          artistNames,
          '', // Song Description
          song.isrc || '',
          '', // PRO Work ID/IPI
          '✓', // Non-exclusive
          '', // DBP YouTube/Social Media Promotion
          releaseDate,
          'Melt Records', // Release Label
          releaseTitle,
          nameParts.firstName,
          nameParts.lastName,
          firstWriter.pro_affiliation || 'N/A',
          firstWriter.ipi_number || 'N/A',
          '', // Writer Phone
          '', // Writer Email
          firstWriter.share_percentage || 100,
          PUBLISHER_NAME,
          PUBLISHER_PRO,
          PUBLISHER_IPI,
          PUBLISHER_PHONE,
          PUBLISHER_EMAIL,
          PUBLISHER_CUT,
          PUBLISHER_NAME, // Master holder
          PUBLISHER_PHONE,
          PUBLISHER_EMAIL,
          PUBLISHER_CUT,
          '', // Featured Artist Name and Role
          '', // Featured Artist Real Name
          '' // Featured Artist Email
        ]);
        // Apply data row styling to all columns (no border for first writer, border added to last)
        const isOnlyWriter = writers.length === 1;
        for (let col = 1; col <= 31; col++) {
          const cell = dataRow.getCell(col);
          cell.font = dataFont;
          if (isOnlyWriter) cell.border = bottomBorder;
          if (col === 6) cell.fill = pinkFill;
        }

        // Add additional rows for remaining writers (with only writer info)
        for (let i = 1; i < writers.length; i++) {
          const writer = writers[i];
          const writerNameParts = splitName(writer.name || '');
          const isLastWriter = i === writers.length - 1;

          const contRow = worksheet.addRow([
            '', // Song Title (empty for continuation rows)
            '', // Artist Name
            '', // Song Description
            '', // ISRC
            '', // PRO Work ID/IPI
            '', // Non-exclusive
            '', // DBP YouTube/Social Media Promotion
            '', // Release Date
            '', // Release Label
            '', // Album/EP Title
            writerNameParts.firstName,
            writerNameParts.lastName,
            writer.pro_affiliation || 'N/A',
            writer.ipi_number || 'N/A',
            '', // Writer Phone
            '', // Writer Email
            writer.share_percentage || 0,
            '', // Publisher (empty for continuation)
            '', // Publisher PRO
            '', // Publisher IPI
            '', // Publisher Phone
            '', // Publisher Email
            '', // Publisher Cut
            '', // Master holder
            '', // Master holder Phone
            '', // Master holder Email
            '', // Master holder Cut
            '', // Featured Artist
            '', // Featured Artist Real Name
            '' // Featured Artist Email
          ]);
          // Apply data row styling to all columns (bottom border only on last writer)
          for (let col = 1; col <= 31; col++) {
            const cell = contRow.getCell(col);
            cell.font = dataFont;
            if (isLastWriter) cell.border = bottomBorder;
          }
        }
      }
    }

    // Set column widths (matching the sample file)
    worksheet.columns = [
      { width: 30.33 }, // Song Title
      { width: 25.11 }, // Artist Name
      { width: 28.00 }, // Song Description
      { width: 17.11 }, // ISRC
      { width: 15.56 }, // PRO Work ID/IPI
      { width: 13.11 }, // Non-exclusive
      { width: 9.44 },  // DBP YouTube
      { width: 16.89 }, // Release Date
      { width: 20.56 }, // Release Label
      { width: 13.78 }, // Album/EP Title
      { width: 17.78 }, // Writer First Name
      { width: 16.78 }, // Writer Last Name
      { width: 38.67 }, // Writer PRO
      { width: 36.67 }, // Writer IPI
      { width: 16.89 }, // Writer Phone
      { width: 23.67 }, // Writer Email
      { width: 10.44 }, // Writer Cut %
      { width: 58.00 }, // Publisher Name
      { width: 16.67 }, // Publisher PRO
      { width: 16.22 }, // Publisher IPI
      { width: 13.11 }, // Publisher Phone
      { width: 19.78 }, // Publisher Email
      { width: 10.33 }, // Publisher Cut %
      { width: 25.00 }, // Master holder Name
      { width: 16.78 }, // Master holder Phone
      { width: 19.67 }, // Master holder Email
      { width: 11.67 }, // Master holder Cut %
      { width: 19.44 }, // Featured Artist Name
      { width: 19.22 }, // Featured Artist Real Name
      { width: 27.00 }, // Featured Artist Email
      { width: 35.89 }  // Notes
    ];

    // Sanitize pitch title for filename
    const sanitizedTitle = pitch.title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}_b-sheet.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error downloading B-Sheet:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download B-Sheet' });
    }
  }
};

/**
 * Helper function to split a full name into first and last name
 * Last name is the last word, first name is everything else
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}
