import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Brand } from '../models';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password, brand_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username and brand_id
    const user = await User.findOne({
      where: { username, brand_id: brand_id || 1 },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Verify password (PHP uses MD5, but we should migrate to bcrypt)
    const isValidPassword = user.password_md5 === crypto.createHash('md5').update(password).digest('hex');
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login time
    await user.update({ last_logged_in: new Date() });

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, brandId: user.brand_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logout successful' });
};

export const checkAuth = async (req: any, res: Response) => {
  try {
    const user = req.user;
    res.json({
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
    res.status(500).json({ error: 'Internal server error' });
  }
};