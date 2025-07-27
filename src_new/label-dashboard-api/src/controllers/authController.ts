import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Brand } from '../models';
import { sendEmail } from '../utils/emailService';
import fs from 'fs';
import path from 'path';

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

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email (brand-scoped like original PHP)
    const user = await User.findOne({
      where: { 
        email_address: email,
        brand_id: 1 // Default to brand 1 for now - would need session management for multi-brand
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // Generate reset hash using MD5 of current timestamp (matching original PHP)
    const resetHash = crypto.createHash('md5').update(Date.now().toString()).digest('hex');

    // Save reset hash to user (no expiry like original)
    await user.update({
      reset_hash: resetHash
    });

    // Send reset email using the same function as original PHP
    const emailSent = await sendResetLink(
      user.email_address, 
      resetHash, 
      user.brand?.brand_name || 'Label Dashboard',
      user.brand?.brand_color || '#5fbae9',
      user.brand?.logo_url || ''
    );

    // Send admin notification (matching original PHP)
    await sendAdminNotification(user, req.ip || 'unknown', req.get('X-Forwarded-For') || 'unknown');

    if (emailSent) {
      res.json({ message: 'Password reset instructions sent to your email' });
    } else {
      res.status(500).json({ error: 'Failed to send reset email' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find user with valid reset hash (no expiry check like original PHP)
    const user = await User.findOne({
      where: {
        reset_hash: token
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Update password using MD5 to match existing system
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    // Update user password and clear reset hash
    await user.update({
      password_md5: hashedPassword,
      reset_hash: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions matching original PHP implementation
async function sendResetLink(emailAddress: string, resetHash: string, brandName: string, brandColor: string, brandLogo: string): Promise<boolean> {
  const subject = "Here's the link to reset your password!";
  const emailContent = generateEmailFromTemplate(resetHash, brandName, brandColor, brandLogo);
  return await sendEmail([emailAddress], subject, emailContent);
}

function generateEmailFromTemplate(resetHash: string, brandName: string, brandColor: string, brandLogo: string): string {
  try {
    const templatePath = path.join(__dirname, '../assets/templates/reset_password_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Get protocol and host from environment or use defaults
    const protocol = process.env.USE_HTTPS === 'true' ? 'https' : 'http';
    const host = process.env.FRONTEND_HOST || 'localhost:4200';
    const resetUrl = `${protocol}://${host}/reset-password?code=${resetHash}`;

    // Replace template variables (matching original PHP)
    template = template.replace(/%LOGO%/g, brandLogo);
    template = template.replace(/%URL%/g, resetUrl);
    template = template.replace(/%BRAND_NAME%/g, brandName);
    template = template.replace(/%BRAND_COLOR%/g, brandColor);

    return template;
  } catch (error) {
    console.error('Error loading email template:', error);
    // Fallback simple HTML email
    return `
      <html>
        <body>
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${process.env.FRONTEND_URL}/reset-password?code=${resetHash}">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
        </body>
      </html>
    `;
  }
}

async function sendAdminNotification(user: any, remoteIp: string, proxyIp: string): Promise<boolean> {
  const subject = `Password reset requested for user ${user.username}`;
  const adminEmail = process.env.ADMIN_EMAIL || 'sy.dexter@gmail.com';
  
  const body = `
    We've detected a password reset request for user <b>${user.username}</b>.<br>
    Remote login IP: ${remoteIp}<br>
    Proxy login IP: ${proxyIp}<br><br>
  `;
  
  return await sendEmail([adminEmail], subject, body);
}

// Validate reset hash (matching original PHP fromResetHash validation)
export const validateResetHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ valid: false, error: 'Reset hash is required' });
    }

    // Find user with valid reset hash (matching original PHP logic)
    const user = await User.findOne({
      where: {
        reset_hash: hash,
        brand_id: 1 // Default to brand 1 for now - would need session management for multi-brand
      }
    });

    if (!user) {
      return res.status(404).json({ valid: false, error: 'Invalid reset hash' });
    }

    res.json({ valid: true, message: 'Reset hash is valid' });
  } catch (error) {
    console.error('Validate reset hash error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
};