import { Request, Response } from 'express';
import { Artist, Brand, Release, Payment, Royalty, ArtistImage, ArtistDocument, ArtistAccess, User, ReleaseArtist } from '../models';
import { sendBrandedEmail } from '../utils/emailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import AWS from 'aws-sdk';

const unlinkAsync = promisify(fs.unlink);

interface AuthRequest extends Request {
  user?: any;
}

export const getArtists = async (req: AuthRequest, res: Response) => {
  try {
    const artists = await Artist.findAll({
      where: { brand_id: req.user.brand_id },
      include: [
        { model: Brand, as: 'brand' },
        { model: Release, as: 'releases' },
        { model: ArtistImage, as: 'images' }
      ],
      order: [['name', 'ASC']]
    });

    res.json({ artists });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
      include: [
        { model: Brand, as: 'brand' },
        { model: Release, as: 'releases' },
        { model: Payment, as: 'payments' },
        { model: Royalty, as: 'royalties' },
        { model: ArtistImage, as: 'images' },
        { model: ArtistDocument, as: 'documents' }
      ]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json({ artist });
  } catch (error) {
    console.error('Get artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createArtist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      name,
      facebook_handle,
      instagram_handle,
      twitter_handle,
      tiktok_handle,
      bio,
      website_page_url,
      band_members,
      youtube_channel,
      payout_point
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    const artist = await Artist.create({
      name,
      facebook_handle,
      instagram_handle,
      twitter_handle,
      tiktok_handle,
      bio,
      website_page_url,
      band_members,
      youtube_channel,
      payout_point: payout_point || 1000,
      brand_id: req.user.brand_id
    });

    res.status(201).json({
      message: 'Artist created successfully',
      artist
    });
  } catch (error) {
    console.error('Create artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      facebook_handle,
      instagram_handle,
      twitter_handle,
      tiktok_handle,
      bio,
      website_page_url,
      band_members,
      youtube_channel,
      payout_point,
      notify_changes = false
    } = req.body;

    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Handle profile photo upload if provided
    let profilePhotoUrl = artist.profile_photo;
    if (req.file) {
      // Generate unique filename for S3
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(req.file.originalname);
      const fileName = `artist-profile-${id}-${uniqueSuffix}${extension}`;

      try {
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();
        profilePhotoUrl = result.Location;

        // Delete old profile photo from S3 if it exists
        if (artist.profile_photo && artist.profile_photo.startsWith('https://')) {
          try {
            const oldUrl = new URL(artist.profile_photo);
            const oldKey = oldUrl.pathname.substring(1);
            
            await s3.deleteObject({
              Bucket: process.env.S3_BUCKET!,
              Key: oldKey
            }).promise();
          } catch (deleteError) {
            console.error('Error deleting old profile photo:', deleteError);
          }
        }
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload profile photo' });
      }
    }

    // Store original values for change notification
    const originalValues = {
      name: artist.name,
      bio: artist.bio,
      website_page_url: artist.website_page_url,
      facebook_handle: artist.facebook_handle,
      instagram_handle: artist.instagram_handle,
      twitter_handle: artist.twitter_handle,
      tiktok_handle: artist.tiktok_handle
    };

    await artist.update({
      name: name || artist.name,
      facebook_handle,
      instagram_handle,
      twitter_handle,
      tiktok_handle,
      bio,
      website_page_url,
      band_members,
      youtube_channel,
      payout_point: payout_point || artist.payout_point,
      profile_photo: profilePhotoUrl
    });

    // Send notification email if requested and there are changes
    if (notify_changes) {
      const changes = [];
      if (originalValues.name !== artist.name) changes.push(`Name: ${originalValues.name} → ${artist.name}`);
      if (originalValues.bio !== artist.bio) changes.push('Bio updated');
      if (originalValues.website_page_url !== artist.website_page_url) changes.push('Website updated');
      if (originalValues.facebook_handle !== artist.facebook_handle) changes.push('Facebook handle updated');
      if (originalValues.instagram_handle !== artist.instagram_handle) changes.push('Instagram handle updated');
      if (originalValues.twitter_handle !== artist.twitter_handle) changes.push('Twitter handle updated');
      if (originalValues.tiktok_handle !== artist.tiktok_handle) changes.push('TikTok handle updated');

      if (changes.length > 0) {
        // Get all users with access to this artist
        const artistAccess = await ArtistAccess.findAll({
          where: { artist_id: id },
          include: [{ model: User, as: 'user' }]
        });

        const recipients = artistAccess.map(access => access.user.email_address);

        if (recipients.length > 0) {
          await sendBrandedEmail(
            recipients,
            `Artist Profile Updated: ${artist.name}`,
            'artist_update',
            {
              body: `
                <h2>Artist Profile Updated</h2>
                <p>The profile for ${artist.name} has been updated with the following changes:</p>
                <ul>
                  ${changes.map(change => `<li>${change}</li>`).join('')}
                </ul>
                <p>Updated by: ${req.user.first_name} ${req.user.last_name}</p>
              `
            },
            artist.brand
          );
        }
      }
    }

    res.json({
      message: 'Artist updated successfully',
      artist
    });
  } catch (error) {
    console.error('Update artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteArtist = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    await artist.destroy();

    res.json({ message: 'Artist deleted successfully' });
  } catch (error) {
    console.error('Delete artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setSelectedArtist = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id } = req.body;

    if (!artist_id) {
      return res.status(400).json({ error: 'Artist ID is required' });
    }

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id: artist_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // In a session-based system, you'd store this in session
    // For JWT-based system, you might return it for frontend to store
    res.json({ 
      message: 'Selected artist updated',
      selected_artist_id: artist_id,
      artist: {
        id: artist.id,
        name: artist.name
      }
    });
  } catch (error) {
    console.error('Set selected artist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePayoutSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { payout_point } = req.body;

    if (!payout_point || payout_point < 0) {
      return res.status(400).json({ error: 'Valid payout point is required' });
    }

    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const oldPayoutPoint = artist.payout_point;
    await artist.update({ payout_point });

    // Notify artist of payout point change
    const artistAccess = await ArtistAccess.findAll({
      where: { artist_id: id },
      include: [{ model: User, as: 'user' }]
    });

    const recipients = artistAccess.map(access => access.user.email_address);

    if (recipients.length > 0) {
      await sendBrandedEmail(
        recipients,
        `Payout Settings Updated: ${artist.name}`,
        'payout_update',
        {
          body: `
            <h2>Payout Settings Updated</h2>
            <p>Hi there!</p>
            <p>The payout threshold for ${artist.name} has been updated:</p>
            <ul>
              <li><strong>Previous threshold:</strong> $${oldPayoutPoint}</li>
              <li><strong>New threshold:</strong> $${payout_point}</li>
            </ul>
            <p>Payouts will now be processed when your balance reaches $${payout_point}.</p>
          `
        },
        artist.brand
      );
    }

    res.json({
      message: 'Payout settings updated successfully',
      payout_point
    });
  } catch (error) {
    console.error('Update payout settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getArtistBalance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Calculate total royalties
    const totalRoyalties = await Royalty.sum('amount', {
      where: { artist_id: id }
    }) || 0;

    // Calculate total payments
    const totalPayments = await Payment.sum('amount', {
      where: { artist_id: id }
    }) || 0;

    const balance = totalRoyalties - totalPayments;

    res.json({
      artist_id: id,
      artist_name: artist.name,
      total_royalties: totalRoyalties,
      total_payments: totalPayments,
      current_balance: balance,
      payout_point: artist.payout_point,
      ready_for_payout: balance >= artist.payout_point
    });
  } catch (error) {
    console.error('Get artist balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION
});

const s3 = new AWS.S3();

// Multer configuration for memory storage (for S3 upload)
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get artist photos
export const getArtistPhotos = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const photos = await ArtistImage.findAll({
      where: { artist_id: id },
      order: [['date_uploaded', 'DESC']],
      attributes: ['id', 'path', 'credits', 'date_uploaded']
    });

    // Transform the response to match frontend expectations
    const transformedPhotos = photos.map(photo => {
      // Extract filename from S3 URL or use the path directly if it's already a filename
      let filename;
      let photoUrl;
      
      try {
        const url = new URL(photo.path);
        filename = path.basename(url.pathname);
        // For S3 URLs, use the direct S3 URL
        photoUrl = photo.path;
      } catch (e) {
        filename = path.basename(photo.path);
        // For local files (legacy), use relative path
        photoUrl = photo.path;
      }
      
      return {
        id: photo.id,
        filename: filename,
        caption: photo.credits || '',
        upload_date: photo.date_uploaded,
        url: photoUrl
      };
    });

    res.json({ photos: transformedPhotos });
  } catch (error) {
    console.error('Get artist photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload artist photos
export const uploadArtistPhotos = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedPhotos = [];

    for (const file of req.files as Express.Multer.File[]) {
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const fileName = `artist-${id}-${uniqueSuffix}${extension}`;

      try {
        // Upload to S3
        const uploadParams = {
          Bucket: process.env.S3_BUCKET!,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype
        };

        const result = await s3.upload(uploadParams).promise();

        // Save to database with S3 URL
        const artistImage = await ArtistImage.create({
          path: result.Location,
          credits: '', // Empty caption initially
          artist_id: parseInt(id),
          date_uploaded: new Date()
        });

        uploadedPhotos.push({
          id: artistImage.id,
          filename: fileName,
          caption: '',
          upload_date: artistImage.date_uploaded,
          url: result.Location
        });
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload photo to S3' });
      }
    }

    res.json({
      success: true,
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
      photos: uploadedPhotos
    });
  } catch (error) {
    console.error('Upload artist photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update photo caption
export const updatePhotoCaption = async (req: AuthRequest, res: Response) => {
  try {
    const { id, photoId } = req.params;
    const { caption } = req.body;

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Find and update the photo
    const photo = await ArtistImage.findOne({
      where: { 
        id: photoId,
        artist_id: id 
      }
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await photo.update({ 
      credits: caption || '' 
    });

    res.json({
      success: true,
      message: 'Photo caption updated successfully'
    });
  } catch (error) {
    console.error('Update photo caption error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete artist photo
export const deleteArtistPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const { id, photoId } = req.params;

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Find the photo
    const photo = await ArtistImage.findOne({
      where: { 
        id: photoId,
        artist_id: id 
      }
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete the file from S3
    try {
      // Extract the key from the S3 URL
      const url = new URL(photo.path);
      const key = url.pathname.substring(1); // Remove leading '/'
      
      const deleteParams = {
        Bucket: process.env.S3_BUCKET!,
        Key: key
      };

      await s3.deleteObject(deleteParams).promise();
    } catch (fileError) {
      console.error('Error deleting file from S3:', fileError);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await photo.destroy();

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete artist photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get artist releases
export const getArtistReleases = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify artist exists and user has access
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Get releases for this artist
    const releases = await Release.findAll({
      include: [
        {
          model: Artist,
          as: 'artists',
          where: { id },
          through: { attributes: [] }
        }
      ],
      order: [['release_date', 'DESC']]
    });

    // Transform releases to match frontend interface
    const transformedReleases = releases.map(release => ({
      id: release.id,
      catalog_number: release.catalog_no,
      title: release.title,
      cover_art: release.cover_art || '',
      release_date: release.release_date,
      status: release.status,
      description: release.description || '',
      liner_notes: release.liner_notes || ''
    }));

    res.json({ 
      releases: transformedReleases,
      isAdmin: req.user.is_admin || false 
    });
  } catch (error) {
    console.error('Get artist releases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};