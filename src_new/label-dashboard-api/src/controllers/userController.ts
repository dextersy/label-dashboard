import { Request, Response } from 'express';
import crypto from 'crypto';
import { User, Brand, LoginAttempt } from '../models';
import { sendEmail } from '../utils/emailService';

interface AuthRequest extends Request {
  user?: any;
}

export const checkUsernameExists = async (req: Request, res: Response) => {
  try {
    const { username, brand_id } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({
      where: { 
        username, 
        brand_id: brand_id || 1 
      }
    });

    res.json({ result: user ? 'true' : 'false' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendResetLink = async (req: Request, res: Response) => {
  try {
    const { email_address, brand_id } = req.body;

    if (!email_address) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const user = await User.findOne({
      where: { 
        email_address, 
        brand_id: brand_id || 1 
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset hash
    const resetHash = crypto.randomBytes(32).toString('hex');
    await user.update({ reset_hash: resetHash });

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetHash}`;
    const emailSent = await sendEmail(
      [user.email_address],
      'Password Reset Request',
      `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.first_name},</p>
        <p>You requested a password reset for your account. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      `
    );

    if (emailSent) {
      res.json({ message: 'Reset link sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send reset email' });
    }
  } catch (error) {
    console.error('Send reset link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const initUser = async (req: Request, res: Response) => {
  try {
    const { 
      username, 
      email_address, 
      first_name, 
      last_name, 
      password, 
      brand_id 
    } = req.body;

    if (!username || !email_address || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { 
        username, 
        brand_id: brand_id || 1 
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create password hash (MD5 for compatibility, should migrate to bcrypt)
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');

    const user = await User.create({
      username,
      email_address,
      first_name,
      last_name,
      password_md5: passwordHash,
      brand_id: brand_id || 1,
      is_admin: false
    });

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Init user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      email_address, 
      first_name, 
      artist_id, 
      can_view_payments = true,
      can_view_royalties = true,
      can_edit_artist_profile = true 
    } = req.body;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!email_address || !artist_id) {
      return res.status(400).json({ 
        error: 'Email address and artist ID are required' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({
      where: { 
        email_address,
        brand_id: req.user.brand_id 
      }
    });

    if (!user) {
      // Create new user
      user = await User.create({
        email_address,
        first_name,
        brand_id: req.user.brand_id,
        is_admin: false
      });
    }

    // Generate invite hash
    const inviteHash = crypto.randomBytes(32).toString('hex');

    // Create artist access record
    const { ArtistAccess } = require('../models');
    await ArtistAccess.create({
      artist_id,
      user_id: user.id,
      can_view_payments,
      can_view_royalties,
      can_edit_artist_profile,
      status: 'Pending',
      invite_hash: inviteHash
    });

    // Send invite email
    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteHash}`;
    const emailSent = await sendEmail(
      [user.email_address],
      'Invitation to Join Label Dashboard',
      `
        <h2>You've been invited!</h2>
        <p>Hi ${user.first_name || 'there'},</p>
        <p>You've been invited to join our label dashboard as a team member.</p>
        <p><a href="${inviteLink}">Accept Invitation</a></p>
        <p>If you don't recognize this invitation, please ignore this email.</p>
      `
    );

    if (emailSent) {
      res.json({ message: 'Invitation sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send invitation email' });
    }
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id } = req.body;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findOne({
      where: { 
        id: user_id,
        brand_id: req.user.brand_id 
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ is_admin: !user.is_admin });

    res.json({ 
      message: 'Admin status updated successfully',
      is_admin: user.is_admin
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const { artist_id, user_id } = req.body;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!artist_id || !user_id) {
      return res.status(400).json({ 
        error: 'Artist ID and User ID are required' 
      });
    }

    const { ArtistAccess } = require('../models');
    const accessRecord = await ArtistAccess.findOne({
      where: { 
        artist_id,
        user_id 
      }
    });

    if (!accessRecord) {
      return res.status(404).json({ error: 'Access record not found' });
    }

    await accessRecord.destroy();

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};