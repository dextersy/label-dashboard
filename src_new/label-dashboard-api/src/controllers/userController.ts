import { Request, Response } from 'express';
import crypto from 'crypto';
import { User, Brand, LoginAttempt } from '../models';
import { sendEmail } from '../utils/emailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { sequelize } from '../config/database';
import { QueryTypes, Op } from 'sequelize';

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
    const resetLink = `${await getBrandFrontendUrl(user.brand_id)}/reset-password?token=${resetHash}`;
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
      `,
      user.brand_id
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
    const inviteLink = `${await getBrandFrontendUrl(user.brand_id)}/accept-invite?token=${inviteHash}`;
    const emailSent = await sendEmail(
      [user.email_address],
      'Invitation to Join Label Dashboard',
      `
        <h2>You've been invited!</h2>
        <p>Hi ${user.first_name || 'there'},</p>
        <p>You've been invited to join our label dashboard as a team member.</p>
        <p><a href="${inviteLink}">Accept Invitation</a></p>
        <p>If you don't recognize this invitation, please ignore this email.</p>
      `,
      req.user.brand_id
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

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Parse filter and sort parameters
    const sortBy = req.query.sortBy as string;
    const sortDirection = (req.query.sortDirection as string) || 'ASC';

    // Build base where condition (exclude users with blank usernames)
    const whereCondition: any = {
      brand_id: req.user.brand_id,
      username: {
        [Op.ne]: '',
        [Op.not]: null
      }
    };

    // Add filters (removed last_logged_in as it's not filterable)
    const filterableFields = ['username', 'first_name', 'last_name', 'email_address', 'is_admin'];
    filterableFields.forEach(field => {
      const filterValue = req.query[field] as string;
      if (filterValue && filterValue.trim() !== '') {
        if (field === 'is_admin') {
          // Handle boolean filter
          whereCondition[field] = filterValue.toLowerCase() === 'true';
        } else {
          // Handle text filters with partial matching
          whereCondition[field] = {
            [Op.like]: `%${filterValue}%`
          };
        }
      }
    });

    // Special handling for last_logged_in sorting - we need to use raw SQL for this
    if (sortBy === 'last_logged_in') {
      // SECURITY: Strict allowlist for sort direction - never interpolate user input
      const isDescending = sortDirection.toUpperCase() === 'DESC';

      // MySQL doesn't support NULLS FIRST/LAST, so we use a CASE statement workaround
      // For DESC: non-null values first (DESC), then NULL values
      // For ASC: NULL values first, then non-null values (ASC)

      // SECURITY: Use complete pre-built strings to make SQL injection protection obvious to reviewers
      const orderByClause = isDescending
        ? `ORDER BY CASE
          WHEN la_max.last_logged_in IS NULL
          THEN 1
          ELSE 0
        END,
        la_max.last_logged_in DESC`
        : `ORDER BY CASE
          WHEN la_max.last_logged_in IS NULL
          THEN 0
          ELSE 1
        END,
        la_max.last_logged_in ASC`;

      // Build additional filter conditions for the raw query using parameterized queries
      // SECURITY: Use parameterized queries to prevent SQL injection
      const filterConditions: string[] = [];
      const filterReplacements: any[] = [];

      // Whitelist of allowed columns to prevent column name injection
      const allowedColumns = ['email_address', 'first_name', 'last_name', 'is_admin'];

      Object.keys(whereCondition)
        .filter(key => key !== 'brand_id' && key !== 'username')
        .forEach(key => {
          // Validate column name against whitelist
          if (!allowedColumns.includes(key)) {
            return; // Skip invalid columns
          }

          const value = whereCondition[key];
          if (key === 'is_admin') {
            filterConditions.push(`AND u.${key} = ?`);
            filterReplacements.push(value ? 1 : 0);
          } else if (typeof value === 'object' && value[Op.like]) {
            const likeValue = value[Op.like].replace(/%/g, '');
            filterConditions.push(`AND u.${key} LIKE ?`);
            filterReplacements.push(`%${likeValue}%`);
          }
        });

      const additionalFilters = filterConditions.join(' ');

      // Use raw query with LEFT JOIN to properly sort by last login
      const usersQuery = `
        SELECT u.*, la_max.last_logged_in
        FROM user u
        LEFT JOIN (
          SELECT user_id, MAX(date_and_time) as last_logged_in
          FROM login_attempt
          WHERE status = 'Successful' AND brand_id = ?
          GROUP BY user_id
        ) la_max ON u.id = la_max.user_id
        WHERE u.brand_id = ?
          AND u.username != ''
          AND u.username IS NOT NULL
          ${additionalFilters}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM user u
        WHERE u.brand_id = ?
          AND u.username != ''
          AND u.username IS NOT NULL
          ${additionalFilters}
      `;

      const [users, countResult] = await Promise.all([
        sequelize.query(usersQuery, {
          replacements: [req.user.brand_id, req.user.brand_id, ...filterReplacements, limit, offset],
          type: QueryTypes.SELECT
        }),
        sequelize.query(countQuery, {
          replacements: [req.user.brand_id, ...filterReplacements],
          type: QueryTypes.SELECT
        })
      ]);

      const count = (countResult[0] as any).total;
      const totalPages = Math.ceil(count / limit);

      res.json({
        data: users,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: count,
          per_page: limit,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      });
    } else {
      // Standard sorting for other fields
      let orderClause: any[] = [['username', 'ASC']]; // Default ordering
      const sortableFields = [...filterableFields];
      if (sortBy && sortableFields.includes(sortBy)) {
        const direction = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        orderClause = [[sortBy, direction]];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereCondition,
        attributes: [
          'id', 
          'username', 
          'email_address', 
          'first_name', 
          'last_name', 
          'is_admin'
        ],
        order: orderClause,
        limit,
        offset
      });

      // Get latest successful login for each user
      const userIds = users.map(user => user.id);
      let loginMap = new Map();
      
      if (userIds.length > 0) {
        const latestLogins = await LoginAttempt.findAll({
          attributes: [
            'user_id',
            [require('sequelize').fn('MAX', require('sequelize').col('date_and_time')), 'last_logged_in']
          ],
          where: {
            user_id: userIds,
            status: 'Successful',
            brand_id: req.user.brand_id
          },
          group: ['user_id'],
          raw: true
        });

        // Create a map of user_id to last_logged_in
        latestLogins.forEach((login: any) => {
          loginMap.set(login.user_id, login.last_logged_in);
        });
      }

      // Add last_logged_in to users and format the response
      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        last_logged_in: loginMap.get(user.id) || null
      }));

      const totalPages = Math.ceil(count / limit);

      res.json({
        data: formattedUsers,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: count,
          per_page: limit,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      });
    }
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLoginAttempts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Parse filter and sort parameters
    const sortBy = req.query.sortBy as string;
    const sortDirection = (req.query.sortDirection as string) || 'DESC';

    // Build where condition for main table
    const whereCondition: any = { brand_id: req.user.brand_id };

    // Build where condition for user include
    const userWhereCondition: any = {
      username: {
        [Op.ne]: '',
        [Op.not]: null
      }
    };

    // Add filters - these need to be handled carefully with the JOIN
    const username = req.query.username as string;
    const name = req.query.name as string;
    const date_and_time = req.query.date_and_time as string;
    const result = req.query.result as string;
    const remote_ip = req.query.remote_ip as string;

    // Username filter
    if (username && username.trim() !== '') {
      userWhereCondition.username = {
        ...userWhereCondition.username,
        [require('sequelize').Op.like]: `%${username}%`
      };
    }

    // Name filter (first_name or last_name)
    if (name && name.trim() !== '') {
      const nameCondition = {
        [require('sequelize').Op.or]: [
          { first_name: { [require('sequelize').Op.like]: `%${name}%` } },
          { last_name: { [require('sequelize').Op.like]: `%${name}%` } }
        ]
      };
      userWhereCondition[require('sequelize').Op.and] = [
        userWhereCondition[require('sequelize').Op.and] || {},
        nameCondition
      ].filter(Boolean);
    }

    // Date filter
    if (date_and_time && date_and_time.trim() !== '') {
      whereCondition.date_and_time = {
        [require('sequelize').Op.like]: `%${date_and_time}%`
      };
    }

    // Result filter (status)
    if (result && result.trim() !== '') {
      whereCondition.status = {
        [require('sequelize').Op.like]: `%${result}%`
      };
    }

    // Remote IP filter
    if (remote_ip && remote_ip.trim() !== '') {
      whereCondition[require('sequelize').Op.or] = [
        { remote_ip: { [require('sequelize').Op.like]: `%${remote_ip}%` } },
        { proxy_ip: { [require('sequelize').Op.like]: `%${remote_ip}%` } }
      ];
    }

    // Build order clause
    let orderClause: any[] = [['date_and_time', 'DESC']]; // Default ordering
    const sortableFields = ['username', 'name', 'date_and_time', 'result', 'remote_ip'];
    if (sortBy && sortableFields.includes(sortBy)) {
      const direction = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      if (sortBy === 'username') {
        orderClause = [[{ model: User, as: 'user' }, 'username', direction]];
      } else if (sortBy === 'name') {
        orderClause = [[{ model: User, as: 'user' }, 'first_name', direction]];
      } else if (sortBy === 'result') {
        orderClause = [['status', direction]];
      } else if (sortBy === 'remote_ip') {
        orderClause = [['remote_ip', direction]];
      } else {
        orderClause = [[sortBy, direction]];
      }
    }

    const { count, rows: loginAttempts } = await LoginAttempt.findAndCountAll({
      where: whereCondition,
      include: [{ 
        model: User, 
        as: 'user',
        attributes: ['username', 'first_name', 'last_name'],
        where: userWhereCondition,
        required: false // Left join to include attempts even if user is deleted
      }],
      order: orderClause,
      limit,
      offset
    });

    // Format the response to match the frontend interface
    const formattedAttempts = loginAttempts.map(attempt => {
      const user = (attempt as any).user;
      return {
        username: user?.username || 'Unknown',
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown User',
        date_and_time: attempt.date_and_time,
        result: attempt.status,
        remote_ip: attempt.remote_ip || attempt.proxy_ip || 'Unknown'
      };
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      data: formattedAttempts,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: count,
        per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });
  } catch (error) {
    console.error('Get login attempts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ======================================
// ADMIN INVITE SYSTEM
// ======================================

export const inviteAdmin = async (req: AuthRequest, res: Response) => {
  let user: any = null; // Declare user variable at function scope for cleanup
  
  try {
    const { email_address, first_name, last_name } = req.body;

    // Only superadmins can invite other admins
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!email_address) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { 
        email_address,
        brand_id: req.user.brand_id 
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate invite hash
    const inviteHash = crypto.randomBytes(32).toString('hex');

    // Create new admin user
    user = await User.create({
      email_address,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      brand_id: req.user.brand_id,
      is_admin: true,
      reset_hash: inviteHash // Using reset_hash field for invite
    });

    // Get brand details for email
    const brand = await Brand.findByPk(req.user.brand_id);

    // Get brand frontend URL - NEVER use fallback URL for multi-brand security
    let inviteLink: string;
    try {
      const brandUrl = await getBrandFrontendUrl(req.user.brand_id);
      inviteLink = `${brandUrl}/admin-invite?token=${inviteHash}`;
    } catch (error) {
      console.error(`No domains found for brand ${req.user.brand_id}. Cannot send admin invite without proper brand domain.`);
      // Clean up user if domain lookup failed
      await user.destroy();
      return res.status(400).json({ error: 'No domains configured for this brand. Please configure a domain before sending invites.' });
    }
    
    // Load email template
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, '../assets/templates/admin_invite_email.html');
    let emailTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    const inviterName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Admin';
    emailTemplate = emailTemplate
      .replace(/%MEMBER_NAME%/g, inviterName)
      .replace(/%BRAND_NAME%/g, brand?.brand_name || 'Label Dashboard')
      .replace(/%URL%/g, inviteLink)
      .replace(/%LOGO%/g, brand?.logo_url || '')
      .replace(/%BRAND_COLOR%/g, brand?.brand_color || '#1595e7');

    const emailSent = await sendEmail(
      [user.email_address],
      `You're invited to be an admin for ${brand?.brand_name || 'Label Dashboard'}`,
      emailTemplate,
      req.user.brand_id
    );

    if (emailSent) {
      res.json({ 
        message: 'Admin invitation sent successfully',
        user: {
          id: user.id,
          email_address: user.email_address,
          first_name: user.first_name,
          last_name: user.last_name,
          is_admin: user.is_admin,
          brand_id: user.brand_id
        }
      });
    } else {
      // Clean up user if email failed
      await user.destroy();
      res.status(500).json({ error: 'Failed to send invitation email' });
    }
  } catch (error) {
    console.error('Invite admin error:', error);
    // Clean up user if any unexpected error occurred during invite process
    if (user && user.id) {
      try {
        await user.destroy();
      } catch (cleanupError) {
        console.error('Error cleaning up user after failed invite:', cleanupError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resendAdminInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find user
    const user = await User.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id,
        is_admin: true
      },
      include: [{
        model: Brand,
        as: 'brand'
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Check if user has already set up their account
    if (user.password_md5) {
      return res.status(400).json({ error: 'User has already set up their account' });
    }

    // Generate new invite hash
    const inviteHash = crypto.randomBytes(32).toString('hex');
    await user.update({ reset_hash: inviteHash });

    // Get brand frontend URL - NEVER use fallback URL for multi-brand security
    let inviteLink: string;
    try {
      const brandUrl = await getBrandFrontendUrl(req.user.brand_id);
      inviteLink = `${brandUrl}/admin-invite?token=${inviteHash}`;
    } catch (error) {
      console.error(`No domains found for brand ${req.user.brand_id}. Cannot send admin invite without proper brand domain.`);
      return res.status(400).json({ error: 'No domains configured for this brand. Please configure a domain before sending invites.' });
    }
    
    // Load email template
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, '../assets/templates/admin_invite_email.html');
    let emailTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    const inviterName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Admin';
    const brand = user.brand;
    emailTemplate = emailTemplate
      .replace(/%MEMBER_NAME%/g, inviterName)
      .replace(/%BRAND_NAME%/g, brand?.brand_name || 'Label Dashboard')
      .replace(/%URL%/g, inviteLink)
      .replace(/%LOGO%/g, brand?.logo_url || '')
      .replace(/%BRAND_COLOR%/g, brand?.brand_color || '#1595e7');

    const emailSent = await sendEmail(
      [user.email_address],
      `You're invited to be an admin for ${brand?.brand_name || 'Label Dashboard'}`,
      emailTemplate,
      req.user.brand_id
    );

    if (emailSent) {
      res.json({ message: 'Admin invitation resent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to resend invitation email' });
    }
  } catch (error) {
    console.error('Resend admin invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelAdminInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find user
    const user = await User.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id,
        is_admin: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Check if user has already set up their account
    if (user.password_md5) {
      return res.status(400).json({ error: 'Cannot cancel - user has already set up their account' });
    }

    // Remove the user
    await user.destroy();

    res.json({ message: 'Admin invitation cancelled successfully' });
  } catch (error) {
    console.error('Cancel admin invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};