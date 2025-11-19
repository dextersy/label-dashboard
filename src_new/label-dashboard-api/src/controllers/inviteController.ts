import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import ArtistAccess from '../models/ArtistAccess';
import User from '../models/User';
import Artist from '../models/Artist';
import Brand from '../models/Brand';
import { hasPassword, hashPassword, validatePassword } from '../utils/passwordUtils';
import { Op } from 'sequelize';

// Fail fast if JWT_SECRET is not configured - critical security requirement
if (!process.env.JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is required. Application cannot start without it.');
}
const JWT_SECRET = process.env.JWT_SECRET;

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

    // Combined check - don't reveal whether hash is invalid or user missing
    if (!artistAccess || !artistAccess.user) {
      console.warn('Invalid invite attempt in processInvite', {
        invite_hash,
        reason: !artistAccess ? 'hash_not_found' : 'user_missing',
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const user = artistAccess.user;

    // Check if user already has a password set (bcrypt or MD5)
    if (hasPassword(user)) {
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

    // Combined check - don't reveal whether hash is invalid or user missing
    if (!artistAccess || !artistAccess.user) {
      console.warn('Invalid invite attempt in getInviteData', {
        hash,
        reason: !artistAccess ? 'hash_not_found' : 'user_missing',
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const user = artistAccess.user;

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

    // Combined check - don't reveal whether hash is invalid or user missing
    if (!artistAccess || !artistAccess.user) {
      console.warn('Invalid invite attempt in setupUserProfile', {
        invite_hash,
        reason: !artistAccess ? 'hash_not_found' : 'user_missing',
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const user = artistAccess.user;

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

    // Validate password against security requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: validation.errors
      });
    }

    // Hash the password using bcrypt (secure encryption)
    const hashedPassword = await hashPassword(password);

    // Update user
    await user.update({
      username: username?.trim() || user.username,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password_hash: hashedPassword
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

// ======================================
// ADMIN INVITE SYSTEM
// ======================================

// Process admin invite - check user status and determine next action
export const processAdminInvite = async (req: Request, res: Response) => {
  try {
    const { invite_hash } = req.body;

    if (!invite_hash) {
      return res.status(400).json({ error: 'Invite hash is required' });
    }

    // Find user by invite hash (using reset_hash field)
    const user = await User.findOne({
      where: { reset_hash: invite_hash },
      include: [{
        model: Brand,
        as: 'brand'
      }]
    });

    if (!user) {
      console.warn('Invalid admin invite attempt in processAdminInvite', {
        invite_hash,
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    // Check if user already has a password set (bcrypt or MD5)
    if (hasPassword(user)) {
      // User exists with password - clear hash and return auth token
      user.reset_hash = null;
      await user.save();

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
        action: 'redirect_to_dashboard',
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
    } else {
      // User needs to set up profile
      return res.json({
        action: 'redirect_to_setup',
        user_id: user.id
      });
    }
  } catch (error) {
    console.error('Error processing admin invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get admin invite data for setup form
export const getAdminInviteData = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ error: 'Invite hash is required' });
    }

    // Find user by invite hash
    const user = await User.findOne({
      where: { reset_hash: hash },
      include: [{
        model: Brand,
        as: 'brand'
      }]
    });

    if (!user) {
      console.warn('Invalid admin invite attempt in getAdminInviteData', {
        hash,
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
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
      brand: user.brand ? {
        id: user.brand.id,
        name: user.brand.brand_name,
        primary_color: user.brand.brand_color
      } : null
    });
  } catch (error) {
    console.error('Error getting admin invite data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Setup admin profile from invite
export const setupAdminProfile = async (req: Request, res: Response) => {
  try {
    const { 
      invite_hash,
      username, 
      first_name, 
      last_name, 
      password
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !password || !invite_hash) {
      return res.status(400).json({ 
        error: 'First name, last name, password, and invite hash are required' 
      });
    }

    // Find user by invite hash
    const user = await User.findOne({
      where: { reset_hash: invite_hash }
    });

    if (!user) {
      console.warn('Invalid admin invite attempt in setupAdminProfile', {
        invite_hash,
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired invitation' });
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

    // Validate password against security requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: validation.errors
      });
    }

    // Hash the password using bcrypt (secure encryption)
    const hashedPassword = await hashPassword(password);

    // Update user
    await user.update({
      username: username?.trim() || user.username,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password_hash: hashedPassword,
      reset_hash: null // Clear the invite hash
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
    console.error('Error setting up admin profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending invites for the current user
export const getPendingInvites = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Find all pending artist access invites for this user
    const pendingInvites = await ArtistAccess.findAll({
      where: {
        user_id: userId,
        status: 'Pending',
        invite_hash: {
          [Op.ne]: null // Only invites with valid hash
        }
      },
      include: [
        {
          model: Artist,
          as: 'artist',
          attributes: ['id', 'name', 'brand_id']
        }
      ]
    });

    // Format response
    const invites = pendingInvites.map(invite => ({
      artist_id: invite.artist_id,
      artist_name: invite.artist?.name,
      invite_hash: invite.invite_hash,
      can_view_payments: invite.can_view_payments,
      can_view_royalties: invite.can_view_royalties,
      can_edit_artist_profile: invite.can_edit_artist_profile
    }));

    res.json({ invites });
  } catch (error) {
    console.error('Error getting pending invites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};