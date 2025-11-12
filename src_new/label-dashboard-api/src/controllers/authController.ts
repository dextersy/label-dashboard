import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Brand, LoginAttempt } from '../models';
import { sendEmail, sendLoginNotification, sendAdminFailedLoginAlert } from '../utils/emailService';
import { getBrandIdFromDomain } from '../utils/brandUtils';
import { verifyPassword, migrateUserPassword, hashPassword, validatePassword } from '../utils/passwordUtils';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password, brand_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const remoteIp = req.ip || 'unknown';
    const proxyIp = req.get('X-Forwarded-For') || 'unknown';

    // Find user by username or email and brand_id (matching PHP logic)
    let user = await User.findOne({
      where: { username, brand_id: brand_id || 1 },
      include: [{ model: Brand, as: 'brand' }]
    });

    if (!user) {
      // Try by email if username lookup failed (matching PHP logic)
      user = await User.findOne({
        where: { email_address: username, brand_id: brand_id || 1 },
        include: [{ model: Brand, as: 'brand' }]
      });
    }

    // Check login lock (matching PHP logic) - only if user exists
    if (user) {
      const isLocked = await checkLoginLock(user.id);
      if (isLocked) {
        await sendAdminFailedLoginAlert(user.username || user.email_address, remoteIp, proxyIp, user.brand_id);
        const lockTimeMinutes = Math.ceil(parseInt(process.env.LOCK_TIME_IN_SECONDS || '120') / 60);
        return res.status(423).json({
          error: `Account temporarily locked due to too many failed logins. Please try again in ${lockTimeMinutes} minutes.`
        });
      }
    }

    // Verify password with automatic MD5 → bcrypt migration
    let isValidPassword = false;
    let needsMigration = false;

    if (user) {
      const verification = await verifyPassword(password, user);
      isValidPassword = verification.isValid;
      needsMigration = verification.needsMigration;
    }

    // Generic error for both "user not found" and "invalid password"
    // This prevents user enumeration attacks
    if (!user || !isValidPassword) {
      // Only record failed login attempt if user exists (can't log for non-existent users)
      if (user) {
        await LoginAttempt.create({
          user_id: user.id,
          status: 'Failed',
          date_and_time: new Date(),
          brand_id: user.brand_id,
          proxy_ip: proxyIp,
          remote_ip: remoteIp
        });
      }

      // Log detailed reason server-side for debugging
      console.warn('Login failed', {
        username,
        brand_id,
        reason: !user ? 'user_not_found' : 'invalid_password',
        ip: remoteIp,
        timestamp: new Date()
      });

      // Return same generic message for both cases
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Record successful login attempt (matching PHP logic)
    await LoginAttempt.create({
      user_id: user.id,
      status: 'Successful',
      date_and_time: new Date(),
      brand_id: user.brand_id,
      proxy_ip: proxyIp,
      remote_ip: remoteIp
    });

    // Migrate from MD5 to bcrypt if needed (lazy migration)
    if (needsMigration) {
      await migrateUserPassword(user, password);
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

    // Send login success notification (matching PHP logic)
    sendLoginNotification(
      user.email_address,
      user.first_name || '',
      remoteIp,
      proxyIp,
      user.brand_id
    ).catch(error => {
      console.error('Failed to send login notification:', error);
      // Don't fail login if email fails
    });

    // Check if user is superadmin based on admin email env variable
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperadmin = adminEmail && user.email_address === adminEmail;

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
        is_superadmin: isSuperadmin,
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
    
    // Check if user is superadmin based on admin email env variable
    const adminEmail = process.env.ADMIN_EMAIL;
    const isSuperadmin = adminEmail && user.email_address === adminEmail;
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        is_superadmin: isSuperadmin,
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

    // Get brand ID from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    console.log('Referer URL:', refererUrl);
    
    if (!refererUrl) {
      return res.status(400).json({ error: 'Unable to determine frontend domain from request' });
    }
    
    const brandId = await getBrandIdFromDomain(refererUrl);
    
    if (!brandId) {
      return res.status(400).json({ error: 'Invalid domain or brand not found' });
    }

    // Find user by email (brand-scoped like original PHP)
    const user = await User.findOne({
      where: {
        email_address: email,
        brand_id: brandId
      },
      include: [{ model: Brand, as: 'brand' }]
    });

    // Only process reset if user exists, but always return same message
    // This prevents email enumeration attacks
    if (user) {
      // Generate reset hash using MD5 of current timestamp (matching original PHP)
      const resetHash = crypto.createHash('md5').update(Date.now().toString()).digest('hex');

      // Save reset hash to user (no expiry like original)
      await user.update({
        reset_hash: resetHash
      });

      // Send reset email using the same function as original PHP
      await sendResetLink(
        user.email_address,
        resetHash,
        user.brand?.brand_name || 'Label Dashboard',
        user.brand?.brand_color || '#5fbae9',
        user.brand?.logo_url || '',
        user.brand_id,
        refererUrl // Pass the frontend domain
      ).catch(error => {
        console.error('Failed to send reset email:', error);
        // Don't expose email failure to client
      });

      // Send admin notification (matching original PHP)
      await sendAdminNotification(user, req.ip || 'unknown', req.get('X-Forwarded-For') || 'unknown')
        .catch(error => {
          console.error('Failed to send admin notification:', error);
        });
    } else {
      // Log the attempt server-side for monitoring
      console.warn('Password reset requested for non-existent email', {
        email,
        brand_id: brandId,
        ip: req.ip,
        timestamp: new Date()
      });
    }

    // Always return success message regardless of whether email exists
    // This prevents attackers from enumerating valid email addresses
    res.json({
      message: 'If an account exists with this email address, password reset instructions have been sent.'
    });
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

    // Validate password against security requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        details: validation.errors
      });
    }

    // Find user with valid reset hash (no expiry check like original PHP)
    const user = await User.findOne({
      where: {
        reset_hash: token
      }
    });

    if (!user) {
      // Log server-side for monitoring
      console.warn('Invalid reset token used', {
        token,
        ip: req.ip,
        timestamp: new Date()
      });

      // Generic error message
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password with bcrypt (migrate to strong encryption)
    const hashedPassword = await hashPassword(password);

    // Update user password with bcrypt and clear reset hash
    // Clear old MD5 hash if it exists
    await user.update({
      password_hash: hashedPassword,
      password_md5: null,
      reset_hash: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions matching original PHP implementation
async function sendResetLink(emailAddress: string, resetHash: string, brandName: string, brandColor: string, brandLogo: string, brandId: number, refererUrl: string): Promise<boolean> {
  const subject = "Here's the link to reset your password!";
  const emailContent = generateEmailFromTemplate(resetHash, brandName, brandColor, brandLogo, refererUrl);
  return await sendEmail([emailAddress], subject, emailContent, brandId);
}

function generateEmailFromTemplate(resetHash: string, brandName: string, brandColor: string, brandLogo: string, refererUrl: string): string {
  // refererUrl is now required - no fallback logic
  if (!refererUrl) {
    throw new Error('Frontend URL is required to generate reset password email');
  }

  let frontendBaseUrl: string;
  try {
    const url = new URL(refererUrl);
    frontendBaseUrl = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
  } catch (error) {
    throw new Error(`Invalid referer URL: ${refererUrl}`);
  }
  
  const resetUrl = `${frontendBaseUrl}/reset-password?code=${resetHash}`;
  console.log('Generated reset URL:', resetUrl);

  try {
    const templatePath = path.join(__dirname, '../assets/templates/reset_password_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables (matching original PHP)
    template = template.replace(/%LOGO%/g, brandLogo);
    template = template.replace(/%URL%/g, resetUrl);
    template = template.replace(/%BRAND_NAME%/g, brandName);
    template = template.replace(/%BRAND_COLOR%/g, brandColor);

    return template;
  } catch (error) {
    console.error('Error loading email template:', error);
    
    // Simple HTML email without fallback URL logic
    return `
      <html>
        <body>
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>If you didn't request this, please ignore this email.</p>
        </body>
      </html>
    `;
  }
}

async function sendAdminNotification(user: any, remoteIp: string, proxyIp: string): Promise<boolean> {
  const subject = `Password reset requested for user ${user.username}`;
  const adminEmail = process.env.ADMIN_EMAIL;
  
  // Only send if admin email is configured
  if (!adminEmail) {
    console.log('No admin email configured for password reset notifications, skipping email');
    return false;
  }
  
  const body = `
    We've detected a password reset request for user <b>${user.username}</b>.<br>
    Remote login IP: ${remoteIp}<br>
    Proxy login IP: ${proxyIp}<br><br>
  `;
  
  return await sendEmail([adminEmail], subject, body, user.brand_id);
}

// Validate reset hash (matching original PHP fromResetHash validation)
export const validateResetHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({ valid: false, error: 'Reset hash is required' });
    }

    // Get brand ID from referer URL (frontend domain)
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    console.log('Referer URL:', refererUrl);
    
    if (!refererUrl) {
      return res.status(400).json({ valid: false, error: 'Unable to determine frontend domain from request' });
    }
    
    const brandId = await getBrandIdFromDomain(refererUrl);
    
    if (!brandId) {
      return res.status(400).json({ valid: false, error: 'Invalid domain or brand not found' });
    }

    // Find user with valid reset hash (matching original PHP logic)
    const user = await User.findOne({
      where: {
        reset_hash: hash,
        brand_id: brandId
      }
    });

    if (!user) {
      // Log server-side for monitoring
      console.warn('Invalid reset hash validation attempt', {
        hash,
        brand_id: brandId,
        ip: req.ip,
        timestamp: new Date()
      });

      // Generic error message to prevent hash enumeration
      return res.status(400).json({
        valid: false,
        error: 'Invalid or expired reset token'
      });
    }

    res.json({ valid: true, message: 'Reset hash is valid' });
  } catch (error) {
    console.error('Validate reset hash error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
};

// Helper function to check login lock (matching PHP logic)
async function checkLoginLock(userId: number): Promise<boolean> {
  try {
    const FAILED_LOGIN_LIMIT = parseInt(process.env.FAILED_LOGIN_LIMIT || '3');
    const LOCK_TIME_IN_SECONDS = parseInt(process.env.LOCK_TIME_IN_SECONDS || '120');

    // Get recent login attempts (matching PHP query)
    const recentAttempts = await LoginAttempt.findAll({
      where: { user_id: userId },
      order: [['date_and_time', 'DESC']],
      limit: FAILED_LOGIN_LIMIT
    });

    if (recentAttempts.length < FAILED_LOGIN_LIMIT) {
      return false;
    }

    // Check if we have enough failed attempts within the lock time window
    let failures = 0;
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - LOCK_TIME_IN_SECONDS * 1000);

    for (const attempt of recentAttempts) {
      if (attempt.status === 'Failed' && attempt.date_and_time > cutoffTime) {
        failures++;
      }
    }

    return failures >= FAILED_LOGIN_LIMIT;
  } catch (error) {
    console.error('Error checking login lock:', error);
    return false;
  }
}