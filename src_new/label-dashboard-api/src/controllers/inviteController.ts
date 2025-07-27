import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import ArtistAccess from '../models/ArtistAccess';
import User from '../models/User';
import Artist from '../models/Artist';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Process invite - check user status and determine next action
export const processInvite = async (req: Request, res: Response) => {
  try {
    const { invite_hash } = req.body;

    if (!invite_hash) {
      return res.status(400).json({ error: 'Invite hash is required' });
    }

    // Find artist access by invite hash
    const artistAccess = await ArtistAccess.findOne({
      where: { invite_hash },
      include: [
        {
          model: User,
          as: 'user'
        },
        {
          model: Artist,
          as: 'artist'
        }
      ]
    });

    if (!artistAccess) {
      return res.status(404).json({ error: 'Invalid invite hash' });
    }

    const user = artistAccess.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has a password set
    if (user.password_md5 && user.password_md5.trim() !== '') {
      // User exists with password - mark as accepted and return auth token
      artistAccess.status = 'Accepted';
      artistAccess.invite_hash = null; // Clear the invite hash
      await artistAccess.save();

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email_address,
          brandId: user.brand_id 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        action: 'redirect_to_artist',
        token,
        user: {
          id: user.id,
          username: user.username,
          email_address: user.email_address,
          first_name: user.first_name,
          last_name: user.last_name,
          is_admin: user.is_admin,
          brand_id: user.brand_id
        },
        artist_id: artistAccess.artist_id
      });
    } else {
      // User needs to set up profile
      return res.json({
        action: 'redirect_to_setup'
      });
    }
  } catch (error) {
    console.error('Error processing invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get invite data for setup form
export const getInviteData = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ error: 'Invite hash is required' });
    }

    // Find artist access by invite hash
    const artistAccess = await ArtistAccess.findOne({
      where: { invite_hash: hash },
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!artistAccess) {
      return res.status(404).json({ error: 'Invalid invite hash' });
    }

    const user = artistAccess.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username || '',
        email_address: user.email_address,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_admin: user.is_admin,
        brand_id: user.brand_id
      },
      artist_access_id: `${artistAccess.artist_id}_${artistAccess.user_id}`
    });
  } catch (error) {
    console.error('Error getting invite data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Setup user profile from invite
export const setupUserProfile = async (req: Request, res: Response) => {
  try {
    const { 
      id,
      username, 
      first_name, 
      last_name, 
      password,
      invite_hash,
      brand_id,
      is_admin
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !password || !invite_hash) {
      return res.status(400).json({ 
        error: 'First name, last name, password, and invite hash are required' 
      });
    }

    // Find artist access by invite hash
    const artistAccess = await ArtistAccess.findOne({
      where: { invite_hash },
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!artistAccess) {
      return res.status(404).json({ error: 'Invalid invite hash' });
    }

    const user = artistAccess.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username is provided and validate uniqueness
    if (username && username.trim() !== '') {
      const existingUser = await User.findOne({
        where: { 
          username: username.trim(),
          brand_id: user.brand_id
        }
      });

      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({
          errors: {
            username: 'Sorry, this username is already in use. Please choose another'
          }
        });
      }

      // Validate username format
      const usernamePattern = /^[A-Za-z0-9_]+$/;
      if (!usernamePattern.test(username.trim())) {
        return res.status(400).json({
          errors: {
            username: 'Only alphanumeric characters [A-Z, a-z, 0-9] and underscores are allowed'
          }
        });
      }
    }

    // Hash the password using MD5 (matching original setprofile.php)
    const md5Password = crypto.createHash('md5').update(password).digest('hex');

    // Update user
    await user.update({
      username: username?.trim() || user.username,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password_md5: md5Password
    });

    // Mark artist access as accepted and clear invite hash
    await artistAccess.update({
      status: 'Accepted',
      invite_hash: null
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email_address,
        brandId: user.brand_id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Profile setup successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        brand_id: user.brand_id
      }
    });
  } catch (error) {
    console.error('Error setting up user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};