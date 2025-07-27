import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { User } from '../models';

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

    const { username, email, first_name, last_name } = req.body;

    // Validation
    const errors: any = {};

    if (!username?.trim()) {
      errors.username = 'Username is required';
    }

    if (!email?.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    // Check if username or email already exists (excluding current user)
    if (username) {
      const existingUser = await User.findOne({
        where: {
          username,
          id: { $ne: req.user.id }
        }
      });

      if (existingUser) {
        errors.username = 'Username already exists';
      }
    }

    if (email) {
      const existingUser = await User.findOne({
        where: {
          email_address: email,
          id: { $ne: req.user.id }
        }
      });

      if (existingUser) {
        errors.email = 'Email already exists';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Update user
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      username: username?.trim(),
      email_address: email?.trim(),
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

    // Verify current password (using MD5 to match existing system)
    const currentPasswordHash = crypto.createHash('md5').update(current_password).digest('hex');
    if (user.password_md5 !== currentPasswordHash) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = crypto.createHash('md5').update(new_password).digest('hex');

    // Update password
    await user.update({
      password_md5: newPasswordHash
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};