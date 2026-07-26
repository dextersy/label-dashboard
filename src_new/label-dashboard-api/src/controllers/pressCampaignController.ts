import { Request, Response } from 'express';
import { Op } from 'sequelize';
import multer from 'multer';
import Groq from 'groq-sdk';
import {
  PressCampaign,
  PressCampaignArtistPhoto,
  PressCampaignLink,
  Artist,
  ArtistImage,
  Release,
  Song,
  SongAuthor,
  SongComposer,
  Songwriter,
  Event,
  User,
  Brand,
} from '../models';
import { uploadToS3, deleteFromS3, getS3ObjectStream, headS3Object } from '../utils/s3Service';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  AlignmentType,
  UnderlineType,
  Header,
  Footer,
  ImageRun,
  PageNumber,
  NumberFormat,
} from 'docx';
import { parse as parseHtml } from 'node-html-parser';
import axios from 'axios';
import crypto from 'crypto';

// --- Multer config ---

const storage = multer.memoryStorage();

const imageFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const audioFilter = (req: any, file: any, cb: any) => {
  const name = file.originalname.toLowerCase();
  const isAudio = file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || name.endsWith('.mp3');
  const isZip = file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || name.endsWith('.zip');
  if (isAudio || isZip) {
    cb(null, true);
  } else {
    cb(new Error('Only MP3 or ZIP files are allowed'), false);
  }
};

export const photoUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const coverArtUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const mp3Upload = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// --- Helpers ---

