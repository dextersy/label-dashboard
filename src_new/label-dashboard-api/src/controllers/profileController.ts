import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { Op } from 'sequelize';
import { User } from '../models';
import { verifyPassword, hashPassword } from '../utils/passwordUtils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    brand_id: number;
    is_admin: boolean;
  };
}

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email_address', 'first_name', 'last_name', 'is_admin', 'last_logged_in']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email_address: user.email_address,
      first_name: user.first_name,
      last_name: user.last_name,
      is_admin: user.is_admin,
      last_login: user.last_logged_in
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { first_name, last_name } = req.body;

    // Validation
    const errors: any = {};

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Update user
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Find user and verify current password
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password (supports both bcrypt and MD5)
    const { isValid } = await verifyPassword(current_password, user);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password with bcrypt
    const newPasswordHash = await hashPassword(new_password);

    // Update password with bcrypt and remove MD5
    await user.update({
      password_hash: newPasswordHash,
      password_md5: null
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};