import { Request, Response } from 'express';
import { Artist, Brand, Release, Payment, Royalty, ArtistImage, ArtistDocument, ArtistAccess, User, ReleaseArtist, PaymentMethod } from '../models';
import { sendTeamInviteEmail, sendArtistUpdateEmail } from '../utils/emailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import AWS from 'aws-sdk';
import crypto from 'crypto';

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
      tiktok_handle: artist.tiktok_handle,
      band_members: artist.band_members,
      youtube_channel: artist.youtube_channel,
      profile_photo: artist.profile_photo
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

    // Refresh artist data to get updated values
    await artist.reload();

    // Send notification email if requested and there are changes
    if (notify_changes) {
      const changes = [];
      
      // Compare old vs new values
      if (originalValues.name !== artist.name) {
        changes.push({ field: 'Name', oldValue: originalValues.name || '', newValue: artist.name || '' });
      }
      if (originalValues.bio !== artist.bio) {
        changes.push({ field: 'Bio', oldValue: originalValues.bio || '', newValue: artist.bio || '' });
      }
      if (originalValues.website_page_url !== artist.website_page_url) {
        changes.push({ field: 'Website', oldValue: originalValues.website_page_url || '', newValue: artist.website_page_url || '' });
      }
      if (originalValues.facebook_handle !== artist.facebook_handle) {
        changes.push({ field: 'Facebook', oldValue: originalValues.facebook_handle || '', newValue: artist.facebook_handle || '' });
      }
      if (originalValues.instagram_handle !== artist.instagram_handle) {
        changes.push({ field: 'Instagram', oldValue: originalValues.instagram_handle || '', newValue: artist.instagram_handle || '' });
      }
      if (originalValues.twitter_handle !== artist.twitter_handle) {
        changes.push({ field: 'Twitter', oldValue: originalValues.twitter_handle || '', newValue: artist.twitter_handle || '' });
      }
      if (originalValues.tiktok_handle !== artist.tiktok_handle) {
        changes.push({ field: 'TikTok', oldValue: originalValues.tiktok_handle || '', newValue: artist.tiktok_handle || '' });
      }
      if (originalValues.band_members !== artist.band_members) {
        changes.push({ field: 'Band Members', oldValue: originalValues.band_members || '', newValue: artist.band_members || '' });
      }
      if (originalValues.youtube_channel !== artist.youtube_channel) {
        changes.push({ field: 'YouTube', oldValue: originalValues.youtube_channel || '', newValue: artist.youtube_channel || '' });
      }
      if (originalValues.profile_photo !== artist.profile_photo) {
        changes.push({ field: 'Profile Photo', oldValue: 'Previous photo', newValue: 'New photo uploaded' });
      }

      if (changes.length > 0) {
        // Get all users with access to this artist
        const artistAccess = await ArtistAccess.findAll({
          where: { artist_id: id },
          include: [{ model: User, as: 'user' }]
        });

        // Get brand info for email branding
        const brand = await Brand.findByPk(req.user.brand_id);
        
        // Generate dashboard URL
        const dashboardUrl = `${process.env.FRONTEND_URL}/artist`;
        
        // Get updater name
        const updaterName = req.user.first_name && req.user.last_name 
          ? `${req.user.first_name} ${req.user.last_name}`.trim() 
          : req.user.email_address;

        // Send email to each team member
        for (const access of artistAccess) {
          if (access.user && access.user.email_address) {
            try {
              await sendArtistUpdateEmail(
                access.user.email_address,
                artist.name,
                updaterName,
                changes,
                dashboardUrl,
                {
                  brand_color: brand?.brand_color || '#1595e7',
                  logo_url: brand?.logo_url || ''
                }
              );
            } catch (emailError) {
              console.error('Failed to send artist update email:', emailError);
            }
          }
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

export const getPayoutSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json({ 
      payout_point: artist.payout_point || 1000,
      hold_payouts: artist.hold_payouts || false
    });
  } catch (error) {
    console.error('Get payout settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePayoutSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { payout_point, hold_payouts } = req.body;

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
    const oldHoldPayouts = artist.hold_payouts;

    // Update the artist with new settings
    await artist.update({ 
      payout_point: payout_point !== undefined ? payout_point : artist.payout_point,
      hold_payouts: hold_payouts !== undefined ? hold_payouts : artist.hold_payouts
    });

    // Notify artist of payout settings change if payout point changed
    if (payout_point !== undefined && payout_point !== oldPayoutPoint) {
      const artistAccess = await ArtistAccess.findAll({
        where: { artist_id: id },
        include: [{ model: User, as: 'user' }]
      });

      const recipients = artistAccess
        .filter(access => access.user?.email_address)
        .map(access => access.user!.email_address);

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
    }

    res.json({
      message: 'Payout settings updated successfully',
      payout_point: artist.payout_point,
      hold_payouts: artist.hold_payouts
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

// Get artist team members
export const getArtistTeam = async (req: AuthRequest, res: Response) => {
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

    // Get team members for this artist
    const teamMembers = await ArtistAccess.findAll({
      where: { artist_id: id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email_address']
        }
      ]
    });

    // Transform team members to match frontend interface
    const transformedTeamMembers = teamMembers.map(access => ({
      id: access.user_id,
      name: access.user ? `${access.user.first_name || ''} ${access.user.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
      email: access.user?.email_address || 'Unknown',
      status: access.status,
      invited_date: access.createdAt ? access.createdAt.toISOString() : new Date().toISOString()
    }));

    res.json({ teamMembers: transformedTeamMembers });
  } catch (error) {
    console.error('Get artist team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Invite team member
export const inviteTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

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

    // Check if user exists
    let user = await User.findOne({ where: { email_address: email } });
    
    if (!user) {
      // Create a new user with pending status
      user = await User.create({
        email_address: email,
        brand_id: req.user.brand_id,
        is_admin: false
      });
    }

    // Check if team member already exists
    const existingAccess = await ArtistAccess.findOne({
      where: { artist_id: id, user_id: user.id }
    });

    if (existingAccess) {
      return res.status(409).json({ error: 'User is already a team member' });
    }

    // Generate random invite hash
    const inviteHash = crypto.randomBytes(32).toString('hex');

    // Create artist access
    const access = await ArtistAccess.create({
      artist_id: parseInt(id),
      user_id: user.id,
      status: 'Pending',
      invite_hash: inviteHash
    });

    // Get brand info for email branding
    const brand = await Brand.findByPk(req.user.brand_id);
    
    // Generate invitation URL
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?hash=${inviteHash}`;
    
    // Send invitation email
    try {
      await sendTeamInviteEmail(
        user.email_address,
        artist.name,
        req.user.first_name && req.user.last_name 
          ? `${req.user.first_name} ${req.user.last_name}`.trim() 
          : req.user.email_address,
        inviteUrl,
        {
          brand_color: brand?.brand_color || '#1595e7',
          logo_url: brand?.logo_url || ''
        }
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue with the process even if email fails
    }

    const teamMember = {
      id: user.id,
      name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}`.trim() : '',
      email: user.email_address,
      status: access.status,
      invited_date: access.createdAt ? access.createdAt.toISOString() : new Date().toISOString(),
      invite_hash: inviteHash
    };

    res.json({
      success: true,
      message: 'Team member invited successfully',
      teamMember
    });
  } catch (error) {
    console.error('Invite team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Resend team member invitation
export const resendTeamInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;

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

    // Find the team member
    const access = await ArtistAccess.findOne({
      where: { artist_id: id, user_id: memberId },
      include: [{ model: User, as: 'user' }]
    });

    if (!access) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Send invitation email (implementation would go here)
    // await sendBrandedEmail(access.user.email, 'team-invite', { artistName: artist.name });

    res.json({
      success: true,
      message: 'Invitation resent successfully'
    });
  } catch (error) {
    console.error('Resend team invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove team member
export const removeTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;

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

    // Find and remove the team member access
    const access = await ArtistAccess.findOne({
      where: { artist_id: id, user_id: memberId }
    });

    if (!access) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    await access.destroy();

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PAYMENT METHODS MANAGEMENT
export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const paymentMethods = await PaymentMethod.findAll({
      where: { artist_id: id },
      order: [['is_default_for_artist', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({ 
      paymentMethods,
      artist: {
        id: artist.id,
        name: artist.name
      }
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      account_name,
      account_number_or_email,
      bank_code,
      is_default = false
    } = req.body;

    if (!type || !account_name || !account_number_or_email) {
      return res.status(400).json({ 
        error: 'Type, account name, and account number/email are required' 
      });
    }

    // Verify artist belongs to user's brand
    const artist = await Artist.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // If this is set as default, remove default from other methods
    if (is_default) {
      await PaymentMethod.update(
        { is_default_for_artist: false },
        { where: { artist_id: id } }
      );
    }

    const paymentMethod = await PaymentMethod.create({
      artist_id: id,
      type,
      account_name,
      account_number_or_email,
      bank_code: bank_code || 'N/A',
      is_default_for_artist: is_default
    });

    res.status(201).json({
      message: 'Payment method added successfully',
      payment_method: paymentMethod
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};