function escapeLikeWildcards(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${base}-${rand}`;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface InlineStyle { bold?: boolean; italics?: boolean; underline?: boolean }

function nodeToTextRuns(node: any, style: InlineStyle = {}): TextRun[] {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = decodeHtmlEntities(node.rawText || '');
    if (!text) return [];
    return [new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
    })];
  }

  const tag = node.tagName?.toLowerCase();
  const childStyle: InlineStyle = {
    bold: style.bold || tag === 'strong' || tag === 'b',
    italics: style.italics || tag === 'em' || tag === 'i',
    underline: style.underline || tag === 'u',
  };

  const runs: TextRun[] = [];
  for (const child of node.childNodes || []) {
    runs.push(...nodeToTextRuns(child, childStyle));
  }
  return runs;
}

function hasVisibleContent(node: any): boolean {
  for (const child of node.childNodes || []) {
    const tag = child.tagName?.toLowerCase();
    if (tag === 'br') continue;
    if (child.nodeType === 3 && !child.rawText?.trim()) continue;
    return true;
  }
  return false;
}

function paragraphFromSegments(node: any, opts: { indent?: any; spacing?: number } = {}): Paragraph[] {
  // Split child nodes on <br> to produce separate lines within the same paragraph block
  const segments: any[][] = [[]];
  for (const child of node.childNodes || []) {
    if (child.tagName?.toLowerCase() === 'br') {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(child);
    }
  }
  return segments.map((seg, i) => {
    const runs = seg.flatMap((c: any) => nodeToTextRuns(c));
    const isLast = i === segments.length - 1;
    return new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      spacing: { after: isLast ? (opts.spacing ?? 120) : 0 },
      indent: opts.indent,
    });
  });
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
  if (!html) return [];
  const root = parseHtml(html);
  const paragraphs: Paragraph[] = [];

  function processNode(node: any): void {
    // Plain text node at root level (bio stored without HTML tags)
    if (node.nodeType === 3) {
      const text = decodeHtmlEntities(node.rawText || '').trim();
      if (text) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text })],
          spacing: { after: 120 },
        }));
      }
      return;
    }

    const tag = node.tagName?.toLowerCase();

    if (tag === 'p' || tag === 'div') {
      if (!hasVisibleContent(node)) {
        // Empty paragraph — adds one blank line's worth of extra space before next paragraph
        paragraphs.push(new Paragraph({ children: [new TextRun('')], spacing: { before: 0, after: 0 } }));
      } else {
        paragraphs.push(...paragraphFromSegments(node));
      }
    } else if (tag === 'blockquote') {
      if (hasVisibleContent(node)) {
        paragraphs.push(...paragraphFromSegments(node, { indent: { left: 720 } }));
      }
    } else if (tag === 'ul' || tag === 'ol') {
      let idx = 1;
      for (const li of node.childNodes || []) {
        if (li.tagName?.toLowerCase() === 'li') {
          const prefix = tag === 'ol' ? `${idx++}. ` : '• ';
          const runs = nodeToTextRuns(li);
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: prefix }), ...runs],
            spacing: { after: 100 },
          }));
        }
      }
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const runs = nodeToTextRuns(node, { bold: true });
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 160 } }));
    } else {
      for (const child of node.childNodes || []) {
        processNode(child);
      }
    }
  }

  for (const child of root.childNodes) {
    processNode(child);
  }

  return paragraphs;
}

async function enrichCampaign(campaign: any): Promise<any> {
  const plain = campaign.toJSON ? campaign.toJSON() : { ...campaign };
  const brandId = plain.brand_id;

  // For event campaigns: fetch artist (by artist_id) with photos
  // For release campaigns: artists come from the release
  if (plain.campaign_type === 'event' && plain.artist_id) {
    const artist = await Artist.findOne({
      where: { id: plain.artist_id, brand_id: brandId },
      attributes: ['id', 'name', 'bio', 'profile_photo', 'instagram_handle', 'facebook_handle', 'twitter_handle', 'tiktok_handle', 'youtube_channel'],
      include: [{ model: ArtistImage, as: 'images', attributes: ['id', 'path', 'credits', 'display_order'] }],
    });
    plain.artist = artist ? artist.toJSON() : null;
  }

  // Fetch event if event_id is set
  if (plain.event_id) {
    const event = await Event.findOne({
      where: { id: plain.event_id, brand_id: brandId },
      attributes: ['id', 'title', 'date_and_time', 'venue', 'venue_address', 'poster_url', 'description', 'status', 'external_ticket_link', 'buy_shortlink'],
    });
    plain.event = event ? event.toJSON() : null;
  }

  // Fetch release with artists and songs if release_id is set
  if (plain.release_id) {
    const release = await Release.findOne({
      where: { id: plain.release_id, brand_id: brandId },
      attributes: ['id', 'title', 'catalog_no', 'cover_art', 'release_date', 'liner_notes', 'spotify_link', 'apple_music_link', 'youtube_link'],
      include: [
        {
          model: Artist,
          as: 'artists',
          attributes: ['id', 'name', 'bio', 'profile_photo', 'instagram_handle', 'facebook_handle', 'twitter_handle', 'tiktok_handle', 'youtube_channel'],
          through: { attributes: [] },
        },
        {
          model: Song,
          as: 'songs',
          attributes: ['id', 'title', 'isrc', 'duration', 'audio_file_mp3'],
          through: { attributes: ['track_number'] },
          include: [
            {
              model: SongAuthor,
              as: 'authors',
              include: [{ model: Songwriter, as: 'songwriter', attributes: ['id', 'name'] }],
            },
            {
              model: SongComposer,
              as: 'composers',
              include: [{ model: Songwriter, as: 'songwriter', attributes: ['id', 'name'] }],
            },
          ],
        },
      ],
    });
    plain.release = release ? release.toJSON() : null;
  }

  return plain;
}

// --- CRUD Endpoints ---

export const getPressCampaigns = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const allowedSortFields: Record<string, string> = {
      title: 'title',
      createdAt: 'createdAt',
      status: 'status',
    };
    const sortField = allowedSortFields[req.query.sort_field as string] || 'createdAt';
    const sortOrder = req.query.sort_order === 'ASC' ? 'ASC' : 'DESC';

    const where: any = { brand_id: brandId };

    if (req.query.title) {
      where.title = { [Op.like]: `%${escapeLikeWildcards(req.query.title as string)}%` };
    }
    if (req.query.status === 'Draft' || req.query.status === 'Published') {
      where.status = req.query.status;
    }

    const { count, rows } = await PressCampaign.findAndCountAll({
      where,
      include: [
        { model: Artist, as: 'artist', attributes: ['id', 'name', 'profile_photo'] },
        { model: Release, as: 'release', attributes: ['id', 'title', 'cover_art'] },
        { model: Event, as: 'event', attributes: ['id', 'title', 'date_and_time', 'venue', 'poster_url'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'username'] },
        { model: PressCampaignArtistPhoto, as: 'artistPhotos', attributes: ['id', 'path', 'label', 'sort_order'] },
        { model: PressCampaignLink, as: 'links', attributes: ['id', 'label', 'url', 'sort_order'] },
      ],
      order: [[sortField, sortOrder]],
      limit,
      offset,
      distinct: true,
    });

    res.json({
      campaigns: rows,
      pagination: {
        page,
        totalPages: Math.ceil(count / limit),
        total: count,
        limit,
      },
    });
  } catch (error: any) {
    console.error('Error fetching press campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPressCampaign = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const campaign = await PressCampaign.findOne({
      where: { id, brand_id: brandId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'username'] },
        { model: PressCampaignArtistPhoto, as: 'artistPhotos', attributes: ['id', 'path', 'label', 'sort_order'] },
        { model: PressCampaignLink, as: 'links', attributes: ['id', 'label', 'url', 'sort_order'], order: [['sort_order', 'ASC']] as any },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const enriched = await enrichCampaign(campaign);
    res.json({ campaign: enriched });
  } catch (error: any) {
    console.error('Error fetching press campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPressCampaign = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const userId = (req as any).user.id;
    const { title, writeup, campaign_type, release_id, artist_id, event_id, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const type: 'release' | 'event' = campaign_type === 'event' ? 'event' : 'release';

    // Validate that linked IDs belong to this brand
    if (type === 'release' && release_id) {
      const release = await Release.findOne({ where: { id: release_id, brand_id: brandId } });
      if (!release) return res.status(400).json({ error: 'Release not found' });
    }
    if (type === 'event' && event_id) {
      const event = await Event.findOne({ where: { id: event_id, brand_id: brandId } });
      if (!event) return res.status(400).json({ error: 'Event not found' });
    }
    if (type === 'event' && artist_id) {
      const artist = await Artist.findOne({ where: { id: artist_id, brand_id: brandId } });
      if (!artist) return res.status(400).json({ error: 'Artist not found' });
    }

    const slug = generateSlug(title.trim());

    const campaign = await PressCampaign.create({
      brand_id: brandId,
      title: title.trim(),
      writeup: writeup || null,
      campaign_type: type,
      release_id: type === 'release' ? (release_id || null) : null,
      artist_id: type === 'event' ? (artist_id || null) : null,
      event_id: type === 'event' ? (event_id || null) : null,
      public_slug: slug,
      status: status === 'Published' ? 'Published' : 'Draft',
      created_by: userId,
    } as any);

    const enriched = await enrichCampaign(campaign);
    res.status(201).json({ campaign: enriched });
  } catch (error: any) {
    console.error('Error creating press campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePressCampaign = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;
    const { title, writeup, campaign_type, release_id, artist_id, event_id, status } = req.body;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    if (title !== undefined) campaign.title = title.trim();
    if (writeup !== undefined) campaign.writeup = writeup || null;
    if (campaign_type !== undefined && (campaign_type === 'release' || campaign_type === 'event')) {
      campaign.campaign_type = campaign_type;
    }
    const type = campaign.campaign_type;
    if (type === 'release') {
      if (release_id !== undefined) {
        if (release_id) {
          const release = await Release.findOne({ where: { id: release_id, brand_id: brandId } });
          if (!release) return res.status(400).json({ error: 'Release not found' });
        }
        campaign.release_id = release_id || null;
      }
      campaign.artist_id = null;
      campaign.event_id = null;
    } else {
      if (event_id !== undefined) {
        if (event_id) {
          const event = await Event.findOne({ where: { id: event_id, brand_id: brandId } });
          if (!event) return res.status(400).json({ error: 'Event not found' });
        }
        campaign.event_id = event_id || null;
      }
      if (artist_id !== undefined) {
        if (artist_id) {
          const artist = await Artist.findOne({ where: { id: artist_id, brand_id: brandId } });
          if (!artist) return res.status(400).json({ error: 'Artist not found' });
        }
        campaign.artist_id = artist_id || null;
      }
      campaign.release_id = null;
    }
    if (status !== undefined && (status === 'Draft' || status === 'Published')) {
      campaign.status = status;
    }

    await campaign.save();

    const enriched = await enrichCampaign(campaign);
    res.json({ campaign: enriched });
  } catch (error: any) {
    console.error('Error updating press campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePressCampaign = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const campaign = await PressCampaign.findOne({
      where: { id, brand_id: brandId },
      include: [{ model: PressCampaignArtistPhoto, as: 'artistPhotos' }],
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    // Delete S3 files for artist photos
    const photos = (campaign as any).artistPhotos || [];
    for (const photo of photos) {
      try {
        const key = new URL(photo.path).pathname.replace(/^\//, '');
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete artist photo from S3:', e);
      }
    }

    // Delete cover art and mp3 if custom
    if (campaign.cover_art) {
      try {
        const key = new URL(campaign.cover_art).pathname.replace(/^\//, '');
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete cover art from S3:', e);
      }
    }
    if (campaign.mp3_file) {
      try {
        const key = new URL(campaign.mp3_file).pathname.replace(/^\//, '');
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete MP3 from S3:', e);
      }
    }

    await campaign.destroy();
    res.json({ message: 'Press campaign deleted' });
  } catch (error: any) {
    console.error('Error deleting press campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- File upload endpoints ---

export const uploadCoverArt = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old cover art if it was custom
    if (campaign.cover_art) {
      try {
        const key = new URL(campaign.cover_art).pathname.replace(/^\//, '');
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete old cover art from S3:', e);
      }
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = `press-campaigns/${brandId}/${id}/cover-art-${Date.now()}.${ext}`;

    const result = await uploadToS3({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    campaign.cover_art = result.Location;
    await campaign.save();

    res.json({ cover_art: result.Location });
  } catch (error: any) {
    console.error('Error uploading cover art:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadMp3 = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old MP3 if custom
    if (campaign.mp3_file) {
      try {
        const key = new URL(campaign.mp3_file).pathname.replace(/^\//, '');
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete old MP3 from S3:', e);
      }
    }

    const isZip = file.originalname.toLowerCase().endsWith('.zip')
      || file.mimetype === 'application/zip'
      || file.mimetype === 'application/x-zip-compressed';
    const ext = isZip ? 'zip' : 'mp3';
    const contentType = isZip ? 'application/zip' : 'audio/mpeg';
    const key = `press-campaigns/${brandId}/${id}/track-${Date.now()}.${ext}`;

    const result = await uploadToS3({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: contentType,
    });

    campaign.mp3_file = result.Location;
    await campaign.save();

    res.json({ mp3_file: result.Location });
  } catch (error: any) {
    console.error('Error uploading MP3:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadArtistPhoto = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const label = req.body.label || null;

    // Get current max sort order
    const maxPhoto = await PressCampaignArtistPhoto.findOne({
      where: { campaign_id: id },
      order: [['sort_order', 'DESC']],
    });
    const sortOrder = maxPhoto ? (maxPhoto as any).sort_order + 1 : 0;

    const ext = file.originalname.split('.').pop() || 'jpg';
    const key = `press-campaigns/${brandId}/${id}/photos/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const result = await uploadToS3({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    const photo = await PressCampaignArtistPhoto.create({
      campaign_id: parseInt(id as string),
      path: result.Location,
      label,
      sort_order: sortOrder,
    } as any);

    res.status(201).json({ photo });
  } catch (error: any) {
    console.error('Error uploading artist photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteArtistPhoto = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id, photoId } = req.params;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const photo = await PressCampaignArtistPhoto.findOne({
      where: { id: photoId, campaign_id: id },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    try {
      const key = new URL(photo.path).pathname.replace(/^\//, '');
      await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
    } catch (e) {
      console.warn('Could not delete photo from S3:', e);
    }

    await photo.destroy();
    res.json({ message: 'Photo deleted' });
  } catch (error: any) {
    console.error('Error deleting artist photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateArtistPhotoLabel = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id, photoId } = req.params;
    const { label } = req.body;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const photo = await PressCampaignArtistPhoto.findOne({
      where: { id: photoId, campaign_id: id },
    });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    (photo as any).label = label || null;
    await photo.save();

    res.json({ photo });
  } catch (error: any) {
    console.error('Error updating photo label:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reorderArtistPhotos = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;
    const { order } = req.body; // Array of photo IDs in desired order

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of photo IDs' });
    }

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    await Promise.all(
      order.map((photoId: number, index: number) =>
        PressCampaignArtistPhoto.update(
          { sort_order: index } as any,
          { where: { id: photoId, campaign_id: id } }
        )
      )
    );

    const photos = await PressCampaignArtistPhoto.findAll({
      where: { campaign_id: id },
      order: [['sort_order', 'ASC']],
    });

    res.json({ photos });
  } catch (error: any) {
    console.error('Error reordering photos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Campaign Link CRUD ---

export const addCampaignLink = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;
    const { label, url } = req.body;

    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) return res.status(404).json({ error: 'Press campaign not found' });

    const maxLink = await PressCampaignLink.findOne({
      where: { campaign_id: id },
      order: [['sort_order', 'DESC']],
    });
    const nextOrder = maxLink ? (maxLink as any).sort_order + 1 : 0;

    const link = await PressCampaignLink.create({
      campaign_id: Number(id),
      label: label.trim(),
      url: url.trim(),
      sort_order: nextOrder,
    });

    res.status(201).json({ link });
  } catch (error: any) {
    console.error('Error adding campaign link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCampaignLink = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id, linkId } = req.params;
    const { label, url } = req.body;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) return res.status(404).json({ error: 'Press campaign not found' });

    const link = await PressCampaignLink.findOne({ where: { id: linkId, campaign_id: id } });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const updates: any = {};
    if (label !== undefined) updates.label = label.trim();
    if (url !== undefined) updates.url = url.trim();

    await link.update(updates);
    res.json({ link });
  } catch (error: any) {
    console.error('Error updating campaign link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCampaignLink = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id, linkId } = req.params;

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) return res.status(404).json({ error: 'Press campaign not found' });

    const link = await PressCampaignLink.findOne({ where: { id: linkId, campaign_id: id } });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    await link.destroy();
    res.json({ message: 'Link deleted' });
  } catch (error: any) {
    console.error('Error deleting campaign link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Public endpoint (no auth) ---

export const getPublicCampaign = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const campaign = await PressCampaign.findOne({
      where: { public_slug: slug, status: 'Published' },
      include: [
        { model: PressCampaignArtistPhoto, as: 'artistPhotos', order: [['sort_order', 'ASC']] as any },
        { model: PressCampaignLink, as: 'links', attributes: ['id', 'label', 'url', 'sort_order'], order: [['sort_order', 'ASC']] as any },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const enriched = await enrichCampaign(campaign);

    // Remove internal fields for public response
    delete enriched.brand_id;
    delete enriched.created_by;
    delete enriched.creator;

    res.json({ campaign: enriched });
  } catch (error: any) {
    console.error('Error fetching public press campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Public file proxy download ---

/**
 * Extract an S3 object key from a public URL stored in the database.
 * Supports both standard AWS URLs and custom endpoints (R2, MinIO, etc.).
 *
 * Standard:  https://<bucket>.s3.<region>.amazonaws.com/<key>  → <key>
 * Custom:    https://<endpoint>/<bucket>/<key>                 → <key>
 */
function extractS3Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    const bucket = process.env.S3_BUCKET || '';
    if (!bucket) return null;

    let key: string;
    if (process.env.S3_ENDPOINT) {
      // Custom endpoint: path is /<bucket>/<key>
      const prefix = `/${bucket}/`;
      if (!parsed.pathname.startsWith(prefix)) return null;
      key = parsed.pathname.slice(prefix.length);
    } else {
      // Standard AWS: hostname is <bucket>.s3.<region>.amazonaws.com
      if (!parsed.hostname.startsWith(`${bucket}.`)) return null;
      key = parsed.pathname.slice(1); // strip leading /
    }

    // Reject path traversal sequences
    if (key.includes('..') || key.includes('%2e%2e') || key.includes('%2E%2E')) return null;

    return key || null;
  } catch {
    return null;
  }
}

export const proxyDownload = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { url, filename } = req.query as { url?: string; filename?: string };

    if (!url) return res.status(400).json({ error: 'url is required' });

    // Validate the campaign exists and is published
    const campaign = await PressCampaign.findOne({
      where: { public_slug: slug, status: 'Published' },
      include: [{ model: PressCampaignArtistPhoto, as: 'artistPhotos' }],
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Validate the requested URL/key belongs to this campaign's own files.
    // Enrich to get release/event cover art and song audio URLs.
    const enriched = await enrichCampaign(campaign);

    // Song audio files are stored as raw S3 keys (not full URLs) in S3_BUCKET_MASTERS.
    // All other files (cover art, photos) are stored as full URLs in S3_BUCKET.
    const songAudioKeys = new Set<string>();
    for (const song of enriched.release?.songs || []) {
      if (song.audio_file_mp3) songAudioKeys.add(song.audio_file_mp3);
    }

    const campaignUrls = new Set<string>();
    if (enriched.release?.cover_art) campaignUrls.add(enriched.release.cover_art);
    if (enriched.event?.poster_url) campaignUrls.add(enriched.event.poster_url);
    for (const photo of (campaign as any).artistPhotos || []) {
      if (photo.path) campaignUrls.add(photo.path);
    }

    let bucket: string;
    let key: string;

    if (songAudioKeys.has(url)) {
      // url is actually a raw S3 key for a song audio file
      bucket = process.env.S3_BUCKET_MASTERS || '';
      key = url;
    } else if (campaignUrls.has(url)) {
      // url is a full S3 URL for cover art / photos
      bucket = process.env.S3_BUCKET || '';
      const extracted = extractS3Key(url);
      if (!extracted) return res.status(403).json({ error: 'URL not allowed' });
      key = extracted;
    } else {
      return res.status(403).json({ error: 'URL not allowed' });
    }

    const headData = await headS3Object({ Bucket: bucket, Key: key });
    const fileSize = headData.ContentLength || 0;
    const contentType = headData.ContentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (filename) {
      const safeFilename = filename.replace(/[^\w.\-]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    const range = req.headers.range;
    if (range && fileSize) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const s3Response = await getS3ObjectStream({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end}` });
      s3Response.Body.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      const s3Response = await getS3ObjectStream({ Bucket: bucket, Key: key });
      s3Response.Body.pipe(res);
    }
  } catch (error: any) {
    console.error('Error proxying download:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Public artist photos ZIP ---

export const downloadArtistPhotosZip = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const campaign = await PressCampaign.findOne({
      where: { public_slug: slug, status: 'Published' },
      include: [{ model: PressCampaignArtistPhoto, as: 'artistPhotos', order: [['sort_order', 'ASC']] as any }],
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const enriched = await enrichCampaign(campaign);

    // --- Resolve all files to stream BEFORE touching the response ---
    type ZipEntry = { key: string; name: string };
    const entries: ZipEntry[] = [];

    if (enriched.campaign_type === 'event') {
      // Event campaigns: photos uploaded directly to the campaign
      const photos: any[] = enriched.artistPhotos || [];
      if (photos.length === 0) return res.status(404).json({ error: 'No artist photos available' });
      for (let i = 0; i < photos.length; i++) {
        const key = extractS3Key(photos[i].path);
        if (!key) continue;
        const ext = (key.split('.').pop() || 'jpg').toLowerCase();
        entries.push({ key, name: `photo-${i + 1}.${ext}` });
      }
    } else {
      // Release campaigns: each collaborating artist's ArtistImage media library (up to 5 per artist)
      const releaseArtists: { id: number; name: string }[] = (enriched.release?.artists || [])
        .map((a: any) => ({ id: a.id, name: a.name }));
      if (releaseArtists.length === 0) return res.status(404).json({ error: 'No artists found' });

      const artistImages: { artist: { id: number; name: string }; images: any[] }[] = [];
      for (const artist of releaseArtists) {
        const images = await ArtistImage.findAll({
          where: { artist_id: artist.id, exclude_from_epk: false },
          order: [['display_order', 'ASC'], ['date_uploaded', 'DESC']],
          limit: 5,
        });
        if (images.length > 0) artistImages.push({ artist, images });
      }
      if (artistImages.length === 0) return res.status(404).json({ error: 'No artist photos available' });

      const useSubfolders = artistImages.length > 1;
      for (const { artist, images } of artistImages) {
        const safeArtist = artist.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
        const folder = useSubfolders ? `${safeArtist}/` : '';
        for (let i = 0; i < images.length; i++) {
          const key = extractS3Key(images[i].path);
          if (!key) continue;
          const ext = (key.split('.').pop() || 'jpg').toLowerCase();
          entries.push({ key, name: `${folder}${safeArtist}-${i + 1}.${ext}` });
        }
      }
    }

    if (entries.length === 0) return res.status(404).json({ error: 'No artist photos available' });

    // --- All validation passed — start streaming ---
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 6 } });
    const safeTitle = enriched.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}-Artist-Photos.zip"`);
    archive.pipe(res);

    for (const entry of entries) {
      try {
        const s3Response = await getS3ObjectStream({ Bucket: process.env.S3_BUCKET || '', Key: entry.key });
        archive.append(s3Response.Body, { name: entry.name });
      } catch {
        // Skip files that fail to fetch from storage
      }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('Error generating artist photos ZIP:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Word Document download ---

async function fetchImageBuffer(url: string): Promise<{ data: Buffer; type: 'png' | 'jpg' | 'gif' | 'bmp' | 'svg' } | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const ct = (response.headers['content-type'] as string || '').toLowerCase();
    const type = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : ct.includes('bmp') ? 'bmp' : ct.includes('svg') ? 'svg' : 'jpg';
    return { data: Buffer.from(response.data), type };
  } catch {
    return null;
  }
}

export const downloadWordDoc = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const { id } = req.params;

    const [campaign, brand] = await Promise.all([
      PressCampaign.findOne({
        where: { id, brand_id: brandId },
        include: [
          { model: PressCampaignArtistPhoto, as: 'artistPhotos', order: [['sort_order', 'ASC']] as any },
          { model: PressCampaignLink, as: 'links', attributes: ['id', 'label', 'url', 'sort_order'], order: [['sort_order', 'ASC']] as any },
          { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
        ],
      }),
      Brand.findByPk(brandId, { attributes: ['id', 'brand_name', 'logo_url', 'brand_website'] }),
    ]);

    if (!campaign) {
      return res.status(404).json({ error: 'Press campaign not found' });
    }

    const enriched = await enrichCampaign(campaign);

    const coverArtUrl = enriched.release?.cover_art || enriched.event?.poster_url || null;
    const releaseSongs: any[] = (enriched.release?.songs || [])
      .filter((s: any) => s.audio_file_mp3)
      .sort((a: any, b: any) => (a.ReleaseSong?.track_number || 0) - (b.ReleaseSong?.track_number || 0));
    const brandFrontendUrl = await getBrandFrontendUrl(brandId);
    const publicPageUrl = `${brandFrontendUrl}/press/${enriched.public_slug}`;
    const apiBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const artistPhotosZipUrl = `${apiBase}/api/press-campaigns/public/${enriched.public_slug}/artist-photos.zip`;
    const photos: any[] = enriched.artistPhotos || [];

    // Fetch brand logo for header
    const logoImg = brand?.logo_url ? await fetchImageBuffer(brand.logo_url) : null;
    const contactEmail = (brand as any)?.brand_website || null;

    // --- Header (logo + contact email on non-first pages) ---
    const makeHeaderPara = (includeContact: boolean) => {
      const runs: any[] = [];
      if (logoImg) {
        runs.push(new ImageRun({
          data: logoImg.data,
          type: logoImg.type as any,
          transformation: { width: 100, height: 52 },
        }));
      }
      if (includeContact && contactEmail) {
        runs.push(new TextRun({ text: `\t${contactEmail}`, size: 18, color: '444444' }));
      }
      return new Paragraph({
        children: runs,
        tabStops: [{ type: 'right' as any, position: 9360 }],
      });
    };

    const firstPageHeader = new Header({ children: [makeHeaderPara(false)] });
    const defaultHeader = new Header({ children: [makeHeaderPara(true)] });

    // --- Footer (page numbers) ---
    const makeFooter = () => new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' }),
            new TextRun({ text: ' of ', size: 18, color: '666666' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '666666' }),
          ],
        }),
      ],
    });

    // --- Body ---
    const children: any[] = [];

    const addLink = (label: string, url: string | null, indent = false) => {
      if (!url) return;
      children.push(
        new Paragraph({
          indent: indent ? { left: 720 } : undefined,
          children: [
            new TextRun({ text: `${label} - `, bold: !indent }),
            new ExternalHyperlink({
              link: url,
              children: [new TextRun({ text: url, style: 'Hyperlink' })],
            }),
          ],
          spacing: { after: 100 },
        })
      );
    };

    const addPlainLink = (label: string, url: string) => {
      children.push(
        new Paragraph({
          indent: { left: 720 },
          children: [
            new ExternalHyperlink({
              link: url,
              children: [new TextRun({ text: label, style: 'Hyperlink' })],
            }),
          ],
          spacing: { after: 100 },
        })
      );
    };

    // "For immediate release"
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'For immediate release', italics: true, color: 'FF0000' })],
        spacing: { after: 160 },
      })
    );

    // Title
    children.push(
      new Paragraph({
        children: [new TextRun({ text: enriched.title, bold: true, size: 38 })],
        spacing: { before: 0, after: 120 },
      })
    );

    // Writeup
    if (enriched.writeup) {
      children.push(...htmlToDocxParagraphs(enriched.writeup));
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '[Press release writeup goes here]', color: '999999', italics: true })],
          spacing: { after: 240 },
        })
      );
    }

    children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));

    // Links (streaming/external only — no downloadable files)
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Links:', bold: true })],
        spacing: { after: 100 },
      })
    );
    addLink('Press Kit', publicPageUrl, true);
    if (enriched.release?.spotify_link) addLink('Spotify', enriched.release.spotify_link, true);
    if (enriched.release?.apple_music_link) addLink('Apple Music', enriched.release.apple_music_link, true);
    if (enriched.release?.youtube_link) addLink('YouTube', enriched.release.youtube_link, true);
    if (enriched.event?.buy_shortlink) addLink('Buy Tickets', enriched.event.buy_shortlink, true);
    else if (enriched.event?.external_ticket_link) addLink('Buy Tickets', enriched.event.external_ticket_link, true);
    for (const link of (enriched.links || [])) {
      addLink(link.label, link.url, true);
    }

    children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));

    // Attachments (downloadable files)
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Attachments:', bold: true })],
        spacing: { after: 100 },
      })
    );
    if (coverArtUrl) addPlainLink('Cover Art', coverArtUrl);
    for (const song of releaseSongs) {
      const songProxyUrl = `${apiBase}/api/press-campaigns/public/${enriched.public_slug}/download?url=${encodeURIComponent(song.audio_file_mp3)}&filename=${encodeURIComponent(song.title + '.mp3')}`;
      addPlainLink(song.title, songProxyUrl);
    }
    addPlainLink('Artist Photos (ZIP)', artistPhotosZipUrl);

    children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));

    // Credits section
    if (enriched.campaign_type === 'event' && enriched.event) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Event Details', bold: true })],
          spacing: { after: 100 },
        })
      );

      const addCredit = (label: string, value: string | null) => {
        if (!value) return;
        children.push(new Paragraph({
          children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: value })],
          spacing: { after: 80 },
          alignment: AlignmentType.JUSTIFIED,
        }));
      };

      addCredit('Event', enriched.event.title);
      if (enriched.event.date_and_time) {
        addCredit('Date & Time', new Date(enriched.event.date_and_time).toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }));
      }
      addCredit('Venue', enriched.event.venue);
      addCredit('Address', enriched.event.venue_address);

      if (enriched.event.description) {
        children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } }));
        children.push(...htmlToDocxParagraphs(enriched.event.description));
      }

    } else if (enriched.release) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Song Credits', bold: true })],
          spacing: { after: 100 },
        })
      );

      const songs: any[] = [...(enriched.release.songs || [])].sort((a, b) => (a.ReleaseSong?.track_number || 0) - (b.ReleaseSong?.track_number || 0));
      for (const song of songs) {
        const trackNum = song.ReleaseSong?.track_number;
        const num = trackNum ? `${trackNum}. ` : '• ';
        const isrc = song.isrc ? ` (ISRC: ${song.isrc})` : '';
        const authors = song.authors?.map((a: any) => a.songwriter?.name).filter(Boolean).join(', ');
        const composers = song.composers?.map((c: any) => c.songwriter?.name).filter(Boolean).join(', ');
        const creditParts = [authors ? `Written by: ${authors}` : '', composers ? `Composed by: ${composers}` : ''].filter(Boolean).join(' / ');
        children.push(new Paragraph({
          children: [new TextRun({ text: `${num}${song.title}${isrc}${creditParts ? ' — ' + creditParts : ''}` })],
          spacing: { after: 80 },
          alignment: AlignmentType.JUSTIFIED,
        }));
      }

      if (enriched.release.liner_notes) {
        children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Liner Notes', bold: true })],
          spacing: { after: 80 },
        }));
        children.push(...htmlToDocxParagraphs(enriched.release.liner_notes));
      }
    }

    // Artist profile(s)
    const hasSocials = (a: any) =>
      a.instagram_handle || a.facebook_handle || a.twitter_handle || a.tiktok_handle || a.youtube_channel;
    const artistsForSection: any[] = enriched.campaign_type === 'event'
      ? (enriched.artist && (enriched.artist.bio || hasSocials(enriched.artist)) ? [enriched.artist] : [])
      : (enriched.release?.artists?.filter((a: any) => a.bio || hasSocials(a)) || []);

    if (artistsForSection.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: artistsForSection.length === 1 ? 'Artist profile' : 'Artist profiles', bold: true, size: 40 })],
          spacing: { before: 400, after: 120 },
        })
      );

      for (const artist of artistsForSection) {
        if (artistsForSection.length > 1) {
          children.push(new Paragraph({
            children: [new TextRun({ text: artist.name, bold: true, size: 24 })],
            spacing: { after: 100 },
          }));
        }
        if (artist.bio) {
          children.push(...htmlToDocxParagraphs(artist.bio));
        }

        // Artist socials
        const socialLines: { label: string; url: string }[] = [];
        if (artist.instagram_handle) socialLines.push({ label: 'Instagram', url: `https://instagram.com/${artist.instagram_handle}` });
        if (artist.facebook_handle) socialLines.push({ label: 'Facebook', url: `https://facebook.com/${artist.facebook_handle}` });
        if (artist.twitter_handle) socialLines.push({ label: 'X / Twitter', url: `https://x.com/${artist.twitter_handle}` });
        if (artist.tiktok_handle) socialLines.push({ label: 'TikTok', url: `https://tiktok.com/@${artist.tiktok_handle}` });
        if (artist.youtube_channel) socialLines.push({ label: 'YouTube', url: artist.youtube_channel });

        if (socialLines.length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 60 } }));
          for (const social of socialLines) {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${social.label}: ` }),
                new ExternalHyperlink({
                  link: social.url,
                  children: [new TextRun({ text: social.url, style: 'Hyperlink', underline: { type: UnderlineType.SINGLE } })],
                }),
              ],
              spacing: { after: 60 },
            }));
          }
        }
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 22 } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
            titlePage: true,
          } as any,
          headers: { first: firstPageHeader, default: defaultHeader },
          footers: { first: makeFooter(), default: makeFooter() },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeTitle = enriched.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}-Press-Release.docx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error generating Word document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Search helpers for the create/edit form ---

export const searchReleases = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const search = (req.query.search as string) || '';

    if (search.length < 1) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const releases = await Release.findAll({
      where: {
        brand_id: brandId,
        title: { [Op.like]: `%${escapeLikeWildcards(search)}%` },
      },
      attributes: ['id', 'title', 'cover_art', 'catalog_no', 'release_date'],
      include: [{ model: Artist, as: 'artists', attributes: ['id', 'name'], through: { attributes: [] } }],
      limit: 20,
      order: [['title', 'ASC']],
    });

    res.json({ releases });
  } catch (error: any) {
    console.error('Error searching releases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const searchArtists = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const search = (req.query.search as string) || '';

    if (search.length < 1) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const artists = await Artist.findAll({
      where: {
        brand_id: brandId,
        name: { [Op.like]: `%${escapeLikeWildcards(search)}%` },
        status: 'Active',
      },
      attributes: ['id', 'name', 'profile_photo', 'bio'],
      limit: 20,
      order: [['name', 'ASC']],
    });

    res.json({ artists });
  } catch (error: any) {
    console.error('Error searching artists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchEvents = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const search = (req.query.search as string) || '';

    if (search.length < 1) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const events = await Event.findAll({
      where: {
        brand_id: brandId,
        title: { [Op.like]: `%${escapeLikeWildcards(search)}%` },
      },
      attributes: ['id', 'title', 'date_and_time', 'venue', 'poster_url', 'status'],
      limit: 20,
      order: [['date_and_time', 'DESC']],
    });

    res.json({ events });
  } catch (error: any) {
    console.error('Error searching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- AI Writeup Generation ---

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'in a professional and formal tone',
  conversational: 'in a conversational and approachable tone',
  enthusiastic: 'in an enthusiastic and energetic tone',
  minimalist: 'in a minimalist, concise style with short sentences',
};

export const generateWriteup = async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).user.brand_id;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const campaign = await PressCampaign.findOne({ where: { id, brand_id: brandId } });
    if (!campaign) return res.status(404).json({ error: 'Press campaign not found' });

    const enriched = await enrichCampaign(campaign);

    const tone = (req.body.tone || '').toString().toLowerCase();
    const toneInstruction = TONE_INSTRUCTIONS[tone] || '';
    const additionalInstructions = (req.body.additionalInstructions || '').toString().trim();

    // Build prompt
    const parts: string[] = [];
    parts.push(`You are a music publicist writing a press release ${toneInstruction ? toneInstruction + ' ' : ''}for the following campaign.`);
    parts.push(`Campaign title: ${enriched.title}`);
    parts.push(`Campaign type: ${enriched.campaign_type}`);

    if (enriched.release) {
      const r = enriched.release;
      parts.push(`\nRelease information:`);
      parts.push(`- Title: ${r.title}`);
      if (r.release_date) parts.push(`- Release date: ${new Date(r.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
      if (r.liner_notes) parts.push(`- Liner notes / description: ${r.liner_notes}`);
      if (r.artists?.length) {
        parts.push(`- Artists: ${r.artists.map((a: any) => a.name).join(', ')}`);
        for (const artist of r.artists) {
          if (artist.bio) parts.push(`- ${artist.name} bio: ${artist.bio}`);
        }
      }
      if (r.songs?.length) {
        const songList = [...r.songs]
          .sort((a: any, b: any) => (a.ReleaseSong?.track_number || 0) - (b.ReleaseSong?.track_number || 0))
          .map((s: any) => s.title)
          .join(', ');
        parts.push(`- Track titles (mention naturally in prose, do not list as bullets): ${songList}`);
      }
    }

    if (enriched.event) {
      const e = enriched.event;
      parts.push(`\nEvent information:`);
      parts.push(`- Event: ${e.title}`);
      if (e.date_and_time) parts.push(`- Date: ${new Date(e.date_and_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
      if (e.venue) parts.push(`- Venue: ${e.venue}`);
      if (e.venue_address) parts.push(`- Address: ${e.venue_address}`);
      if (e.description) parts.push(`- Description: ${e.description}`);
    }

    if (enriched.artist) {
      const a = enriched.artist;
      parts.push(`\nArtist: ${a.name}`);
      if (a.bio) parts.push(`Artist bio: ${a.bio}`);
    }

    if (additionalInstructions) {
      parts.push(`\nAdditional instructions from the user: ${additionalInstructions}`);
    }

    // Determine if the release/event is upcoming or already out
    let isUpcoming = false;
    if (enriched.release?.release_date) {
      isUpcoming = new Date(enriched.release.release_date) > new Date();
    } else if (enriched.event?.date_and_time) {
      isUpcoming = new Date(enriched.event.date_and_time) > new Date();
    }

    parts.push(`\nWrite a compelling press release for this campaign. Important rules:
- Use only these HTML tags: <p>, <strong>, <em>. No lists, no blockquotes.
- Every paragraph must be wrapped in <p> tags.
- Use <strong> for artist names and key phrases.
- Wrap release/album/EP titles in <em> tags (e.g. <em>Album Title</em>).
- Wrap song titles in double quotes (e.g. "Song Title"). If a song title appears inside an existing quoted passage, use single quotes instead (e.g. 'Song Title').
- Mention song titles naturally within prose paragraphs — never as a bullet list.
- Include at least one fabricated but believable quote from the artist or band about the release or event, written as a natural paragraph with the quote inline (e.g. <p>"Quote here," says <strong>Artist Name</strong>. "Continued quote."</p>).
- Do not include a subject line, "FOR IMMEDIATE RELEASE" header, catalog numbers, or any markdown — just the formatted HTML body paragraphs.
- Always end the article with a call-to-action paragraph wrapped in <p> tags. ${isUpcoming ? 'Since this is an upcoming release/event, the CTA should tell readers it is available for pre-save.' : 'Since this is an already-released work, the CTA should tell readers it is now available on all major streaming platforms.'} The CTA text must be wrapped in <strong> tags.`);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI generation is not configured. Set GROQ_API_KEY.' });

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: parts.join('\n') }],
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content || '';

    return res.json({ writeup: text });
  } catch (error: any) {
    console.error('Error generating writeup:', error);
    res.status(500).json({ error: 'Failed to generate writeup' });
  }
};
