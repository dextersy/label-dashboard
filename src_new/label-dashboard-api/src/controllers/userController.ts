import { Request, Response } from 'express';
import crypto from 'crypto';
import { User, Brand, LoginAttempt, AudienceUser, Notification } from '../models';
import { sendEmail } from '../utils/emailService';
import { createNotification } from '../utils/notificationService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { generateSecureToken } from '../utils/tokenUtils';
import { hashPassword, hasPassword } from '../utils/passwordUtils';
import { sequelize } from '../config/database';
import { QueryTypes, Op } from 'sequelize';
import { getCardLevel } from '../utils/audiencePoints';
import { getEffectiveLimitsForBrand } from '../services/subscriptionService';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Resolve the effective brand ID for an operation.
 * If `target_brand_id` is provided, verify it is a direct child of the caller's brand.
 * Returns the resolved brand ID, or null if access is denied.
 */
async function resolveTargetBrandId(callerBrandId: number, targetBrandId?: number): Promise<number | null> {
  if (!targetBrandId || targetBrandId === callerBrandId) return callerBrandId;
  const child = await Brand.findOne({ where: { id: targetBrandId, parent_brand: callerBrandId, is_active: true } });
  return child ? targetBrandId : null;
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

    // Generate cryptographically strong reset hash
    const resetHash = generateSecureToken();
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

    // Create password hash using bcrypt (secure encryption)
    const passwordHash = await hashPassword(password);

    const user = await User.create({
      username,
      email_address,
      first_name,
      last_name,
      password_hash: passwordHash,
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

    // Generate cryptographically strong invite hash
    const inviteHash = generateSecureToken();

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
      // Create in-app notification for the invited user
      await createNotification(user.id, user.brand_id, 'user_invite', `You've been invited to the dashboard`, undefined, inviteLink);
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
    const { user_id, target_brand_id } = req.body;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const effectiveBrandId = await resolveTargetBrandId(req.user.brand_id, target_brand_id);
    if (effectiveBrandId === null) {
      return res.status(403).json({ error: 'Access denied to target brand' });
    }

    const user = await User.findOne({
      where: {
        id: user_id,
        brand_id: effectiveBrandId
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

    // Helper function to escape LIKE wildcards to prevent pattern injection
    const escapeLikeWildcards = (value: string): string => {
      return value.replace(/[%_]/g, '\\$&');
    };

    // Resolve target brand (supports parent brand managing sublabel users)
    const targetBrandIdParam = req.query.target_brand_id ? parseInt(req.query.target_brand_id as string, 10) : undefined;
    const effectiveBrandId = await resolveTargetBrandId(req.user.brand_id, targetBrandIdParam);
    if (effectiveBrandId === null) {
      return res.status(403).json({ error: 'Access denied to target brand' });
    }

    // Build where condition (scoped to effective brand)
    const usernameFilter = req.query.username as string;
    const whereCondition: any = {
      brand_id: effectiveBrandId
    };

    // IMPORTANT: Username filter changes the base condition
    // - With username filter: only search regular users (pending invites have no username to match)
    // - Without username filter: include both regular users and pending invites
    if (usernameFilter && usernameFilter.trim() !== '') {
      // SECURITY: Escape LIKE wildcards (% and _) to prevent pattern injection
      const escapedUsername = escapeLikeWildcards(usernameFilter.trim());
      
      // Username filter: only search regular users with matching usernames
      whereCondition[Op.or] = [
        {
          username: {
            [Op.and]: [
              { [Op.ne]: '' },
              { [Op.not]: null },
              { [Op.like]: `%${escapedUsername}%` }
            ]
          }
        }
      ];
    } else {
      // No username filter: include both regular users and pending invites
      whereCondition[Op.or] = [
        {
          // Regular users with usernames
          username: {
            [Op.ne]: '',
            [Op.not]: null
          }
        },
        {
          // Pending invites
          username: {
            [Op.or]: ['', null]
          },
          reset_hash: {
            [Op.not]: null
          }
        }
      ];
    }
    
    // Apply other filters
    // NOTE: These field filters are automatically ANDed with the Op.or condition above
    // Sequelize combines top-level conditions with AND, creating: brand_id AND Op.or AND field1 AND field2...
    const filterableFields = ['first_name', 'last_name', 'email_address', 'is_admin'];
    filterableFields.forEach(field => {
      const filterValue = req.query[field] as string;
      if (filterValue && filterValue.trim() !== '') {
        if (field === 'is_admin') {
          // Handle boolean filter
          whereCondition[field] = filterValue.toLowerCase() === 'true';
        } else {
          // SECURITY: Escape LIKE wildcards to prevent pattern injection
          const escapedValue = escapeLikeWildcards(filterValue.trim());
          // Handle text filters with partial matching
          whereCondition[field] = {
            [Op.like]: `%${escapedValue}%`
          };
        }
      }
    });

    // Special handling for last_logged_in sorting - we need to use raw SQL for this
    if (sortBy === 'last_logged_in') {
      // SECURITY: Strict allowlist for sort direction - never interpolate user input
      const isDescending = sortDirection.toUpperCase() === 'DESC';

      // PostgreSQL supports NULLS FIRST/LAST natively
      // For DESC: non-null values first (DESC), then NULL values
      // For ASC: NULL values first, then non-null values (ASC)

      // SECURITY: Use complete pre-built strings to make SQL injection protection obvious to reviewers
      const orderByClause = isDescending
        ? `ORDER BY la_max.last_logged_in DESC NULLS LAST`
        : `ORDER BY la_max.last_logged_in ASC NULLS FIRST`;

      // Build additional filter conditions for the raw query using parameterized queries
      // SECURITY: Use parameterized queries to prevent SQL injection
      const filterConditions: string[] = [];
      const filterReplacements: any[] = [];

      // SECURITY: Column name mapping - prevents SQL injection by never interpolating user input
      // Maps filter keys to actual SQL column names
      const columnMapping: Record<string, string> = {
        'email_address': 'u.email_address',
        'first_name': 'u.first_name',
        'last_name': 'u.last_name',
        'is_admin': 'u.is_admin'
      };

      // SECURITY: Only process keys that exist in our column mapping
      // This explicitly filters for valid columns and excludes:
      // - brand_id (used in WHERE clause separately)
      // - username (handled separately in WHERE clause)
      // - Symbol keys like Op.or (Object.keys() won't return them anyway)
      const filterKeys = Object.keys(whereCondition).filter(key => 
        key in columnMapping
      );

      filterKeys.forEach(key => {
          // At this point, we know the key exists in columnMapping due to the filter above
          const columnName = columnMapping[key];

          const value = whereCondition[key];
          if (key === 'is_admin') {
            filterConditions.push(`AND ${columnName} = ?`);
            filterReplacements.push(!!value);
          } else if (typeof value === 'object' && value[Op.like]) {
            // SECURITY: Extract the escaped value (already escaped by escapeLikeWildcards earlier)
            // The value is already in format %escapedValue%, just use it directly
            // Use ESCAPE clause to tell the database that backslash is our escape character
            filterConditions.push(`AND ${columnName} LIKE ? ESCAPE '\\'`);
            filterReplacements.push(value[Op.like]);
          }
        });

      const additionalFilters = filterConditions.join(' ');

      // Build WHERE clause to match ORM path logic
      let whereClause = '';
      if (usernameFilter && usernameFilter.trim() !== '') {
        // SECURITY: Use the escaped username value (already escaped by escapeLikeWildcards earlier)
        const escapedUsername = escapeLikeWildcards(usernameFilter.trim());
        
        // When username filter is applied, exclude pending invites (only search actual usernames)
        // Use ESCAPE clause to tell the database that backslash is our escape character
        const usernameFilterCondition = "AND u.username LIKE ? ESCAPE '\\'";
        filterReplacements.push(`%${escapedUsername}%`);
        
        whereClause = `
          WHERE u.brand_id = ?
            AND u.username != '' 
            AND u.username IS NOT NULL
            ${usernameFilterCondition}
            ${additionalFilters}
        `;
      } else {
        // When no username filter, include both regular users and pending invites
        whereClause = `
          WHERE u.brand_id = ?
            AND (
              (u.username != '' AND u.username IS NOT NULL)
              OR ((u.username = '' OR u.username IS NULL) AND u.reset_hash IS NOT NULL)
            )
            ${additionalFilters}
        `;
      }

      // Use raw query with LEFT JOIN to properly sort by last login
      // SECURITY: Compute has_pending_invite directly instead of selecting reset_hash
      const usersQuery = `
        SELECT 
          u.id, 
          u.username, 
          u.email_address, 
          u.first_name, 
          u.last_name, 
          u.is_admin, 
          la_max.last_logged_in,
          CASE 
            WHEN (u.username = '' OR u.username IS NULL) AND u.reset_hash IS NOT NULL 
            THEN 1 
            ELSE 0 
          END as has_pending_invite
        FROM "user" u
        LEFT JOIN (
          SELECT user_id, MAX(date_and_time) as last_logged_in
          FROM login_attempt
          WHERE status = 'Successful' AND brand_id = ?
          GROUP BY user_id
        ) la_max ON u.id = la_max.user_id
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM "user" u
        ${whereClause}
      `;

      const [rawUsers, countResult] = await Promise.all([
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

      // Format users to match ORM path response structure
      // has_pending_invite is computed in the SQL query, not here
      const formattedUsers = (rawUsers as any[]).map(user => ({
        id: user.id,
        username: user.username,
        email_address: user.email_address,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        last_logged_in: user.last_logged_in || null,
        has_pending_invite: !!user.has_pending_invite // Convert 1/0 to boolean
      }));

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
          'is_admin',
          'reset_hash'
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
        last_logged_in: loginMap.get(user.id) || null,
        has_pending_invite: (!user.username || user.username === '') && !!user.reset_hash
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || 'date_and_time';
    const dir = (req.query.sortDirection as string || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const usernameFilter  = (req.query.username as string || '').trim();
    const nameFilter      = (req.query.name as string || '').trim();
    const dateFilter      = (req.query.date_and_time as string || '').trim();
    const resultFilter    = (req.query.result as string || '').trim();
    const remoteIpFilter  = (req.query.remote_ip as string || '').trim();

    // Build dynamic WHERE clauses for the base CTE.
    // All values are passed as named replacements to prevent SQL injection.
    const whereClauses: string[] = ['la.brand_id = :brandId'];
    const replacements: Record<string, any> = { brandId: req.user.brand_id, limit, offset };

    if (usernameFilter)  { whereClauses.push('u.username ILIKE :username');   replacements.username = `%${usernameFilter}%`; }
    if (nameFilter)      { whereClauses.push('(u.first_name ILIKE :name OR u.last_name ILIKE :name)'); replacements.name = `%${nameFilter}%`; }
    if (dateFilter)      { whereClauses.push("la.date_and_time::text ILIKE :date_and_time"); replacements.date_and_time = `%${dateFilter}%`; }
    if (resultFilter)    { whereClauses.push('la.status ILIKE :result');       replacements.result = `%${resultFilter}%`; }
    if (remoteIpFilter)  { whereClauses.push('(la.remote_ip ILIKE :remote_ip OR la.proxy_ip ILIKE :remote_ip)'); replacements.remote_ip = `%${remoteIpFilter}%`; }

    const whereSQL = whereClauses.join(' AND ');

    // Map frontend sort keys to grouped-CTE column names
    const sortColumnMap: Record<string, string> = {
      date_and_time: 'date_and_time',
      username:      'username',
      name:          'name',
      result:        'result',
      remote_ip:     'remote_ip',
    };
    const sortCol = sortColumnMap[sortBy] || 'date_and_time';

    // Consecutive-run grouping using the classic "gaps and islands" window function technique:
    //   rn  = row number over the full ordered set
    //   rn_part = row number partitioned by (user_id, status)
    //   grp_key = rn - rn_part is constant for consecutive rows with the same user+status
    const baseCTE = `
      WITH filtered AS (
        SELECT
          la.id,
          la.user_id,
          la.status,
          la.date_and_time,
          COALESCE(la.remote_ip, la.proxy_ip, 'Unknown') AS remote_ip,
          COALESCE(la.auth_method, 'password')           AS auth_method,
          COALESCE(u.username, 'Unknown')                AS username,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS name,
          ROW_NUMBER() OVER (ORDER BY la.date_and_time DESC)                                     AS rn,
          ROW_NUMBER() OVER (PARTITION BY la.user_id, la.status ORDER BY la.date_and_time DESC)  AS rn_part
        FROM login_attempt la
        LEFT JOIN "user" u ON u.id = la.user_id
        WHERE ${whereSQL}
      ),
      islands AS (
        SELECT *, (rn - rn_part) AS grp_key FROM filtered
      ),
      grouped AS (
        SELECT
          MIN(user_id)    AS user_id,
          status          AS result,
          grp_key,
          MIN(username)   AS username,
          MIN(name)       AS name,
          MAX(date_and_time)  AS date_and_time,
          COUNT(*)::int       AS attempt_count,
          MIN(remote_ip)  AS remote_ip,
          MIN(auth_method) AS auth_method,
          array_agg(date_and_time ORDER BY date_and_time DESC) AS all_times
        FROM islands
        GROUP BY user_id, status, grp_key
      )`;

    const dataSQL   = `${baseCTE} SELECT * FROM grouped ORDER BY ${sortCol} ${dir} LIMIT :limit OFFSET :offset`;
    const countSQL  = `${baseCTE} SELECT COUNT(*)::int AS total FROM grouped`;

    const [rows, countRows] = await Promise.all([
      sequelize.query(dataSQL,  { replacements, type: QueryTypes.SELECT }),
      sequelize.query(countSQL, { replacements, type: QueryTypes.SELECT }),
    ]);

    const totalCount = (countRows[0] as any).total as number;
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      data: rows,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
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
    const { email_address, first_name, last_name, target_brand_id } = req.body;

    // Only admins can invite other admins
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

    const effectiveBrandId = await resolveTargetBrandId(req.user.brand_id, target_brand_id);
    if (effectiveBrandId === null) {
      return res.status(403).json({ error: 'Access denied to target brand' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        email_address,
        brand_id: effectiveBrandId
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Enforce plan admin user limit
    const limits = await getEffectiveLimitsForBrand(effectiveBrandId);
    if (limits && limits.limit_admin_users !== null) {
      const adminCount = await User.count({ where: { brand_id: effectiveBrandId, is_admin: true } });
      if (adminCount >= limits.limit_admin_users) {
        return res.status(402).json({ error: 'LIMIT_REACHED', limit_type: 'admin_users', limit: limits.limit_admin_users });
      }
    }

    // Generate cryptographically strong invite hash
    const inviteHash = generateSecureToken();

    // Create new admin user
    user = await User.create({
      email_address,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      brand_id: effectiveBrandId,
      is_admin: true,
      reset_hash: inviteHash // Using reset_hash field for invite
    });

    // Get brand details for email
    const brand = await Brand.findByPk(effectiveBrandId);

    // Get brand frontend URL - NEVER use fallback URL for multi-brand security
    let inviteLink: string;
    try {
      const brandUrl = await getBrandFrontendUrl(effectiveBrandId);
      inviteLink = `${brandUrl}/admin-invite?token=${inviteHash}`;
    } catch (error) {
      console.error(`No domains found for brand ${effectiveBrandId}. Cannot send admin invite without proper brand domain.`);
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
      effectiveBrandId
    );

    if (emailSent) {
      // Create in-app notification for the invited admin user
      await createNotification(user.id, user.brand_id, 'user_invite', `You've been invited as an admin`, undefined, inviteLink);
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
    const target_brand_id = req.body?.target_brand_id ?? req.query?.target_brand_id;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const effectiveBrandId = await resolveTargetBrandId(req.user.brand_id, target_brand_id ? parseInt(target_brand_id as string, 10) : undefined);
    if (effectiveBrandId === null) {
      return res.status(403).json({ error: 'Access denied to target brand' });
    }

    // Find user with pending invite (has reset_hash)
    const user = await User.findOne({
      where: {
        id,
        brand_id: effectiveBrandId
      },
      attributes: ['id', 'email_address', 'first_name', 'last_name', 'is_admin', 'reset_hash', 'password_hash', 'password_md5', 'username', 'brand_id'],
      include: [{
        model: Brand,
        as: 'brand'
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a pending invite
    if (!user.reset_hash) {
      return res.status(400).json({ error: 'User does not have a pending invitation' });
    }

    // Check if user has already set up their account (bcrypt or MD5)
    if (hasPassword(user)) {
      return res.status(400).json({ error: 'User has already set up their account' });
    }

    // Generate cryptographically strong invite hash
    const inviteHash = generateSecureToken();
    await user.update({ reset_hash: inviteHash });

    // Get brand frontend URL - NEVER use fallback URL for multi-brand security
    let inviteLink: string;
    try {
      const brandUrl = await getBrandFrontendUrl(effectiveBrandId);
      inviteLink = `${brandUrl}/admin-invite?token=${inviteHash}`;
    } catch (error) {
      console.error(`No domains found for brand ${effectiveBrandId}. Cannot send admin invite without proper brand domain.`);
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

    // Determine the role for email subject based on current admin status
    const roleText = user.is_admin ? 'an admin' : 'a member';
    const emailSent = await sendEmail(
      [user.email_address],
      `You're invited to be ${roleText} for ${brand?.brand_name || 'Label Dashboard'}`,
      emailTemplate,
      effectiveBrandId
    );

    if (emailSent) {
      res.json({ message: 'Invitation resent successfully' });
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
    const target_brand_id = req.body?.target_brand_id ?? req.query?.target_brand_id;

    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const effectiveBrandId = await resolveTargetBrandId(req.user.brand_id, target_brand_id ? parseInt(target_brand_id as string, 10) : undefined);
    if (effectiveBrandId === null) {
      return res.status(403).json({ error: 'Access denied to target brand' });
    }

    // Find user with pending invite (has reset_hash)
    const user = await User.findOne({
      where: {
        id,
        brand_id: effectiveBrandId
      },
      attributes: ['id', 'email_address', 'first_name', 'last_name', 'is_admin', 'reset_hash', 'password_hash', 'password_md5', 'username', 'brand_id']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a pending invite
    if (!user.reset_hash) {
      return res.status(400).json({ error: 'User does not have a pending invitation' });
    }

    // Check if user has already set up their account (bcrypt or MD5)
    if (hasPassword(user)) {
      return res.status(400).json({ error: 'Cannot cancel - user has already set up their account' });
    }

    // Remove notifications created for this user (FK constraint blocks user deletion otherwise)
    await Notification.destroy({ where: { user_id: user.id } });

    // Remove the user
    await user.destroy();

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Cancel admin invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ======================================
// AUDIENCE USERS (ticketing parent brand only)
// ======================================

export const getAudienceUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const ticketingParentBrandId = process.env.TICKETING_PARENT_BRAND_ID ? parseInt(process.env.TICKETING_PARENT_BRAND_ID) : null;
    if (!ticketingParentBrandId || req.user.brand_id !== ticketingParentBrandId) {
      return res.status(403).json({ error: 'Access restricted to ticketing parent brand admins' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const sortBy = req.query.sortBy as string;
    const sortDirection = (req.query.sortDirection as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const escapeLikeWildcards = (value: string): string => value.replace(/[%_]/g, '\\$&');

    const whereCondition: any = {};

    const filterFields = ['email_address', 'first_name', 'last_name', 'contact_number'];
    for (const field of filterFields) {
      const val = req.query[field] as string;
      if (val && val.trim()) {
        whereCondition[field] = { [Op.like]: `%${escapeLikeWildcards(val.trim())}%` };
      }
    }

    const sortableFields = ['email_address', 'first_name', 'last_name', 'created_at', 'email_verified', 'points_total'];
    let orderClause: any[] = [['created_at', 'DESC']];
    if (sortBy && sortableFields.includes(sortBy)) {
      orderClause = [[sortBy, sortDirection]];
    }

    const { count, rows: audienceUsers } = await AudienceUser.findAndCountAll({
      where: whereCondition,
      attributes: ['id', 'email_address', 'first_name', 'last_name', 'contact_number', 'email_verified', 'points_total', 'created_at'],
      order: orderClause,
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      data: audienceUsers.map((u) => {
        const json = u.toJSON() as any;
        const points = json.points_total ?? 0;
        return {
          ...json,
          points_total: points,
          card_level: getCardLevel(points),
        };
      }),
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
    console.error('Get audience users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ======================================
// ONBOARDING SYSTEM
// ======================================

export const completeOnboarding = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      console.error(`User not found for ID: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ onboarding_completed: true });

    // Reload to get fresh data
    await user.reload();

    res.json({
      message: 'Onboarding completed successfully',
      onboarding_completed: user.onboarding_completed
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};