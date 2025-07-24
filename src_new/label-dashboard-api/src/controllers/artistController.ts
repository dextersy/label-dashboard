import { Request, Response } from 'express';
import { Artist, Brand, Release, Payment, Royalty, ArtistImage, ArtistDocument, ArtistAccess, User } from '../models';
import { sendBrandedEmail } from '../utils/emailService';

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
      payout_point: payout_point || artist.payout_point
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